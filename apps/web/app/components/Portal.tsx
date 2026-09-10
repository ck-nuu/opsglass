"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Monitor,
  Plus,
  Search,
  Settings2,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  lifecycles,
  lifecycleLabels,
  type Project,
  type Workspace,
} from "@repo/registry";
import { ApiError, api, download, relativeTime } from "../../lib/api";
import { demoWorkspace } from "../../lib/demo";
import { ErrorNotice, HealthBadge, LifecycleBadge, Stack } from "./ui";
import ProjectForm from "./ProjectForm";
import ProjectDetail from "./ProjectDetail";
import Connections from "./Connections";
import ImportPanel from "./ImportPanel";
function Mark() {
  return (
    <svg
      viewBox="0 0 36 36"
      width="31"
      height="31"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="32" height="32" rx="7" fill="currentColor" />
      <rect
        x="9"
        y="9"
        width="18"
        height="18"
        rx="1"
        stroke="var(--canvas)"
        strokeWidth="1.6"
      />
      <path
        d="M9 19h6l3-6 4 12 2-6h3"
        stroke="var(--canvas)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default function Portal() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = params.get("demo") === "1";
  const view = params.get("view") || "projects";
  const projectId = params.get("project");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const [stackFilter, setStackFilter] = useState("all");
  const [layout, setLayout] = useState("list");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [form, setForm] = useState<Partial<Project> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const load = useCallback(async () => {
    if (demo) {
      setWorkspace(demoWorkspace());
      setError("");
      setLoading(false);
      return;
    }
    try {
      setWorkspace(await api<Workspace>("/workspace"));
      setNeedsSignIn(false);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNeedsSignIn(true);
        setWorkspace(null);
      }
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const adjust = () => setLayout(media.matches ? "grid" : "list");
    adjust();
    media.addEventListener("change", adjust);
    return () => media.removeEventListener("change", adjust);
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  function navigate(next: string, id?: string) {
    const search = new URLSearchParams();
    if (next !== "projects") search.set("view", next);
    if (id) search.set("project", id);
    if (demo) search.set("demo", "1");
    router.push(`/${search.size ? "?" + search : ""}`);
  }
  const projects = workspace?.projects || [];
  const owner = workspace?.role === "owner";
  const chosen = projects.find((p) => p.id === projectId);
  const attention = projects.filter(
    (p) =>
      p.lifecycle !== "archived" &&
      (p.health === "major_outage" ||
        p.health === "degraded" ||
        p.coverage.stale > 0 ||
        (["idea", "building", "paused"].includes(p.lifecycle) &&
          !p.nextAction.trim())),
  );
  const technologies = [
    ...new Set(projects.flatMap((p) => p.stack.map((s) => s.name))),
  ].sort();
  const filtered = projects.filter(
    (p) =>
      (lifecycle === "all"
        ? p.lifecycle !== "archived"
        : p.lifecycle === lifecycle) &&
      (stackFilter === "all" || p.stack.some((s) => s.name === stackFilter)) &&
      (!attentionOnly || attention.some((a) => a.id === p.id)) &&
      [
        p.name,
        p.description,
        p.organisation,
        p.nextAction,
        ...p.tags,
        ...p.stack.map((s) => s.name),
        ...p.deployments.map((d) => d.provider),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const failed = projects.filter((p) =>
    ["major_outage", "degraded"].includes(p.health),
  ).length;
  async function exportInventory() {
    try {
      download(
        `opsglass-inventory-${new Date().toISOString().slice(0, 10)}.json`,
        await api("/inventory/export"),
      );
      notify("Inventory exported. Store the file privately.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("projects")}
            aria-label="OpsGlass home"
          >
            <Mark />
            <span>OpsGlass</span>
            <span className="brand-divider" />
            <small>Your workspace</small>
          </button>
          <nav aria-label="Main navigation">
            {[
              ["projects", "Projects", FolderKanban],
              ["activity", "Activity", Activity],
              ...(owner || demo
                ? [["connections", "Connections", Settings2]]
                : []),
            ].map(([id, label, Icon]) => {
              const ItemIcon = Icon as typeof Activity;
              return (
                <button
                  key={id as string}
                  onClick={() => navigate(id as string)}
                  className={view === id ? "active" : ""}
                  aria-current={view === id ? "page" : undefined}
                >
                  <ItemIcon size={16} />
                  {label as string}
                </button>
              );
            })}
          </nav>
          <div className="header-right">
            <span className="private-label">
              <i />
              Private workspace
            </span>
            <span className="avatar" title={workspace?.user || "OpsGlass"}>
              {demo ? "D" : (workspace?.user || "O").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>
            <CircleHelp size={15} />
            Demo workspace · illustrative data, read-only
          </span>
          <button onClick={() => router.push("/")}>
            Open your workspace
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <main id="main" className="main-container">
        {loading ? (
          <div className="loading-workspace">
            <div className="skeleton-title" />
            <div className="skeleton-metrics" />
            <div className="skeleton-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="sr-only">Loading workspace</span>
          </div>
        ) : error && !workspace ? (
          <div className="connection-error">
            <div className="empty-symbol">
              <AlertCircle size={30} />
            </div>
            <p className="eyebrow">
              {needsSignIn ? "Your private workspace" : "Workspace unavailable"}
            </p>
            <h1>
              {needsSignIn
                ? "Welcome to OpsGlass."
                : "We couldn’t open OpsGlass."}
            </h1>
            <ErrorNotice message={error} />
            <div>
              {needsSignIn ? (
                <a className="button primary" href="/api/auth/login">
                  Sign in with Cloudflare <ArrowRight size={16} />
                </a>
              ) : (
                <button className="button primary" onClick={() => void load()}>
                  <RefreshCw size={16} /> Try again
                </button>
              )}
              <button
                className="button"
                onClick={() => router.push("/?demo=1")}
              >
                Explore the demo
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          workspace && (
            <>
              {error && (
                <ErrorNotice
                  message={`Refresh failed. The view may be out of date. ${error}`}
                />
              )}
              {chosen ? (
                <ProjectDetail
                  project={chosen}
                  collectors={workspace.collectors}
                  owner={!!owner}
                  demo={demo}
                  onBack={() => navigate("projects")}
                  onEdit={() => setForm(chosen)}
                  onChange={() => void load()}
                  notify={notify}
                />
              ) : projectId ? (
                <div className="inline-empty">
                  <h2>Project not found</h2>
                  <p>
                    This project may have been removed or is not shared with
                    your account.
                  </p>
                  <button
                    className="button"
                    onClick={() => navigate("projects")}
                  >
                    Back to projects
                  </button>
                </div>
              ) : view === "connections" && (owner || demo) ? (
                <Connections
                  workspace={workspace}
                  onChange={() => void load()}
                  notify={notify}
                  onImport={() => setImportOpen(true)}
                />
              ) : view === "activity" ? (
                <>
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">Workspace timeline</p>
                      <h1>A record of what changed.</h1>
                      <p>
                        Project updates, monitoring setup, and the context you
                        leave behind.
                      </p>
                    </div>
                  </div>
                  <div className="activity-feed">
                    {workspace.activity.length ? (
                      workspace.activity.map((event) => (
                        <article key={event.id}>
                          <div className="activity-symbol">
                            <Activity size={16} />
                          </div>
                          <div>
                            <h3>{event.action}</h3>
                            <p>{event.detail}</p>
                            <small>{event.actor}</small>
                          </div>
                          <time>{relativeTime(event.createdAt)}</time>
                          {event.projectId && (
                            <button
                              className="icon-button"
                              aria-label={`Open ${event.detail}`}
                              onClick={() =>
                                navigate("projects", event.projectId!)
                              }
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          )}
                        </article>
                      ))
                    ) : (
                      <div className="inline-empty">
                        <h3>Your workspace starts here.</h3>
                        <p>
                          Changes will appear as you add projects and save
                          progress.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        Your work, in perspective{" "}
                        <span className="eyebrow-line" />
                      </div>
                      <h1>Every project. A clearer picture.</h1>
                      <p>
                        Know what’s running, what needs attention, and where to
                        pick up.
                      </p>
                    </div>
                    <div className="heading-actions">
                      {owner && (
                        <>
                          <button
                            className="button"
                            onClick={() => setImportOpen(true)}
                          >
                            <ArrowDownToLine size={16} />
                            Import projects
                          </button>
                          <button
                            className="button primary"
                            onClick={() => setForm({})}
                          >
                            <Plus size={17} />
                            New project
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <section className="metrics" aria-label="Workspace summary">
                    <div>
                      <span>Total projects</span>
                      <strong>
                        {projects.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Across your workspace</small>
                    </div>
                    <div>
                      <span>
                        Live projects
                        <i className="metric-dot green" />
                      </span>
                      <strong>
                        {projects
                          .filter((p) => p.lifecycle === "live")
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <small>In active use</small>
                    </div>
                    <div>
                      <span>
                        Needs attention
                        <i className="metric-dot amber" />
                      </span>
                      <strong>
                        {attention.length.toString().padStart(2, "0")}
                      </strong>
                      <small>
                        {failed
                          ? `${failed} with health issues`
                          : "Health and missing context"}
                      </small>
                    </div>
                    <div>
                      <span>Local machines</span>
                      <strong>
                        {workspace.collectors
                          .filter((c) => !c.revokedAt)
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <small>
                        {workspace.collectors.filter((c) => c.online).length}{" "}
                        reporting now
                      </small>
                    </div>
                  </section>
                  {projects.length > 0 && attention.length > 0 && (
                    <div className="attention-strip">
                      <div>
                        <AlertCircle size={18} />
                        <span>
                          <strong>
                            {attention.length} project
                            {attention.length === 1 ? "" : "s"} could use a
                            look.
                          </strong>{" "}
                          {failed
                            ? "Check recent failures and stale observations."
                            : "Fill in missing context or review stale observations."}
                        </span>
                      </div>
                      <button onClick={() => setAttentionOnly(!attentionOnly)}>
                        {attentionOnly
                          ? "Show all projects"
                          : "Review attention"}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  <section className="portfolio">
                    <div className="portfolio-heading">
                      <div>
                        <h2>Project directory</h2>
                        <span className="count-label">{filtered.length}</span>
                      </div>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Refresh workspace"
                          onClick={async () => {
                            setRefreshing(true);
                            await load();
                            setRefreshing(false);
                          }}
                        >
                          <RefreshCw
                            size={15}
                            className={refreshing ? "spinning" : ""}
                          />
                        </button>
                        <span className="last-sync">
                          {demo
                            ? "Sample data"
                            : workspace.mode === "development"
                              ? "Local development"
                              : "Updates every 30s"}
                        </span>
                      </div>
                    </div>
                    {(projects.length > 0 || query) && (
                      <div className="toolbar">
                        <div className="search-input">
                          <Search size={17} />
                          <input
                            ref={searchRef}
                            aria-label="Search projects"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search projects, stack, or hosting…"
                          />
                          <kbd>/</kbd>
                        </div>
                        <div className="filters">
                          <select
                            aria-label="Filter by lifecycle"
                            value={lifecycle}
                            onChange={(e) => setLifecycle(e.target.value)}
                          >
                            <option value="all">All active projects</option>
                            {lifecycles.map((l) => (
                              <option key={l} value={l}>
                                {lifecycleLabels[l]}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label="Filter by technology"
                            value={stackFilter}
                            onChange={(e) => setStackFilter(e.target.value)}
                          >
                            <option value="all">All technologies</option>
                            {technologies.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <div className="view-toggle">
                            <button
                              aria-label="List view"
                              aria-pressed={layout === "list"}
                              className={layout === "list" ? "active" : ""}
                              onClick={() => setLayout("list")}
                            >
                              <List size={17} />
                            </button>
                            <button
                              aria-label="Grid view"
                              aria-pressed={layout === "grid"}
                              className={layout === "grid" ? "active" : ""}
                              onClick={() => setLayout("grid")}
                            >
                              <LayoutGrid size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {attentionOnly && (
                      <div className="filter-label">
                        Needs attention
                        <button
                          className="icon-button"
                          aria-label="Clear attention filter"
                          onClick={() => setAttentionOnly(false)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    {!projects.length ? (
                      <div className="empty-portfolio">
                        <div className="empty-map" aria-hidden="true">
                          <span className="map-node node-one">
                            <GitBranch size={20} />
                          </span>
                          <span className="map-node node-two">
                            <Monitor size={20} />
                          </span>
                          <span className="map-node node-center">
                            <Mark />
                          </span>
                          <span className="map-node node-three">
                            <Activity size={20} />
                          </span>
                          <i className="map-line line-one" />
                          <i className="map-line line-two" />
                          <i className="map-line line-three" />
                        </div>
                        <p className="eyebrow">Make room for your next idea</p>
                        <h2>A home for everything you build.</h2>
                        <p>
                          Add your first project to bring its stack, hosting,
                          health,
                          <br className="desktop-break" /> and working context
                          into one place.
                        </p>
                        {owner ? (
                          <div>
                            <button
                              className="button primary"
                              onClick={() => setForm({})}
                            >
                              <Plus size={16} />
                              Add your first project
                            </button>
                            <button
                              className="text-button"
                              onClick={() => setImportOpen(true)}
                            >
                              Import from GitHub
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        ) : (
                          <p>No projects have been shared with you yet.</p>
                        )}
                        <button
                          className="demo-link"
                          onClick={() => router.push("/?demo=1")}
                        >
                          See an example workspace
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    ) : !filtered.length ? (
                      <div className="inline-empty">
                        <Search size={23} />
                        <h3>No projects match this view.</h3>
                        <button
                          className="text-button"
                          onClick={() => {
                            setQuery("");
                            setLifecycle("all");
                            setStackFilter("all");
                            setAttentionOnly(false);
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : layout === "list" ? (
                      <div className="project-table-wrap">
                        <table className="project-table">
                          <thead>
                            <tr>
                              <th>Project</th>
                              <th>Technology</th>
                              <th>Hosting</th>
                              <th>Lifecycle</th>
                              <th>Health</th>
                              <th>Last worked</th>
                              <th>
                                <span className="sr-only">Open</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((p, i) => (
                              <tr key={p.id}>
                                <td>
                                  <button
                                    className="project-name-button"
                                    onClick={() => navigate("projects", p.id)}
                                  >
                                    <span
                                      className={`project-monogram tone-${i % 4}`}
                                    >
                                      {p.name.slice(0, 2).toUpperCase()}
                                    </span>
                                    <span>
                                      <strong>{p.name}</strong>
                                      <small>
                                        {p.description || p.organisation}
                                      </small>
                                    </span>
                                  </button>
                                </td>
                                <td>
                                  <Stack items={p.stack} limit={3} />
                                </td>
                                <td>
                                  <span className="hosting-label">
                                    {p.deployments[0]?.provider ||
                                      "Not recorded"}
                                  </span>
                                  <small className="table-subtext">
                                    {p.deployments[0]?.environment ||
                                      "No deployment"}
                                    {p.deployments.length > 1
                                      ? ` +${p.deployments.length - 1}`
                                      : ""}
                                  </small>
                                </td>
                                <td>
                                  <LifecycleBadge value={p.lifecycle} />
                                </td>
                                <td>
                                  <HealthBadge health={p.health} />
                                  {p.coverage.stale > 0 && (
                                    <small className="table-subtext">
                                      {p.coverage.stale} stale
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <span className="time-label">
                                    {relativeTime(p.lastWorkedAt)}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="icon-button row-open"
                                    aria-label={`Open ${p.name}`}
                                    onClick={() => navigate("projects", p.id)}
                                  >
                                    <ArrowUpRight size={17} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="project-grid">
                        {filtered.map((p, i) => (
                          <button
                            className="project-card"
                            key={p.id}
                            onClick={() => navigate("projects", p.id)}
                          >
                            <div className="project-card-top">
                              <span
                                className={`project-monogram tone-${i % 4}`}
                              >
                                {p.name.slice(0, 2).toUpperCase()}
                              </span>
                              <HealthBadge health={p.health} />
                            </div>
                            <h3>{p.name}</h3>
                            <p>{p.description || "No description yet."}</p>
                            <Stack items={p.stack} limit={3} />
                            <div className="project-card-bottom">
                              <LifecycleBadge value={p.lifecycle} />
                              <span>
                                {relativeTime(p.lastWorkedAt)}
                                <ArrowUpRight size={15} />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {projects.length > 0 && (
                      <div className="portfolio-footer">
                        <span>
                          {filtered.length} of {projects.length} projects
                          {lifecycle === "all"
                            ? " · archived projects hidden"
                            : ""}
                        </span>
                        {owner && (
                          <button
                            className="text-button"
                            onClick={() => void exportInventory()}
                          >
                            <ArrowDownToLine size={14} />
                            Export inventory
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                  {projects.length > 0 && (
                    <div className="workspace-note">
                      <span>
                        <span className="dot-outline" />A green status means
                        fresh observations. Unknown means there’s more to learn.
                      </span>
                      <span>Built for the long run.</span>
                    </div>
                  )}
                </>
              )}
            </>
          )
        )}
      </main>
      <footer className="app-footer">
        <div>
          <Mark />
          <span>One workspace. Every project.</span>
        </div>
        <span>
          OpsGlass <span className="footer-version">01</span>
          {workspace?.mode === "production" && (
            <form method="post" action="/api/auth/logout">
              <button type="submit" className="text-button">
                Sign out
              </button>
            </form>
          )}
        </span>
      </footer>
      {form && workspace && (
        <ProjectForm
          initial={form}
          collectors={workspace.collectors}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setForm(null);
            void load();
            navigate("projects", id);
            notify("Project saved.");
          }}
        />
      )}
      {importOpen && owner && (
        <ImportPanel
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            void load();
          }}
          notify={notify}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
