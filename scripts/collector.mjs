#!/usr/bin/env node
// Requires Node.js 22.18+ (native TypeScript stripping for the shared manifest detector).
import {
  readdir,
  readFile,
  writeFile,
  lstat,
  realpath,
  stat,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import tls from "node:tls";
import { pathToFileURL } from "node:url";
import {
  detectStack,
  manifestPattern,
} from "../packages/registry/src/discovery.ts";
const excluded = new Set([
  "node_modules",
  ".git",
  ".next",
  ".venv",
  "venv",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".wrangler",
  ".turbo",
  ".cache",
  "Library",
  "AppData",
]);
const safeContainer = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
export function command(binary, args, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      done(new Error(`${binary} timed out.`));
    }, timeout);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 500000) {
        child.kill();
        done(new Error(`${binary} output exceeded the safety limit.`));
      }
    });
    child.stderr.on("data", (data) => {
      if (stderr.length < 2000) stderr += data.toString();
    });
    child.on("error", (error) => done(error));
    child.on("close", (code) =>
      done(
        code === 0
          ? null
          : new Error(`${binary} exited with ${code}: ${stderr.slice(0, 300)}`),
        stdout,
      ),
    );
  });
}
async function readManifests(
  directory,
  root = directory,
  depth = 0,
  output = {},
) {
  if (depth > 3 || Object.keys(output).length >= 40) return output;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (
      item.isSymbolicLink() ||
      excluded.has(item.name) ||
      item.name.startsWith(".env")
    )
      continue;
    const full = path.join(directory, item.name);
    const relative = path.relative(root, full).split(path.sep).join("/");
    if (
      item.isFile() &&
      manifestPattern.test(relative) &&
      (await stat(full)).size <= 80000
    )
      output[relative] = await readFile(full, "utf8");
    if (
      item.isDirectory() &&
      ["apps", "packages", "services", "backend", "frontend"].includes(
        item.name,
      )
    )
      await readManifests(full, root, depth + 1, output);
    else if (item.isDirectory() && depth > 0 && depth < 2)
      await readManifests(full, root, depth + 1, output);
  }
  return output;
}
async function repositoryUrl(directory) {
  try {
    const gitDirectory = path.join(directory, ".git");
    if ((await lstat(gitDirectory)).isSymbolicLink()) return "";
    const configPath = path.join(gitDirectory, "config");
    if ((await lstat(configPath)).isSymbolicLink()) return "";
    const config = await readFile(configPath, "utf8");
    const origin =
      config
        .match(/\[remote "origin"\][^[]*?url\s*=\s*([^\r\n]+)/)?.[1]
        ?.trim() || "";
    const github = origin.match(
      /(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/,
    );
    return github ? `https://github.com/${github[1]}` : "";
  } catch {
    return "";
  }
}
export async function discover(root, includeDocker = false) {
  const base = await realpath(root);
  const candidates = [];
  const warnings = [];
  async function visit(directory, depth) {
    if (candidates.length >= 100 || depth > 2) return;
    const files = await readManifests(directory);
    const direct = Object.keys(files).filter((p) => !p.includes("/"));
    if (direct.length) {
      const detected = detectStack(files);
      let name = path.basename(directory),
        description = "";
      try {
        const p = JSON.parse(files["package.json"] || "{}");
        name =
          typeof p.name === "string" ? p.name.replace(/^@[^/]+\//, "") : name;
        description = typeof p.description === "string" ? p.description : "";
      } catch {}
      candidates.push({
        name,
        description,
        repository: await repositoryUrl(directory),
        localPath: directory,
        ...detected,
        source: `Local folder: ${os.hostname()}`,
        warnings: [
          ...detected.warnings,
          "Confirm the environment and hosting before enabling monitoring.",
        ],
      });
      return;
    }
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (
        item.isDirectory() &&
        !item.isSymbolicLink() &&
        !item.name.startsWith(".") &&
        !excluded.has(item.name)
      ) {
        try {
          await visit(path.join(directory, item.name), depth + 1);
        } catch {
          warnings.push(`Could not inspect ${item.name}.`);
        }
      }
    }
  }
  await visit(base, 0);
  if (includeDocker) {
    try {
      const rows = (
        await command("docker", ["ps", "-a", "--format", "{{json .}}"])
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      // Group Compose services into one project; do not claim that a local folder and a container definitely match.
      const groups = new Map();
      for (const row of rows.slice(0, 100)) {
        const compose = String(row.Labels || "").match(
          /(?:^|,)com\.docker\.compose\.project=([^,]+)/,
        )?.[1];
        const name = compose || String(row.Names || row.ID);
        const group = groups.get(name) || [];
        group.push(row);
        groups.set(name, group);
      }
      for (const [name, containers] of groups) {
        candidates.push({
          name,
          description: `Docker project on ${os.hostname()}: ${containers.map((c) => c.Names).join(", ")}`,
          repository: "",
          stack: [
            {
              name: "Docker",
              category: "infrastructure",
              source: `Docker metadata on ${os.hostname()}`,
            },
          ],
          commands: { setup: "", dev: "", test: "", deploy: "" },
          source: `Docker: ${os.hostname()}`,
          warnings: [
            `Containers: ${containers.map((c) => `${c.Names} (${c.Image})`).join(", ")}`,
            "Check for a matching folder project before importing to avoid duplicates.",
          ],
        });
      }
    } catch (error) {
      warnings.push(`Docker scan skipped: ${error.message}`);
    }
  }
  return {
    format: "opsglass-discovery",
    version: 1,
    scannedAt: new Date().toISOString(),
    machine: os.hostname(),
    candidates: candidates.slice(0, 100),
    warnings,
  };
}
export async function localProbe(check, config) {
  const start = Date.now();
  const timeout = Math.max(1000, Math.min(10000, check.timeout || 8000));
  try {
    if (check.kind === "http") {
      let target = new URL(check.target);
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password
      )
        throw new Error("Use an HTTP URL without embedded credentials.");
      const response = await fetch(target, {
        method: "GET",
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
      });
      await response.body?.cancel();
      return {
        status:
          response.status === check.expectedStatus
            ? "operational"
            : "major_outage",
        latency: Date.now() - start,
        message: `HTTP ${response.status}; expected ${check.expectedStatus}.`,
      };
    }
    if (check.kind === "docker") {
      if (!config.allowDocker)
        return {
          status: "unknown",
          latency: null,
          message:
            "Docker checks are disabled in this collector configuration.",
        };
      if (!safeContainer.test(check.target))
        throw new Error("Invalid container name or ID.");
      let state;
      try {
        state = JSON.parse(
          await command(
            "docker",
            ["inspect", "--format", "{{json .State}}", check.target],
            timeout,
          ),
        );
      } catch (error) {
        return {
          status: "unknown",
          latency: null,
          message: `Docker observation failed: ${error.message}`.slice(0, 500),
        };
      }
      const health = state.Health?.Status;
      const status = !state.Running
        ? "major_outage"
        : health === "unhealthy"
          ? "major_outage"
          : health === "starting"
            ? "unknown"
            : "operational";
      return {
        status,
        latency: Date.now() - start,
        message: `Container ${state.Status}${health ? `; health ${health}` : "; no Docker healthcheck configured"}.`,
      };
    }
    if (check.kind === "dns") {
      const resolver = new dns.Resolver({ timeout, tries: 1 });
      const records = await resolver.resolve4(check.target);
      const pass =
        records.length > 0 &&
        (!check.expectedValue || records.includes(check.expectedValue));
      return {
        status: pass ? "operational" : "major_outage",
        latency: Date.now() - start,
        message: pass
          ? `Resolved ${records.length} A records.`
          : "DNS records do not match the expected address.",
      };
    }
    if (check.kind === "ssl") {
      const parsed = new URL(
        check.target.includes("://") ? check.target : `https://${check.target}`,
      );
      if (parsed.username || parsed.password)
        throw new Error("Do not put credentials in a certificate target.");
      return await new Promise((resolve) => {
        let settled = false;
        const done = (result) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve({ ...result, latency: Date.now() - start });
        };
        const socket = tls.connect(
          {
            host: parsed.hostname,
            port: Number(parsed.port) || 443,
            servername: parsed.hostname,
            rejectUnauthorized: true,
          },
          () => {
            const certificate = socket.getPeerCertificate();
            const days = Math.floor(
              (Date.parse(certificate.valid_to) - Date.now()) / 86400000,
            );
            done({
              status:
                !Number.isFinite(days) || days < 0
                  ? "major_outage"
                  : days < 14
                    ? "degraded"
                    : "operational",
              message: Number.isFinite(days)
                ? `Certificate valid for ${days} more days.`
                : "Certificate validity could not be determined.",
            });
          },
        );
        socket.setTimeout(timeout, () =>
          done({ status: "major_outage", message: "TLS check timed out." }),
        );
        socket.on("error", (error) =>
          done({
            status: "major_outage",
            message: error.message.slice(0, 500),
          }),
        );
      });
    }
    if (check.kind === "ping") {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$/.test(check.target))
        throw new Error("Invalid ping target.");
      const args =
        process.platform === "win32"
          ? ["-n", "1", "-w", String(timeout), check.target]
          : ["-c", "1", check.target];
      try {
        await command("ping", args, timeout);
        return {
          status: "operational",
          latency: Date.now() - start,
          message: "Host responded to ping.",
        };
      } catch (error) {
        if (error.code === "ENOENT")
          return {
            status: "unknown",
            latency: null,
            message: "The ping executable is not available.",
          };
        throw error;
      }
    }
    return {
      status: "unknown",
      latency: null,
      message: "Unsupported check type. Update this collector.",
    };
  } catch (error) {
    return {
      status: "major_outage",
      latency: Date.now() - start,
      message: String(error.message || "Check failed.").slice(0, 500),
    };
  }
}
export async function run(config, once = false) {
  const base = new URL(config.portalUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && loopback))
    throw new Error(
      "The portal must use HTTPS, except for a local development portal.",
    );
  if (!config.token || typeof config.token !== "string")
    throw new Error("A collector token is required.");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`,
  };
  if (config.accessClientId && config.accessClientSecret) {
    headers["CF-Access-Client-Id"] = config.accessClientId;
    headers["CF-Access-Client-Secret"] = config.accessClientSecret;
  }
  async function post(route, body) {
    const response = await fetch(new URL(route, base), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok) {
      let message = `Portal returned ${response.status}.`;
      try {
        message = (await response.json()).error || message;
      } catch {}
      throw new Error(message);
    }
    return response.json();
  }
  let stopped = false;
  let timer;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  do {
    try {
      const assignment = await post("/api/v1/collector/heartbeat", {
        platform: process.platform,
      });
      console.log(
        `[${new Date().toISOString()}] Connected; ${assignment.checks.length} checks assigned.`,
      );
      // Every assignment has the same lease deadline. Run the bounded batch
      // together so one slow probe or upload cannot starve the others.
      const results = await Promise.allSettled(
        assignment.checks.slice(0, 5).map(async (check) => {
          if (stopped) return;
          const result = await localProbe(check, config);
          await post("/api/v1/collector/results", {
            checkId: check.id,
            leaseId: check.leaseId,
            ...result,
          });
          console.log(`${check.name}: ${result.status}`);
        }),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    } catch (error) {
      console.error(`Collector: ${error.message}`);
      if (once) throw error;
    }
    if (once || stopped) break;
    await new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        process.removeListener("SIGINT", finish);
        process.removeListener("SIGTERM", finish);
        resolve();
      };
      timer = setTimeout(
        finish,
        Math.max(60, config.heartbeatSeconds || 60) * 1000,
      );
      process.once("SIGINT", finish);
      process.once("SIGTERM", finish);
    });
  } while (!stopped);
}
async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args[0] === "scan") {
    const root = value("--root");
    if (!root)
      throw new Error(
        "Provide --root with a project folder or its parent directory.",
      );
    const result = await discover(root, args.includes("--docker"));
    const output = value("--output") || "discoveries.json";
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(
      `Found ${result.candidates.length} projects. Saved to ${output}. Nothing was uploaded.`,
    );
    for (const warning of result.warnings) console.warn(warning);
  } else if (args[0] === "run") {
    const file = value("--config");
    if (!file)
      throw new Error(
        "Provide --config with the collector configuration file.",
      );
    const config = JSON.parse(await readFile(file, "utf8"));
    await run(config, args.includes("--once"));
  } else {
    console.log(
      "OpsGlass collector\n\nScan: node scripts/collector.mjs scan --root /path/to/projects [--docker] [--output discoveries.json]\nRun:  node scripts/collector.mjs run --config collector.json [--once]\n\nRequires Node.js 22.18+ and the repository source. No project commands are executed.",
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
