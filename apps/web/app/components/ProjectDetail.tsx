"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Terminal,
  Clock3,
  BookOpen,
  GitBranch,
  Server,
  Users,
  X,
} from "lucide-react";
import {
  checkHealth,
  type Project,
  type Check,
  type Collector,
  type JournalEntry,
  type Incident,
  type CheckResult,
} from "@repo/registry";
import { api, download, relativeTime } from "../../lib/api";
import {
  Empty,
  ErrorNotice,
  ExternalLink,
  HealthBadge,
  LifecycleBadge,
  Stack,
} from "./ui";
import CheckForm from "./CheckForm";
type Detail = {
  project: Project;
  checks: Check[];
  journal: JournalEntry[];
  incidents: Incident[];
  results: CheckResult[];
};
export default function ProjectDetail({
  project,
  collectors,
  owner,
  demo,
  onBack,
  onEdit,
  onChange,
  notify,
}: {
  project: Project;
  collectors: Collector[];
  owner: boolean;
  demo: boolean;
  onBack: () => void;
  onEdit: () => void;
  onChange: () => void;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<Detail>({
    project,
    checks: [],
    journal: [],
    incidents: [],
    results: [],
  });
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [checkForm, setCheckForm] = useState<Check | null | undefined>(
    undefined,
  );
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("handoff");
  const [busy, setBusy] = useState("");
  const [access, setAccess] = useState<{ email: string }[]>([]);
  const [email, setEmail] = useState("");
  async function refresh() {
    if (demo) return;
    try {
      setData(await api<Detail>(`/projects/${project.id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (demo) {
      setData({ project, checks: [], journal: [], incidents: [], results: [] });
      return;
    }
    let current = true;
    const load = () =>
      api<Detail>(`/projects/${project.id}`)
        .then((d) => {
          if (current) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [project, demo]);
  useEffect(() => {
    if (tab === "access" && owner && !demo)
      api<{ email: string }[]>(`/projects/${project.id}/access`)
        .then(setAccess)
        .catch((e) => setError(e.message));
  }, [tab, project.id, owner, demo]);
  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    setBusy("note");
    try {
      await api(`/projects/${project.id}/journal`, {
        method: "POST",
        body: JSON.stringify({ body: note, kind }),
      });
      setNote("");
      await refresh();
      onChange();
      notify("Project context saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function run(check: Check) {
    setBusy(check.id);
    try {
      const result = await api<{ message: string }>(`/checks/${check.id}/run`, {
        method: "POST",
      });
      notify(result.message);
      await refresh();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function share(e: React.FormEvent) {
    e.preventDefault();
    setBusy("share");
    try {
      await api(`/projects/${project.id}/access`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setAccess(await api(`/projects/${project.id}/access`));
      setEmail("");
      notify("Project access saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function unshare(email: string) {
    try {
      await api(`/projects/${project.id}/access`, {
        method: "DELETE",
        body: JSON.stringify({ email }),
      });
      setAccess(access.filter((a) => a.email !== email));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const p = data.project;
  return (
    <>
      <button className="text-button back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        All projects
      </button>
      <div className="detail-header">
        <div className="project-monogram large">
          {p.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="detail-title">
          <div className="inline-meta">
            <span>{p.organisation || "Personal"}</span>
            <span>/</span>
            <LifecycleBadge value={p.lifecycle} />
          </div>
          <h1>{p.name}</h1>
          <p>{p.description || "Add a short description of this project."}</p>
        </div>
        <div className="detail-actions">
          <HealthBadge health={p.health} />
          {owner && (
            <button className="button" onClick={onEdit}>
              <Edit3 size={15} />
              Edit project
            </button>
          )}
        </div>
      </div>
      <ErrorNotice message={error} />
      <div className="tabs detail-tabs">
        {[
          ["overview", "Overview"],
          ["resources", "Stack & hosting"],
          ["monitoring", "Monitoring"],
          ["journal", "Project memory"],
          ...(owner ? [["access", "Access"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id!)}
          >
            {label}
            {id === "monitoring" && <span>{data.checks.length}</span>}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="skeleton-lines" aria-label="Loading project">
          <i />
          <i />
          <i />
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="detail-grid">
              <div className="detail-main">
                <section className="resume-panel">
                  <div className="eyebrow">
                    <BookOpen size={14} />
                    Pick up where you left off
                  </div>
                  <h2>{p.nextAction || "What comes next?"}</h2>
                  <p>
                    {p.nextAction
                      ? "Your next action, ready when you are."
                      : "Record the next action so you can return to this project with a clear starting point."}
                  </p>
                  <div className="resume-footer">
                    <span>
                      <Clock3 size={14} />
                      Last worked {relativeTime(p.lastWorkedAt)}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => setTab("journal")}
                    >
                      Open project memory
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </section>
                {p.blockers && (
                  <section className="content-section">
                    <h3>Current blockers</h3>
                    <p className="preserve-space">{p.blockers}</p>
                  </section>
                )}
                <section className="content-section">
                  <div className="section-heading">
                    <h3>Run this project</h3>
                    <Terminal size={17} />
                  </div>
                  {Object.values(p.commands).some(Boolean) ? (
                    Object.entries(p.commands)
                      .filter(([, v]) => v)
                      .map(([key, value]) => (
                        <div className="command" key={key}>
                          <span>
                            {key === "dev"
                              ? "Development"
                              : key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                          <div>
                            <code>{value}</code>
                            <button
                              className="icon-button"
                              aria-label={`Copy ${key} command`}
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(value)
                                  .then(() => notify("Command copied."))
                                  .catch(() =>
                                    notify(
                                      "Could not access the clipboard. Select and copy the command.",
                                    ),
                                  )
                              }
                            >
                              <Copy size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <Empty title="Startup instructions are missing">
                      <p>
                        Add setup, development, test, and deployment commands.
                      </p>
                      {owner && (
                        <button className="text-button" onClick={onEdit}>
                          Add instructions
                          <Plus size={14} />
                        </button>
                      )}
                    </Empty>
                  )}
                </section>
                {p.notes && (
                  <section className="content-section">
                    <h3>Architecture & notes</h3>
                    <p className="preserve-space">{p.notes}</p>
                  </section>
                )}
              </div>
              <aside className="detail-aside">
                <section>
                  <h3>At a glance</h3>
                  <dl className="facts">
                    <div>
                      <dt>Owner</dt>
                      <dd>{p.owner || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>Monitoring</dt>
                      <dd>
                        {p.coverage.fresh} / {p.coverage.total} checks fresh
                      </dd>
                    </div>
                    <div>
                      <dt>Deployments</dt>
                      <dd>{p.deployments.length}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>Technology</h3>
                  <Stack items={p.stack} limit={10} />
                </section>
                <section>
                  <h3>Quick links</h3>
                  {p.resources.length ? (
                    p.resources.slice(0, 6).map((r) => (
                      <div className="quick-link" key={r.id}>
                        <ExternalLink href={r.url}>{r.name}</ExternalLink>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No links recorded yet.</p>
                  )}
                </section>
                <button
                  className="button full-width"
                  onClick={async () => {
                    try {
                      download(
                        `${p.slug}-context.json`,
                        demo
                          ? { project: p }
                          : await api(`/projects/${p.id}/context`),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Download size={15} />
                  Export agent context
                </button>
              </aside>
            </div>
          )}
          {tab === "resources" && (
            <div className="resource-layout">
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>Technology stack</h2>
                    <p>
                      Evidence from your source code, alongside the details you
                      add.
                    </p>
                  </div>
                  {owner && (
                    <button className="button small" onClick={onEdit}>
                      Edit stack
                    </button>
                  )}
                </div>
                {p.stack.length ? (
                  <div className="stack-table">
                    {p.stack.map((s, i) => (
                      <div key={`${s.name}-${i}`}>
                        <span className="technology-icon">
                          {s.name.slice(0, 2)}
                        </span>
                        <strong>{s.name}</strong>
                        <code>{s.version || "Version not recorded"}</code>
                        <span>{s.category}</span>
                        <small title={s.source}>{s.source}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="No technologies recorded">
                    <p>
                      Import a repository or add the stack in your project
                      details.
                    </p>
                  </Empty>
                )}
              </section>
              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>Where it runs</h2>
                    <p>
                      Local and hosted deployments, with their own environments.
                    </p>
                  </div>
                  {owner && (
                    <button className="button small" onClick={onEdit}>
                      <Plus size={14} />
                      Add deployment
                    </button>
                  )}
                </div>
                {p.deployments.length ? (
                  <div className="deployment-grid">
                    {p.deployments.map((d) => (
                      <article key={d.id} className="deployment">
                        <div className="deployment-heading">
                          <Server size={19} />
                          <span className="environment">{d.environment}</span>
                        </div>
                        <h3>{d.name}</h3>
                        <p>{d.provider || "Provider not recorded"}</p>
                        {d.machineId && (
                          <p className="muted">
                            {collectors.find((c) => c.id === d.machineId)
                              ?.name || "Machine not assigned"}
                          </p>
                        )}
                        {d.localPath && (
                          <code className="path">{d.localPath}</code>
                        )}
                        <div className="deployment-links">
                          {d.url && (
                            <ExternalLink href={d.url}>
                              Open application
                            </ExternalLink>
                          )}
                          {d.dashboardUrl && (
                            <ExternalLink href={d.dashboardUrl}>
                              Dashboard
                            </ExternalLink>
                          )}
                        </div>
                        <span className="muted small-text">
                          {d.expectedRunning
                            ? "Expected to be running"
                            : "Intentionally stopped · checks suspended"}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="Hosting details are missing">
                    <p>
                      Add a deployment for each local, staging, or production
                      environment.
                    </p>
                  </Empty>
                )}
              </section>
              <section className="content-section">
                <h2>Resources</h2>
                {p.resources.length ? (
                  p.resources.map((r) => (
                    <div className="resource-line" key={r.id}>
                      <GitBranch size={17} />
                      <div>
                        <ExternalLink href={r.url}>{r.name}</ExternalLink>
                        <p>
                          {[r.kind, r.provider, r.environment]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {r.note && <p>{r.note}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty title="No resources linked yet" />
                )}
              </section>
            </div>
          )}
          {tab === "monitoring" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Health checks</h2>
                  <p>
                    A passing check cannot hide another check’s failure. Missing
                    observations stay unknown.
                  </p>
                </div>
                {owner && (
                  <button
                    className="button primary"
                    onClick={() => setCheckForm(null)}
                  >
                    <Plus size={15} />
                    Add check
                  </button>
                )}
              </div>
              {data.checks.length ? (
                <div className="checks-list">
                  {data.checks.map((c) => (
                    <article className="check-row" key={c.id}>
                      <div className="check-heading">
                        <div>
                          <span className="eyebrow">
                            {c.kind} ·{" "}
                            {c.runner === "cloud"
                              ? "Cloudflare edge"
                              : collectors.find((m) => m.id === c.collectorId)
                                  ?.name || "Collector"}
                          </span>
                          <h3>{c.name}</h3>
                          <code className="muted">{c.target}</code>
                        </div>
                        <HealthBadge health={checkHealth(c, collectors)} />
                      </div>
                      <p>{c.message || "Waiting for the first observation."}</p>
                      <div className="check-footer">
                        <span>
                          Observed {relativeTime(c.observedAt)} · every{" "}
                          {Math.round(c.interval / 60)}m
                          {c.latency !== null
                            ? ` · ${Math.round(c.latency)} ms`
                            : ""}
                        </span>
                        {owner && (
                          <div>
                            <button
                              className="text-button"
                              onClick={() => setCheckForm(c)}
                            >
                              Edit
                            </button>
                            <button
                              className="button small"
                              disabled={!c.enabled || busy === c.id}
                              onClick={() => void run(c)}
                            >
                              <RefreshCw
                                size={13}
                                className={busy === c.id ? "spinning" : ""}
                              />
                              {busy === c.id ? "Checking…" : "Check now"}
                            </button>
                          </div>
                        )}
                      </div>
                      {c.latestStatus !== c.status && c.observedAt && (
                        <small className="muted">
                          Latest sample: {c.latestStatus.replace("_", " ")}.
                          Waiting for the configured confirmation threshold.
                        </small>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <Empty title="No checks configured">
                  <p>
                    Start with an HTTP check for a hosted app, or a Docker check
                    on a local collector.
                  </p>
                </Empty>
              )}
              <section className="content-section">
                <h2>Incident history</h2>
                {data.incidents.length ? (
                  data.incidents.map((i) => (
                    <div className="incident-line" key={i.id}>
                      <span
                        className={
                          i.resolvedAt ? "event-dot green" : "event-dot amber"
                        }
                      />
                      <div>
                        <strong>{i.title}</strong>
                        <p>{i.message}</p>
                        <small>
                          {new Date(i.createdAt).toLocaleString()} ·{" "}
                          {i.resolvedAt ? "Resolved" : "Open"}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No incidents recorded.</p>
                )}
              </section>
              <section className="content-section">
                <h2>Recent observations</h2>
                {data.results.length ? (
                  <div className="results-table">
                    {data.results.slice(0, 20).map((r) => (
                      <div key={r.id}>
                        <span>
                          {data.checks.find((c) => c.id === r.checkId)?.name ||
                            "Check"}
                        </span>
                        <HealthBadge health={r.status} />
                        <span>
                          {r.latency !== null
                            ? `${Math.round(r.latency)} ms`
                            : "—"}
                        </span>
                        <time>{relativeTime(r.observedAt)}</time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Results appear after the first check completes. Raw
                    observations are retained for seven days.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "journal" && (
            <div className="journal-layout">
              <section>
                <div className="section-heading">
                  <div>
                    <h2>Leave a useful trail</h2>
                    <p>
                      Decisions, progress, and handoffs that make returning
                      easier.
                    </p>
                  </div>
                </div>
                {owner && (
                  <form className="journal-form" onSubmit={saveNote}>
                    <select
                      aria-label="Entry type"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="handoff">Session handoff</option>
                      <option value="decision">Architecture decision</option>
                      <option value="note">Working note</option>
                    </select>
                    <textarea
                      aria-label="Project memory entry"
                      required
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={6}
                      placeholder="What changed? What is unfinished? What should happen next?"
                    />
                    <div>
                      <button
                        className="button primary"
                        disabled={busy === "note" || !note.trim()}
                      >
                        {busy === "note" ? "Saving…" : "Save to project memory"}
                      </button>
                    </div>
                  </form>
                )}
                {data.journal.length ? (
                  <div className="journal-timeline">
                    {data.journal.map((entry) => (
                      <article key={entry.id}>
                        <span className="timeline-node" />
                        <div className="inline-meta">
                          <span className="environment">{entry.kind}</span>
                          <time>
                            {new Date(entry.createdAt).toLocaleString()}
                          </time>
                        </div>
                        <p className="preserve-space">{entry.body}</p>
                        <small>{entry.actor}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="A fresh page">
                    <p>
                      Capture your next session here. Your future self will
                      thank you.
                    </p>
                  </Empty>
                )}
              </section>
              <aside className="memory-guide">
                <BookOpen size={24} />
                <h3>A good handoff answers…</h3>
                <p>What did you finish?</p>
                <p>What did you learn or decide?</p>
                <p>What is blocked?</p>
                <p>What is the next concrete step?</p>
                <span>
                  Keep the current next action in the project overview up to
                  date too.
                </span>
              </aside>
            </div>
          )}
          {tab === "access" && owner && (
            <div className="access-section">
              <Users size={26} />
              <h2>Share this project</h2>
              <p>
                Collaborators can view this project and its context. They cannot
                see your other projects, change settings, or control collectors.
              </p>
              <p className="muted">
                Also allow their email in your Cloudflare Access policy. Saving
                here grants project access; it does not send an invitation.
              </p>
              <form onSubmit={share} className="inline-form">
                <input
                  aria-label="Collaborator email"
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="button primary" disabled={busy === "share"}>
                  Grant view access
                </button>
              </form>
              {access.map((a) => (
                <div className="access-row" key={a.email}>
                  <span>{a.email}</span>
                  <span className="muted">Viewer</span>
                  <button
                    className="icon-button"
                    aria-label={`Remove access for ${a.email}`}
                    onClick={() => void unshare(a.email)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {checkForm !== undefined && (
        <CheckForm
          project={p}
          collectors={collectors}
          initial={checkForm || undefined}
          onClose={() => setCheckForm(undefined)}
          onSaved={() => {
            setCheckForm(undefined);
            void refresh();
            onChange();
            notify("Check saved.");
          }}
        />
      )}
    </>
  );
}
