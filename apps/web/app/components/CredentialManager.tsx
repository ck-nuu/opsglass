"use client";
import { useState } from "react";
import { KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type {
  CredentialKind,
  CredentialSummary,
  Workspace,
} from "@repo/registry";
import { api, relativeTime } from "../../lib/api";
import { Empty, ErrorNotice, Field, Panel } from "./ui";

const kindLabels: Record<CredentialKind, string> = {
  basic: "Username and password",
  bearer: "Bearer token",
  cloudflare_access: "Cloudflare Access service token",
};

export default function CredentialManager({
  workspace,
  onChange,
  notify,
}: {
  workspace: Workspace;
  onChange: () => void;
  notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState<
    CredentialSummary | null | undefined
  >();
  const [remove, setRemove] = useState<CredentialSummary | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CredentialKind>("basic");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open(item: CredentialSummary | null) {
    setEditing(item);
    setName(item?.name || "");
    setKind(item?.kind || "basic");
    setUsername("");
    setPassword("");
    setToken("");
    setClientId("");
    setClientSecret("");
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const secret =
      kind === "basic"
        ? { username, password }
        : kind === "bearer"
          ? { token }
          : { clientId, clientSecret };
    try {
      await api(editing ? `/credentials/${editing.id}` : "/credentials", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ name, kind, ...secret }),
      });
      setEditing(undefined);
      onChange();
      notify(
        editing
          ? "Monitoring credential replaced."
          : "Monitoring credential added.",
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCredential() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      await api(`/credentials/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      onChange();
      notify("Monitoring credential deleted.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-heading spaced">
        <div>
          <h2>
            Monitoring credentials{" "}
            <span className="count-label">{workspace.credentials.length}</span>
          </h2>
          <p>
            Encrypted credentials for HTTP health checks. Secret values are
            never shown again or included in exports.
          </p>
        </div>
        <button
          className="button small"
          disabled={!workspace.credentialVaultConfigured}
          onClick={() => open(null)}
        >
          <Plus size={15} />
          Add credential
        </button>
      </div>
      {!workspace.credentialVaultConfigured ? (
        <div className="error-notice" role="status">
          Set the Worker secret <code>CREDENTIAL_ENCRYPTION_KEY</code> before
          adding monitoring credentials.
        </div>
      ) : workspace.credentials.length ? (
        <div className="machine-grid credential-grid">
          {workspace.credentials.map((credential) => (
            <article className="machine" key={credential.id}>
              <div className="machine-head">
                <ShieldCheck size={25} />
                <span className="health health-operational">
                  <i /> Encrypted
                </span>
              </div>
              <h3>{credential.name}</h3>
              <p>{kindLabels[credential.kind]}</p>
              <div className="machine-foot credential-actions">
                <span>Updated {relativeTime(credential.updatedAt)}</span>
                <span>
                  <button
                    className="icon-button"
                    aria-label={`Replace ${credential.name}`}
                    onClick={() => open(credential)}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${credential.name}`}
                    onClick={() => {
                      setError("");
                      setRemove(credential);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No monitoring credentials yet">
          <p>
            Add one when a health endpoint requires Basic Auth, a bearer token,
            or Cloudflare Access.
          </p>
          <button className="button" onClick={() => open(null)}>
            <KeyRound size={15} />
            Add credential
          </button>
        </Empty>
      )}

      {editing !== undefined && (
        <Panel
          title={
            editing
              ? "Replace monitoring credential"
              : "Add monitoring credential"
          }
          subtitle={
            editing
              ? "Enter the complete replacement secret. Existing checks keep using this credential."
              : "The secret is encrypted before it is stored and cannot be recovered in the portal."
          }
          onClose={() => setEditing(undefined)}
        >
          <form className="sheet-form" onSubmit={save}>
            <div className="sheet-body form-grid">
              <ErrorNotice message={error} />
              <Field label="Name" wide>
                <input
                  autoFocus
                  required
                  maxLength={300}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Production Basic Auth"
                />
              </Field>
              <Field label="Authentication type" wide>
                <select
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as CredentialKind)
                  }
                >
                  {Object.entries(kindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {kind === "basic" && (
                <>
                  <Field label="Username">
                    <input
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      required
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                </>
              )}
              {kind === "bearer" && (
                <Field label="Bearer token" wide>
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                </Field>
              )}
              {kind === "cloudflare_access" && (
                <>
                  <Field label="Access Client ID">
                    <input
                      required
                      autoComplete="off"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                    />
                  </Field>
                  <Field label="Access Client Secret">
                    <input
                      required
                      type="password"
                      autoComplete="off"
                      value={clientSecret}
                      onChange={(event) => setClientSecret(event.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="sheet-footer">
              <button
                type="button"
                className="button"
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : editing
                    ? "Replace credential"
                    : "Save credential"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {remove && (
        <Panel
          title="Delete monitoring credential?"
          onClose={() => setRemove(null)}
        >
          <div className="sheet-body">
            <p>
              Delete <strong>{remove.name}</strong>? OpsGlass will refuse if a
              health check still uses it.
            </p>
            <ErrorNotice message={error} />
          </div>
          <div className="sheet-footer">
            <button className="button" onClick={() => setRemove(null)}>
              Keep credential
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() => void deleteCredential()}
            >
              Delete credential
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}
