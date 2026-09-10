import { transitionStatus } from "@repo/registry";
import { Env, HttpError } from "./env";
import { readCheck, type CheckRow } from "./store";
import { runCloudProbe, type Observation } from "./probes";
const runningDeployment = `NOT EXISTS (SELECT 1 FROM json_each(json_extract(p.document, '$.deployments')) d WHERE json_extract(d.value, '$.id') = json_extract(c.document, '$.deploymentId') AND json_extract(d.value, '$.expectedRunning') = 0)`;
export async function claimCheck(
  env: Env,
  id: string,
  force = false,
): Promise<CheckRow | null> {
  const now = new Date().toISOString();
  const lease = crypto.randomUUID();
  const deadline = new Date(Date.now() + 90_000).toISOString();
  const row = await env.DB.prepare(
    `UPDATE checks SET lease_id = ?, lease_until = ?, scheduled_at = ? WHERE id = ? AND enabled = 1 AND (lease_until IS NULL OR lease_until < ?) ${force ? "" : "AND next_run_at <= ?"} AND id IN (SELECT c.id FROM checks c JOIN projects p ON p.id = c.project_id WHERE ${runningDeployment}) RETURNING *`,
  )
    .bind(...[lease, deadline, now, id, now, ...(force ? [] : [now])])
    .first<CheckRow>();
  return row;
}
export async function finishCheck(
  env: Env,
  row: CheckRow,
  observation: Observation,
) {
  const now = new Date().toISOString();
  const check = readCheck(row);
  const state = transitionStatus(check, observation.status);
  const next = new Date(Date.now() + check.interval * 1000).toISOString();
  const message = observation.message.slice(0, 500);
  const incidentId = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO check_results (id, check_id, status, latency, message, observed_at) SELECT ?, id, ?, ?, ?, ? FROM checks WHERE id = ? AND lease_id = ? AND lease_until >= ?",
    ).bind(
      row.lease_id,
      observation.status,
      observation.latency,
      message,
      now,
      row.id,
      row.lease_id,
      now,
    ),
    env.DB.prepare(
      "UPDATE checks SET status = ?, latest_status = ?, failures = ?, successes = ?, observed_at = ?, latency = ?, message = ?, next_run_at = ?, lease_id = NULL, lease_until = NULL WHERE id = ? AND lease_id = ? AND lease_until >= ?",
    ).bind(
      state.status,
      observation.status,
      state.failures,
      state.successes,
      now,
      observation.latency,
      message,
      next,
      row.id,
      row.lease_id,
      now,
    ),
    env.DB.prepare(
      "INSERT OR IGNORE INTO incidents (id, project_id, check_id, title, message, created_at) SELECT ?, project_id, id, ?, ?, ? FROM checks WHERE id = ? AND status = 'major_outage' AND observed_at = ?",
    ).bind(incidentId, `${check.name} is failing`, message, now, row.id, now),
    env.DB.prepare(
      "UPDATE incidents SET resolved_at = ? WHERE check_id = ? AND resolved_at IS NULL AND EXISTS (SELECT 1 FROM checks WHERE id = ? AND status = 'operational' AND observed_at = ?)",
    ).bind(now, row.id, row.id, now),
  ]);
  const accepted = Boolean(results[1]?.meta.changes);
  if (accepted && env.ALERT_WEBHOOK_URL && results[2]?.meta.changes) {
    // A configured owner webhook receives a minimal incident notification; probe response bodies are never forwarded.
    try {
      const response = await fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "incident.opened",
          incidentId,
          projectId: row.project_id,
          checkId: row.id,
          title: `${check.name} is failing`,
          occurredAt: now,
        }),
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      if (!response.ok)
        console.error("Incident webhook returned", response.status);
    } catch {
      console.error("Incident webhook delivery failed");
    }
  }
  return accepted;
}
export async function runCheckNow(env: Env, id: string) {
  const existing = await env.DB.prepare("SELECT * FROM checks WHERE id = ?")
    .bind(id)
    .first<CheckRow>();
  if (!existing) throw new HttpError(404, "Check not found.");
  if (existing.runner === "collector") {
    await env.DB.prepare("UPDATE checks SET next_run_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id)
      .run();
    return {
      message:
        "Requested. The collector will pick this up on its next heartbeat.",
    };
  }
  const row = await claimCheck(env, id, true);
  if (!row)
    throw new HttpError(
      409,
      "This check is paused, its deployment is stopped, or it is already running.",
    );
  const result = await runCloudProbe(readCheck(row));
  await finishCheck(env, row, result);
  return { message: "Check completed.", result };
}
export async function scheduledChecks(env: Env) {
  const now = new Date().toISOString();
  const batchSize = Math.max(1, Math.min(3, Number(env.CHECK_BATCH_SIZE) || 3));
  await env.DB.prepare("UPDATE monitor_state SET last_tick_at = ? WHERE id = 1")
    .bind(now)
    .run();
  const due = await env.DB.prepare(
    `SELECT c.id FROM checks c JOIN projects p ON p.id = c.project_id WHERE c.runner = 'cloud' AND c.enabled = 1 AND c.next_run_at <= ? AND (c.lease_until IS NULL OR c.lease_until < ?) AND ${runningDeployment} ORDER BY c.next_run_at LIMIT ?`,
  )
    .bind(now, now, batchSize)
    .all<{ id: string }>();
  for (const item of due.results) {
    const row = await claimCheck(env, item.id);
    if (!row) continue;
    await finishCheck(env, row, await runCloudProbe(readCheck(row)));
  }
  // Bounded cleanup makes retention incremental without a large daily delete.
  if (new Date().getUTCMinutes() % 10 === 0) {
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
    const auditCutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
    await env.DB.batch([
      ...["login_flows", "browser_sessions", "login_rate_limits"].map((table) =>
        env.DB.prepare(
          "DELETE FROM " +
            table +
            " WHERE rowid IN (SELECT rowid FROM " +
            table +
            " WHERE expires_at < ? LIMIT 100)",
        ).bind(Math.floor(Date.now() / 1000)),
      ),
      env.DB.prepare(
        "DELETE FROM check_results WHERE id IN (SELECT id FROM check_results WHERE observed_at < ? LIMIT 500)",
      ).bind(cutoff),
      env.DB.prepare(
        "DELETE FROM audit WHERE id IN (SELECT id FROM audit WHERE created_at < ? LIMIT 100)",
      ).bind(auditCutoff),
      env.DB.prepare(
        "UPDATE monitor_state SET last_cleanup_at = ? WHERE id = 1",
      ).bind(now),
    ]);
  }
}
export async function dueCollectorChecks(env: Env, collectorId: string) {
  const now = new Date().toISOString();
  const due = await env.DB.prepare(
    `SELECT c.id FROM checks c JOIN projects p ON p.id = c.project_id WHERE c.runner = 'collector' AND c.collector_id = ? AND c.enabled = 1 AND c.next_run_at <= ? AND (c.lease_until IS NULL OR c.lease_until < ?) AND ${runningDeployment} ORDER BY c.next_run_at LIMIT 5`,
  )
    .bind(collectorId, now, now)
    .all<{ id: string }>();
  const assignments = [];
  for (const item of due.results) {
    const row = await claimCheck(env, item.id);
    if (row) assignments.push({ ...readCheck(row), leaseId: row.lease_id });
  }
  return assignments;
}
