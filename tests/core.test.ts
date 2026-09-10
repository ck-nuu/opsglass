import test from "node:test";
import assert from "node:assert/strict";
import {
  checkHealth,
  projectHealth,
  transitionStatus,
  type Check,
  type Collector,
} from "@repo/registry";
import { detectStack } from "@repo/registry/discovery";
import { publicAddress, runCloudProbe } from "../apps/cloudflare/src/probes";
const check = (overrides: Partial<Check> = {}): Check => ({
  id: "a",
  projectId: "p",
  deploymentId: "",
  name: "HTTP",
  kind: "http",
  target: "https://example.com",
  runner: "cloud",
  collectorId: "",
  interval: 600,
  timeout: 5000,
  expectedStatus: 200,
  expectedValue: "",
  critical: true,
  enabled: true,
  failureThreshold: 2,
  recoveryThreshold: 2,
  status: "operational",
  latestStatus: "operational",
  observedAt: new Date().toISOString(),
  scheduledAt: null,
  latency: 10,
  message: "",
  failures: 0,
  successes: 0,
  ...overrides,
});
test("one passing check cannot hide a different failing check", () => {
  assert.equal(
    projectHealth([check({ status: "major_outage" }), check({ id: "dns" })]),
    "major_outage",
  );
});
test("unknown observations never turn a known outage green", () => {
  assert.equal(
    projectHealth([
      check({ status: "major_outage" }),
      check({ observedAt: null }),
    ]),
    "major_outage",
  );
  assert.equal(
    projectHealth([check(), check({ observedAt: null })]),
    "unknown",
  );
  assert.equal(projectHealth([]), "unknown");
});
test("stale samples and offline collectors become unknown", () => {
  assert.equal(
    checkHealth(
      check({ observedAt: new Date(Date.now() - 1600000).toISOString() }),
    ),
    "unknown",
  );
  const c: Collector = {
    id: "m",
    name: "Mac",
    platform: "darwin",
    createdAt: "",
    lastSeenAt: new Date(Date.now() - 181000).toISOString(),
    revokedAt: null,
    online: false,
  };
  assert.equal(
    checkHealth(check({ runner: "collector", collectorId: "m" }), [c]),
    "unknown",
  );
  assert.equal(checkHealth(check({ enabled: false })), "maintenance");
});
test("confirmation thresholds open and recover incidents without flapping", () => {
  const initial = check({ status: "unknown" });
  const first = transitionStatus(initial, "major_outage");
  assert.equal(first.status, "unknown");
  const second = transitionStatus({ ...initial, ...first }, "major_outage");
  assert.equal(second.status, "major_outage");
  const recovery1 = transitionStatus({ ...initial, ...second }, "operational");
  assert.equal(recovery1.status, "major_outage");
  const recovery2 = transitionStatus(
    { ...initial, ...recovery1 },
    "operational",
  );
  assert.equal(recovery2.status, "operational");
});
test("manifest discovery preserves component source and does not invent deployment facts", () => {
  const result = detectStack({
    "apps/web/package.json": JSON.stringify({
      dependencies: { next: "16.1.0", react: "19" },
    }),
    "services/api/requirements.txt": "fastapi==0.1\nsqlalchemy",
    "wrangler.jsonc": "{}",
  });
  assert(
    result.stack.some(
      (s) =>
        s.name === "Next.js" &&
        s.source === "apps/web/package.json" &&
        s.version === "16.1.0",
    ),
  );
  assert(result.stack.some((s) => s.name === "FastAPI"));
  assert(
    result.stack.some(
      (s) =>
        s.name === "Cloudflare Workers" &&
        s.category === "hosting configuration",
    ),
  );
  assert.equal(result.commands.dev, "");
});
test("cloud probes reject private targets and validate redirects", async () => {
  let calls = 0;
  const fetcher = async (input: RequestInfo | URL) => {
    calls++;
    const u = String(input);
    if (u.includes("dns-query"))
      return Response.json({
        Status: 0,
        Answer: [{ type: 1, data: "93.184.216.34" }],
      });
    return new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/private" },
    });
  };
  const result = await runCloudProbe(check(), fetcher as typeof fetch);
  assert.equal(result.status, "major_outage");
  assert.match(result.message, /Private addresses/);
  assert.equal(calls, 3);
  assert.equal(publicAddress("100.75.2.1"), false);
  assert.equal(publicAddress("192.168.1.2"), false);
  assert.equal(publicAddress("::ffff:127.0.0.1"), false);
});
