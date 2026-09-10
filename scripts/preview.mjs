import { spawn } from "node:child_process";
const worker = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--var",
    "ENVIRONMENT:development",
    "--port",
    "8787",
  ],
  { stdio: "inherit" },
);
const timer = setInterval(async () => {
  try {
    const response = await fetch(
      "http://127.0.0.1:8787/cdn-cgi/local/scheduled",
    );
    if (!response.ok)
      console.error("Local scheduler returned", response.status);
  } catch {}
}, 60000);
let stopped = false;
function stop() {
  if (stopped) return;
  stopped = true;
  clearInterval(timer);
  worker.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
worker.on("exit", () => {
  clearInterval(timer);
});
