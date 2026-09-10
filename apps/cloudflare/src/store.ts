import {
  emptyProject,
  projectHealth,
  checkHealth,
  slugify,
  type Project,
  type Check,
  type Collector,
  type JournalEntry,
  type AuditEvent,
  type Incident,
} from "@repo/registry";
import { Env, HttpError } from "./env";
import { Identity, projectPermission } from "./auth";
import { projectInput } from "./validation";
export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  document: string;
  created_at: string;
  updated_at: string;
}
export interface CheckRow {
  id: string;
  project_id: string;
  document: string;
  runner: "cloud" | "collector";
  collector_id: string | null;
  enabled: number;
  interval_seconds: number;
  status: Check["status"];
  latest_status: Check["status"];
  observed_at: string | null;
  scheduled_at: string | null;
  next_run_at: string;
  lease_id: string | null;
  lease_until: string | null;
  failures: number;
  successes: number;
  latency: number | null;
  message: string;
}
export function readCheck(row: CheckRow): Check {
  return {
    ...JSON.parse(row.document),
    id: row.id,
    projectId: row.project_id,
    runner: row.runner,
    collectorId: row.collector_id || "",
    enabled: Boolean(row.enabled),
    interval: row.interval_seconds,
    status: row.status,
    latestStatus: row.latest_status,
    observedAt: row.observed_at,
    scheduledAt: row.scheduled_at,
    failures: row.failures,
    successes: row.successes,
    latency: row.latency,
    message: row.message,
  };
}
export function readProject(row: ProjectRow): Project {
  return {
    ...emptyProject(),
    ...JSON.parse(row.document),
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    health: "unknown",
    coverage: { total: 0, fresh: 0, stale: 0 },
  };
}
export async function getCollectors(env: Env): Promise<Collector[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, platform, last_seen_at AS lastSeenAt, created_at AS createdAt, revoked_at AS revokedAt FROM collectors ORDER BY created_at DESC",
  ).all<Omit<Collector, "online">>();
  return results.map((c) => ({
    ...c,
    online:
      !c.revokedAt &&
      !!c.lastSeenAt &&
      Date.now() - Date.parse(c.lastSeenAt) <= 180_000,
  }));
}
export async function getProject(
  env: Env,
  id: string,
  user: Identity,
): Promise<Project> {
  await projectPermission(env, user, id);
  const row = await env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<ProjectRow>();
  if (!row) throw new HttpError(404, "Project not found.");
  return readProject(row);
}
export async function getProjectChecks(
  env: Env,
  project: Project,
): Promise<Check[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM checks WHERE project_id = ? ORDER BY rowid",
  )
    .bind(project.id)
    .all<CheckRow>();
  return results.map(readCheck).map((c) => ({
    ...c,
    enabled:
      c.enabled &&
      !project.deployments.some(
        (d) => d.id === c.deploymentId && !d.expectedRunning,
      ),
  }));
}
export function withHealth(
  project: Project,
  checks: Check[],
  collectors: Collector[],
): Project {
  const total = checks.filter((c) => c.enabled).length;
  const stale = checks.filter(
    (c) => c.enabled && checkHealth(c, collectors) === "unknown",
  ).length;
  return {
    ...project,
    health: projectHealth(checks, collectors),
    coverage: { total, fresh: total - stale, stale },
  };
}
export function auditStatement(
  env: Env,
  actor: string,
  action: string,
  detail: string,
  projectId: string | null = null,
) {
  return env.DB.prepare(
    "INSERT INTO audit (id, project_id, actor, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(),
    projectId,
    actor,
    action,
    detail.slice(0, 1000),
    new Date().toISOString(),
  );
}
export async function createProject(
  env: Env,
  input: unknown,
  actor: string,
): Promise<Project> {
  const data = projectInput.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let slug = data.slug || slugify(data.name);
  if (
    await env.DB.prepare("SELECT id FROM projects WHERE slug = ?")
      .bind(slug)
      .first()
  )
    slug = `${slug.slice(0, 54)}-${id.slice(0, 8)}`;
  const doc = { ...data, slug };
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO projects (id, slug, name, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, slug, data.name, JSON.stringify(doc), now, now),
    auditStatement(env, actor, "Project added", data.name, id),
  ]);
  return {
    ...doc,
    id,
    createdAt: now,
    updatedAt: now,
    health: "unknown",
    coverage: { total: 0, fresh: 0, stale: 0 },
  };
}
export async function updateProject(
  env: Env,
  id: string,
  input: unknown,
  actor: string,
) {
  const data = projectInput.parse(input);
  const now = new Date().toISOString();
  if (
    !(await env.DB.prepare("SELECT id FROM projects WHERE id = ?")
      .bind(id)
      .first())
  )
    throw new HttpError(404, "Project not found.");
  const slug = data.slug || slugify(data.name);
  const duplicate = await env.DB.prepare(
    "SELECT id FROM projects WHERE slug = ? AND id != ?",
  )
    .bind(slug, id)
    .first();
  if (duplicate)
    throw new HttpError(409, "Another project already uses this slug.");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE projects SET name = ?, slug = ?, document = ?, updated_at = ? WHERE id = ?",
    ).bind(data.name, slug, JSON.stringify({ ...data, slug }), now, id),
    auditStatement(env, actor, "Project updated", data.name, id),
  ]);
}
export async function listProjects(
  env: Env,
  user: Identity,
): Promise<Project[]> {
  const statement =
    user.role === "viewer"
      ? env.DB.prepare(
          "SELECT p.* FROM projects p JOIN project_access a ON a.project_id = p.id WHERE a.email = ? ORDER BY p.updated_at DESC LIMIT 500",
        ).bind(user.email)
      : env.DB.prepare(
          "SELECT * FROM projects ORDER BY updated_at DESC LIMIT 500",
        );
  return (await statement.all<ProjectRow>()).results.map(readProject);
}
export async function listIncidents(
  env: Env,
  user: Identity,
  projectId?: string,
): Promise<Incident[]> {
  const params: string[] = [];
  const where: string[] = [];
  if (projectId) {
    where.push("i.project_id = ?");
    params.push(projectId);
  } else {
    where.push("i.resolved_at IS NULL");
  }
  if (user.role === "viewer") {
    where.push(
      "EXISTS (SELECT 1 FROM project_access a WHERE a.project_id = i.project_id AND a.email = ?)",
    );
    params.push(user.email);
  }
  const sql = `SELECT i.id, i.project_id AS projectId, p.name AS projectName, i.check_id AS checkId, i.title, i.message, i.created_at AS createdAt, i.resolved_at AS resolvedAt FROM incidents i JOIN projects p ON p.id = i.project_id WHERE ${where.join(" AND ")} ORDER BY i.created_at DESC LIMIT 100`;
  return (
    await env.DB.prepare(sql)
      .bind(...params)
      .all<Incident>()
  ).results;
}
export async function listActivity(
  env: Env,
  user: Identity,
): Promise<AuditEvent[]> {
  const filter =
    user.role === "viewer"
      ? " WHERE EXISTS (SELECT 1 FROM project_access a WHERE a.project_id = audit.project_id AND a.email = ?)"
      : "";
  const stmt = env.DB.prepare(
    `SELECT id, project_id AS projectId, actor, action, detail, created_at AS createdAt FROM audit${filter} ORDER BY created_at DESC LIMIT 60`,
  );
  return (
    await (
      user.role === "viewer" ? stmt.bind(user.email) : stmt
    ).all<AuditEvent>()
  ).results;
}
export async function listJournal(
  env: Env,
  projectId: string,
): Promise<JournalEntry[]> {
  return (
    await env.DB.prepare(
      "SELECT id, project_id AS projectId, body, kind, created_at AS createdAt, actor FROM journal WHERE project_id = ? ORDER BY created_at DESC LIMIT 100",
    )
      .bind(projectId)
      .all<JournalEntry>()
  ).results;
}
