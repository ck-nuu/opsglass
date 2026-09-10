import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
const root = process.cwd();
await mkdir("apps/web/out", { recursive: true });
function child(file, args, options = {}) {
  return spawn(process.execPath, [path.join(root, file), ...args], {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}
const migrate = child("node_modules/wrangler/bin/wrangler.js", [
  "d1",
  "migrations",
  "apply",
  "opsglass",
  "--local",
]);
const code = await new Promise((resolve) => migrate.once("exit", resolve));
if (code !== 0) process.exit(code || 1);
const worker = child("node_modules/wrangler/bin/wrangler.js", [
  "dev",
  "--local",
  "--var",
  "ENVIRONMENT:development",
  "--port",
  "8787",
]);
const web = child(
  "node_modules/next/dist/bin/next",
  ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: path.join(root, "apps/web"),
    env: { ...process.env, OPSG_DEV_PROXY: "1" },
  },
);
const timer = setInterval(async () => {
  try {
    await fetch("http://127.0.0.1:8787/cdn-cgi/local/scheduled");
  } catch {}
}, 60000);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  worker.kill();
  web.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
worker.on("exit", stop);
web.on("exit", stop);
