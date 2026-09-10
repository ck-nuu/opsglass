import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// @ts-expect-error Standalone Node collector has no declaration file.
import { discover, localProbe, run } from "../scripts/collector.mjs";
test("folder discovery skips secrets, dependencies, and symlinked projects", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opsglass-scan-"));
  try {
    await mkdir(path.join(root, "app", "node_modules", "hidden"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "app", "package.json"),
      JSON.stringify({
        name: "real-project",
        scripts: { dev: "next dev" },
        dependencies: { next: "16" },
      }),
    );
    await writeFile(path.join(root, "app", ".env"), "SECRET=do-not-export");
    await writeFile(
      path.join(root, "app", "node_modules", "hidden", "package.json"),
      "{}",
    );
    await symlink(path.join(root, "app"), path.join(root, "linked-app"));
    await mkdir(path.join(root, ".external-git"));
    await writeFile(
      path.join(root, ".external-git", "config"),
      '[remote "origin"]\nurl = https://github.com/private/should-not-read.git',
    );
    await symlink(
      path.join(root, ".external-git"),
      path.join(root, "app", ".git"),
    );
    const result = await discover(root, false);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].name, "real-project");
    assert.equal(result.candidates[0].repository, "");
    assert(!JSON.stringify(result).includes("do-not-export"));
    assert.equal(result.candidates[0].commands.dev, "npm run dev");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("Docker access is explicit and disabled collectors report unknown", async () => {
  const result = await localProbe(
    { kind: "docker", target: "app", timeout: 1000 },
    { allowDocker: false },
  );
  assert.equal(result.status, "unknown");
  const invalid = await localProbe(
    { kind: "docker", target: "--help", timeout: 1000 },
    { allowDocker: true },
  );
  assert.equal(invalid.status, "major_outage");
});

test("a slow collector probe does not block other assigned results", async () => {
  const originalFetch = globalThis.fetch;
  const originalSignals = new Map(
    (["SIGINT", "SIGTERM"] as const).map((event) => [
      event,
      process.listeners(event),
    ]),
  );
  const submitted: string[] = [];
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  const fallback = setTimeout(releaseSlow, 1000);
  const assignments = ["slow", "fast"].map((id) => ({
    id,
    name: id,
    leaseId: `lease-${id}`,
    kind: "http",
    target: `https://probe.example/${id}`,
    timeout: 1000,
    expectedStatus: 200,
  }));
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith("/heartbeat"))
      return Response.json({ checks: assignments });
    if (url.endsWith("/results")) {
      const body = JSON.parse(String(init?.body));
      submitted.push(body.checkId);
      assert.equal(body.status, "operational");
      if (body.checkId === "fast") releaseSlow();
      return Response.json({ accepted: true });
    }
    if (url.endsWith("/slow")) await slow;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  try {
    await run(
      { portalUrl: "https://portal.example", token: "test-token" },
      true,
    );
    assert.deepEqual(submitted, ["fast", "slow"]);
  } finally {
    releaseSlow();
    clearTimeout(fallback);
    globalThis.fetch = originalFetch;
    for (const [event, existing] of originalSignals)
      for (const listener of process.listeners(event))
        if (!existing.includes(listener))
          process.removeListener(event, listener);
  }
});
