"use client";
import { useState } from "react";
import {
  Cable,
  Download,
  Github,
  Laptop,
  Monitor,
  Plus,
  Server,
  Unplug,
  KeyRound,
} from "lucide-react";
import type { Workspace } from "@repo/registry";
import { api, download, relativeTime } from "../../lib/api";
import { Empty, ErrorNotice, Field, Panel } from "./ui";
export default function Connections({
  workspace,
  onChange,
  notify,
  onImport,
}: {
  workspace: Workspace;
  onChange: () => void;
  notify: (s: string) => void;
  onImport: () => void;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState<{
    id: string;
    name: string;
    token: string;
  } | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);
  const owner = workspace.role === "owner";
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setCredential(
        await api("/collectors", {
          method: "POST",
          body: JSON.stringify({ name }),
        }),
      );
      onChange();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!revoke) return;
    setBusy(true);
    try {
      await api(`/collectors/${revoke}`, { method: "DELETE" });
      setRevoke(null);
      onChange();
      notify("Collector credential revoked.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace connections</p>
          <h1>Your projects, wherever they run.</h1>
          <p>
            Connect local machines and source code to keep the details current.
          </p>
        </div>
        {owner && (
          <button
            className="button primary"
            onClick={() => {
              setRegister(true);
              setCredential(null);
              setName("");
            }}
          >
            <Plus size={16} />
            Register machine
          </button>
        )}
      </div>
      <ErrorNotice message={error} />
      <div className="connection-overview">
        <Cable size={25} />
        <div>
          <h3>Local checks. One central view.</h3>
          <p>
            A collector runs on each Mac or Windows machine and reports over
            HTTPS. Docker and Tailscale addresses stay on your private network.
          </p>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          Machines{" "}
          <span className="count-label">
            {workspace.collectors.filter((c) => !c.revokedAt).length}
          </span>
        </h2>
        <span className="muted small-text">
          A heartbeat is expected every minute
        </span>
      </div>
      {workspace.collectors.length ? (
        <div className="machine-grid">
          {workspace.collectors.map((c) => (
            <article
              className={`machine ${c.revokedAt ? "revoked" : ""}`}
              key={c.id}
            >
              <div className="machine-head">
                {c.platform === "win32" ? (
                  <Monitor size={25} />
                ) : (
                  <Laptop size={25} />
                )}
                <span
                  className={`health ${c.online ? "health-operational" : "health-unknown"}`}
                >
                  <i />
                  {c.revokedAt
                    ? "Revoked"
                    : c.online
                      ? "Connected"
                      : c.lastSeenAt
                        ? "Offline"
                        : "Awaiting setup"}
                </span>
              </div>
              <h3>{c.name}</h3>
              <p>{c.platform || "Platform detected on first connection"}</p>
              <div className="machine-foot">
                <span>Last seen {relativeTime(c.lastSeenAt)}</span>
                {owner && !c.revokedAt && (
                  <button
                    className="text-button"
                    onClick={() => setRevoke(c.id)}
                  >
                    Revoke
                    <Unplug size={14} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Bring your local projects into view">
          <p>
            Register your Mac and Windows machine, then run a collector on each
            one.
          </p>
          {owner && (
            <button className="button" onClick={() => setRegister(true)}>
              <Plus size={15} />
              Register a machine
            </button>
          )}
        </Empty>
      )}
      <div className="integration-grid">
        <article className="integration">
          <Github size={25} />
          <div>
            <h3>GitHub</h3>
            <p>
              Import repository details and detect your technology stack from
              source manifests.
            </p>
            <span className="small-text muted">
              {workspace.githubConfigured
                ? "Server credential configured"
                : "Public repositories work without a token. Private repositories need a read-only token."}
            </span>
          </div>
          {owner && (
            <button className="button" onClick={onImport}>
              Import repository
            </button>
          )}
        </article>
        <article className="integration">
          <KeyRound size={25} />
          <div>
            <h3>Agent access</h3>
            <p>
              Each project has a structured context export. An optional
              read-only API token gives your agent access to the registry.
            </p>
            <span className="small-text muted">
              Configure AGENT_READ_TOKEN as a Worker secret. It grants
              workspace-wide read access, never writes.
            </span>
          </div>
        </article>
      </div>
      {register && (
        <Panel
          title={credential ? "Connect your machine" : "Register a machine"}
          subtitle={
            credential
              ? "This credential is shown only during setup."
              : "Create a separate collector credential for each computer."
          }
          onClose={() => {
            setRegister(false);
            setCredential(null);
          }}
        >
          {credential ? (
            <div className="sheet-body">
              <div className="setup-success">
                <Server size={24} />
                <h3>{credential.name} is registered</h3>
                <p>
                  Download the configuration and keep it on that machine. Treat
                  the file as a password.
                </p>
              </div>
              <button
                className="button primary full-width"
                onClick={() =>
                  download("collector.json", {
                    portalUrl: window.location.origin,
                    token: credential.token,
                    allowDocker: true,
                    heartbeatSeconds: 60,
                  })
                }
              >
                <Download size={16} />
                Download collector.json
              </button>
              <ol className="setup-steps">
                <li>
                  Clone the OpsGlass repository onto the machine and install
                  Node.js 22.18 or later.
                </li>
                <li>
                  Put <code>collector.json</code> somewhere private. It contains
                  this machine’s credential; do not share or commit it.
                </li>
                <li>
                  Start the collector:
                  <pre>
                    <code>
                      node scripts/collector.mjs run --config collector.json
                    </code>
                  </pre>
                </li>
                <li>
                  Add a check to a project and choose this collector. Docker
                  must be available to the user running it.
                </li>
              </ol>
              <p className="muted small-text">
                The collector inspects container state. It cannot restart
                containers or run project commands.
              </p>
              <button
                className="button full-width"
                onClick={() => {
                  setRegister(false);
                  setCredential(null);
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={create} className="sheet-form">
              <div className="sheet-body">
                <ErrorNotice message={error} />
                <Field label="Machine name">
                  <input
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Windows Docker server"
                  />
                </Field>
                <p className="muted">
                  The collector connects outbound. You do not need to open a
                  port on this computer.
                </p>
              </div>
              <div className="sheet-footer">
                <button
                  className="button"
                  type="button"
                  onClick={() => setRegister(false)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? "Registering…" : "Register machine"}
                </button>
              </div>
            </form>
          )}
        </Panel>
      )}
      {revoke && (
        <Panel title="Revoke collector access?" onClose={() => setRevoke(null)}>
          <div className="sheet-body">
            <p>
              This machine will stop reporting. Its last observations will
              become unknown. Your projects and check history remain available.
            </p>
            <ErrorNotice message={error} />
          </div>
          <div className="sheet-footer">
            <button className="button" onClick={() => setRevoke(null)}>
              Keep connected
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Revoke credential
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
