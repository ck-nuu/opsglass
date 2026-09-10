"use client";
import { useState } from "react";
import type { Check, Collector, Project } from "@repo/registry";
import { api } from "../../lib/api";
import { Panel, Field, ErrorNotice } from "./ui";
export default function CheckForm({
  project,
  collectors,
  initial,
  onClose,
  onSaved,
}: {
  project: Project;
  collectors: Collector[];
  initial?: Check;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    name: "",
    kind: "http",
    target: "",
    runner: "cloud",
    collectorId: "",
    deploymentId: "",
    interval: 600,
    timeout: 8000,
    expectedStatus: 200,
    expectedValue: "",
    critical: true,
    enabled: true,
    failureThreshold: 2,
    recoveryThreshold: 2,
    ...initial,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        initial ? `/checks/${initial.id}` : `/projects/${project.id}/checks`,
        { method: initial ? "PUT" : "POST", body: JSON.stringify(draft) },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={initial ? "Edit health check" : "Add a health check"}
      subtitle="Choose what to observe and where the check should run."
      onClose={onClose}
    >
      <form className="sheet-form" onSubmit={save}>
        <div className="sheet-body form-grid">
          <ErrorNotice message={error} />
          <Field label="Check name" wide>
            <input
              autoFocus
              required
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Production website"
            />
          </Field>
          <Field label="Type">
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  kind: e.target.value,
                  runner: ["ssl", "ping", "docker"].includes(e.target.value)
                    ? "collector"
                    : d.runner,
                }))
              }
            >
              {[
                ["http", "HTTP response"],
                ["dns", "DNS A record"],
                ["ssl", "TLS certificate"],
                ["ping", "Ping"],
                ["docker", "Docker container"],
              ].map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Monitor from"
            hint="This is the probe location, not the app's hosting provider. Use Cloudflare for public services such as Vercel."
          >
            <select
              value={draft.runner}
              onChange={(e) => update("runner", e.target.value)}
            >
              <option
                value="cloud"
                disabled={["ssl", "ping", "docker"].includes(draft.kind)}
              >
                Cloudflare edge · public URL
              </option>
              <option value="collector">
                Local collector · private or local target
              </option>
            </select>
          </Field>
          {draft.runner === "collector" && (
            <Field label="Collector" wide>
              <select
                required
                value={draft.collectorId}
                onChange={(e) => update("collectorId", e.target.value)}
              >
                <option value="">Choose a machine</option>
                {collectors
                  .filter((c) => !c.revokedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field
            label={
              draft.kind === "docker"
                ? "Container name or ID"
                : draft.kind === "http"
                  ? "URL"
                  : "Hostname or address"
            }
            hint={
              draft.runner === "cloud"
                ? "Cloud checks reach public hosts. Use a collector for local or Tailscale addresses."
                : draft.kind === "docker"
                  ? "Enable Docker in the collector configuration."
                  : "The collector checks this address from its own machine."
            }
            wide
          >
            <input
              required
              value={draft.target}
              onChange={(e) => update("target", e.target.value)}
              placeholder={
                draft.kind === "http"
                  ? "https://your-app.example/health"
                  : draft.kind === "docker"
                    ? "my-app"
                    : ""
              }
            />
          </Field>
          <Field label="Deployment" wide>
            <select
              value={draft.deploymentId}
              onChange={(e) => update("deploymentId", e.target.value)}
            >
              <option value="">Project-wide check</option>
              {project.deployments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.environment}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Check every">
            <select
              value={draft.interval}
              onChange={(e) => update("interval", Number(e.target.value))}
            >
              {(draft.runner === "cloud"
                ? [600, 900, 1800, 3600, 86400]
                : [60, 300, 600, 900, 1800, 3600, 86400]
              ).map((s) => (
                <option key={s} value={s}>
                  {s >= 3600
                    ? `${s / 3600} hour${s > 3600 ? "s" : ""}`
                    : `${s / 60} minutes`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timeout">
            <select
              value={draft.timeout}
              onChange={(e) => update("timeout", Number(e.target.value))}
            >
              {[3000, 5000, 8000, 10000].map((s) => (
                <option key={s} value={s}>
                  {s / 1000} seconds
                </option>
              ))}
            </select>
          </Field>
          {draft.kind === "http" && (
            <Field label="Expected HTTP status">
              <input
                type="number"
                min={100}
                max={599}
                value={draft.expectedStatus}
                onChange={(e) =>
                  update("expectedStatus", Number(e.target.value))
                }
              />
            </Field>
          )}
          {draft.kind === "dns" && (
            <Field label="Expected A record (optional)">
              <input
                value={draft.expectedValue}
                onChange={(e) => update("expectedValue", e.target.value)}
              />
            </Field>
          )}
          <Field label="Failures before incident">
            <input
              type="number"
              min={1}
              max={10}
              value={draft.failureThreshold}
              onChange={(e) =>
                update("failureThreshold", Number(e.target.value))
              }
            />
          </Field>
          <Field label="Passes before recovery">
            <input
              type="number"
              min={1}
              max={10}
              value={draft.recoveryThreshold}
              onChange={(e) =>
                update("recoveryThreshold", Number(e.target.value))
              }
            />
          </Field>
          <label className="checkbox-field span-2">
            <input
              type="checkbox"
              checked={draft.critical}
              onChange={(e) => update("critical", e.target.checked)}
            />
            Critical to this project
          </label>
          <label className="checkbox-field span-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => update("enabled", e.target.checked)}
            />
            Monitoring enabled
          </label>
        </div>
        <div className="sheet-footer">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save check"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
