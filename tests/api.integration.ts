import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../apps/cloudflare/src/index";
import type { Env } from "../apps/cloudflare/src/env";

test("D1-backed API: access, inventory, collector isolation, thresholds, stale state, sharing and restore", async (t) => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: "test",
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: "2026-09-09",
      d1Databases: { DB: "opsglass-test" },
    }),
  );
  const db = await mf.getD1Database("DB", "test");
  const migrations = new URL("../apps/cloudflare/migrations/", import.meta.url);
  for (const name of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, migrations), "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  const keys = await generateKeyPair("RS256");
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    String(input).includes(
      "test-team.cloudflareaccess.com/cdn-cgi/access/certs",
    )
      ? Response.json({ keys: [jwk] })
      : originalFetch(input, init);
  const env = {
    DB: db,
    ENVIRONMENT: "production",
    ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
    ACCESS_AUD: "opsglass-test",
    ALLOWED_EMAILS: "owner@example.test",
    CHECK_BATCH_SIZE: "3",
    MAX_CLOUD_CHECKS: "30",
  } as unknown as Env;
  async function jwt(email: string) {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://test-team.cloudflareaccess.com")
      .setAudience("opsglass-test")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
  }
  const owner = await jwt("owner@example.test"),
    viewer = await jwt("viewer@example.test");
  async function req(
    path: string,
    method = "GET",
    body?: unknown,
    credential = owner,
    extra: Record<string, string> = {},
  ) {
    const headers: Record<string, string> = { ...extra };
    if (credential.startsWith("ogc_"))
      headers.Authorization = `Bearer ${credential}`;
    else if (credential) headers["Cf-Access-Jwt-Assertion"] = credential;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await worker.fetch(
      new Request(`https://opsglass.example/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
    return { status: response.status, body: (await response.json()) as any };
  }
  try {
    await t.test(
      "production rejects absent authentication and cross-origin writes",
      async () => {
        assert.equal(
          (await req("/workspace", "GET", undefined, "")).status,
          401,
        );
        assert.equal(
          (
            await req("/projects", "POST", { name: "forged" }, owner, {
              Origin: "https://evil.example",
            })
          ).status,
          403,
        );
        const locked = await worker.fetch(
          new Request("http://localhost/api/v1/workspace"),
          { ...env, ACCESS_AUD: "" },
        );
        assert.equal(locked.status, 503);
      },
    );
    const project = (
      await req("/projects", "POST", {
        name: "API integration project",
        description: "Test context",
        nextAction: "Keep tests passing",
        stack: [{ name: "TypeScript", category: "language", source: "manual" }],
      })
    ).body;
    const other = (await req("/projects", "POST", { name: "Private project" }))
      .body;
    assert(project.id && other.id);
    await t.test(
      "project data round-trips and malformed data is rejected",
      async () => {
        assert.equal(
          (await req(`/projects/${project.id}`)).body.project.nextAction,
          "Keep tests passing",
        );
        assert.equal(
          (await req("/projects", "POST", { name: "" })).status,
          400,
        );
        await req(`/projects/${project.id}/journal`, "POST", {
          kind: "handoff",
          body: "Completed the health pipeline.",
        });
        assert.equal(
          (await req(`/projects/${project.id}/context`)).body.journal.length,
          1,
        );
      },
    );
    const collector = (await req("/collectors", "POST", { name: "Mac test" }))
      .body;
    const intruder = (
      await req("/collectors", "POST", { name: "Other machine" })
    ).body;
    const check = (
      await req(`/projects/${project.id}/checks`, "POST", {
        name: "App HTTP",
        kind: "http",
        runner: "collector",
        collectorId: collector.id,
        target: "http://localhost:3000",
        interval: 60,
      })
    ).body;
    const dns = (
      await req(`/projects/${project.id}/checks`, "POST", {
        name: "App DNS",
        kind: "dns",
        runner: "collector",
        collectorId: collector.id,
        target: "example.com",
        interval: 60,
      })
    ).body;
    const heartbeat = () =>
      req(
        "/collector/heartbeat",
        "POST",
        { platform: "darwin" },
        collector.token,
      );
    const report = (assignment: any, status: string, token = collector.token) =>
      req(
        "/collector/results",
        "POST",
        {
          checkId: assignment.id,
          leaseId: assignment.leaseId,
          status,
          latency: 12,
          message: `Test ${status}`,
        },
        token,
      );
    const due = () =>
      db
        .prepare(
          "UPDATE checks SET next_run_at = '2000-01-01T00:00:00.000Z' WHERE project_id = ?",
        )
        .bind(project.id)
        .run();
    await t.test(
      "collectors cannot report for another machine or replay a result",
      async () => {
        const first = (await heartbeat()).body.checks;
        const assignment = first.find((c: any) => c.id === check.id);
        assert.equal(
          (await report(assignment, "major_outage", intruder.token)).status,
          409,
        );
        assert.equal(
          (await report(assignment, "major_outage")).body.accepted,
          true,
        );
        assert.equal((await report(assignment, "major_outage")).status, 409);
        await report(
          first.find((c: any) => c.id === dns.id),
          "operational",
        );
      },
    );
    await t.test(
      "two failing HTTP samples open an incident; passing DNS does not resolve it",
      async () => {
        await due();
        const assignments = (await heartbeat()).body.checks;
        await report(
          assignments.find((c: any) => c.id === check.id),
          "major_outage",
        );
        await report(
          assignments.find((c: any) => c.id === dns.id),
          "operational",
        );
        const detail = (await req(`/projects/${project.id}`)).body;
        assert.equal(detail.project.health, "major_outage");
        assert.equal(
          detail.incidents.filter((i: any) => !i.resolvedAt).length,
          1,
        );
      },
    );
    await t.test(
      "recovery requires consecutive passing observations of the failing check",
      async () => {
        await due();
        let assignments = (await heartbeat()).body.checks;
        await report(
          assignments.find((c: any) => c.id === check.id),
          "operational",
        );
        await report(
          assignments.find((c: any) => c.id === dns.id),
          "operational",
        );
        assert.equal(
          (await req(`/projects/${project.id}`)).body.project.health,
          "major_outage",
        );
        await due();
        assignments = (await heartbeat()).body.checks;
        await report(
          assignments.find((c: any) => c.id === check.id),
          "operational",
        );
        await report(
          assignments.find((c: any) => c.id === dns.id),
          "operational",
        );
        const detail = (await req(`/projects/${project.id}`)).body;
        assert.equal(detail.project.health, "operational");
        assert(detail.incidents[0].resolvedAt);
      },
    );
    await t.test(
      "offline machines make fresh historical samples unknown",
      async () => {
        await db
          .prepare(
            "UPDATE collectors SET last_seen_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
          )
          .bind(collector.id)
          .run();
        assert.equal(
          (await req(`/projects/${project.id}`)).body.project.health,
          "unknown",
        );
      },
    );
    await t.test(
      "viewers see only explicitly shared projects and cannot write",
      async () => {
        assert.equal(
          (await req("/workspace", "GET", undefined, viewer)).status,
          403,
        );
        await req(`/projects/${project.id}/access`, "POST", {
          email: "viewer@example.test",
        });
        const shared = (await req("/workspace", "GET", undefined, viewer)).body;
        assert.equal(shared.projects.length, 1);
        assert.equal(shared.projects[0].id, project.id);
        assert.equal(
          (await req(`/projects/${other.id}`, "GET", undefined, viewer)).status,
          404,
        );
        assert.equal(
          (await req("/projects", "POST", { name: "unauthorized" }, viewer))
            .status,
          403,
        );
        assert.equal(
          (await req("/collectors", "GET", undefined, viewer)).status,
          403,
        );
        await req(`/projects/${project.id}/access`, "DELETE", {
          email: "viewer@example.test",
        });
        assert.equal(
          (await req(`/projects/${project.id}`, "GET", undefined, viewer))
            .status,
          403,
        );
      },
    );
    await t.test(
      "revocation rejects further collector heartbeats",
      async () => {
        await req(`/collectors/${collector.id}`, "DELETE");
        assert.equal((await heartbeat()).status, 401);
      },
    );
    await t.test(
      "inventory export contains no credentials and restores project memory",
      async () => {
        const backup = (await req("/inventory/export")).body;
        assert.equal(backup.items.length, 2);
        assert(!JSON.stringify(backup).includes(collector.token));
        const restored = await req("/inventory/import", "POST", {
          ...backup,
          items: [backup.items.find((i: any) => i.project.id === project.id)],
        });
        assert.equal(restored.status, 201);
        const detail = (await req(`/projects/${restored.body.created[0]}`))
          .body;
        assert.equal(detail.journal[0].body, "Completed the health pipeline.");
        assert.equal(detail.checks.length, 0);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await mf.dispose();
  }
});
