export const lifecycles = [
  "idea",
  "building",
  "live",
  "paused",
  "completed",
  "archived",
] as const;
export type Lifecycle = (typeof lifecycles)[number];
export const healthStates = [
  "operational",
  "degraded",
  "major_outage",
  "unknown",
  "maintenance",
] as const;
export type Health = (typeof healthStates)[number];
export type CheckKind = "http" | "dns" | "ssl" | "ping" | "docker";
export type StackItem = {
  name: string;
  version?: string;
  category: string;
  source: string;
  detectedAt?: string;
};
export type Resource = {
  id: string;
  name: string;
  kind:
    | "repository"
    | "hosting"
    | "database"
    | "domain"
    | "documentation"
    | "service";
  url: string;
  environment: string;
  provider: string;
  note: string;
};
export type Deployment = {
  id: string;
  name: string;
  environment: string;
  provider: string;
  url: string;
  dashboardUrl: string;
  machineId: string;
  localPath: string;
  expectedRunning: boolean;
};
export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organisation: string;
  lifecycle: Lifecycle;
  owner: string;
  tags: string[];
  stack: StackItem[];
  resources: Resource[];
  deployments: Deployment[];
  commands: { setup: string; dev: string; test: string; deploy: string };
  nextAction: string;
  blockers: string;
  notes: string;
  lastWorkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  health: Health;
  coverage: { total: number; fresh: number; stale: number };
  checks?: Check[];
};
export type Check = {
  id: string;
  projectId: string;
  deploymentId: string;
  name: string;
  kind: CheckKind;
  target: string;
  runner: "cloud" | "collector";
  collectorId: string;
  interval: number;
  timeout: number;
  expectedStatus: number;
  expectedValue: string;
  critical: boolean;
  enabled: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
  status: Health;
  latestStatus: Health;
  observedAt: string | null;
  scheduledAt: string | null;
  latency: number | null;
  message: string;
  failures: number;
  successes: number;
  leaseId?: string;
  leaseUntil?: string;
};
export type Collector = {
  id: string;
  name: string;
  platform: string;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  online: boolean;
};
export type JournalEntry = {
  id: string;
  projectId: string;
  body: string;
  kind: "note" | "decision" | "handoff";
  createdAt: string;
  actor: string;
};
export type Incident = {
  id: string;
  projectId: string;
  projectName: string;
  checkId: string;
  title: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};
export type AuditEvent = {
  id: string;
  projectId: string | null;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
};
export type CheckResult = {
  id: string;
  checkId: string;
  status: Health;
  latency: number | null;
  message: string;
  observedAt: string;
};
export type ImportCandidate = {
  name: string;
  description: string;
  repository: string;
  localPath?: string;
  stack: StackItem[];
  commands: Project["commands"];
  warnings: string[];
  source: string;
};
export type Workspace = {
  projects: Project[];
  collectors: Collector[];
  incidents: Incident[];
  activity: AuditEvent[];
  user: string;
  role: "owner" | "viewer";
  mode: string;
  githubConfigured: boolean;
  monitor: {
    lastTickAt: string | null;
    dueChecks: number;
    activeChecks: number;
    batchSize: number;
  };
};

export const healthLabels: Record<Health, string> = {
  operational: "Healthy",
  degraded: "Degraded",
  major_outage: "Down",
  unknown: "Unknown",
  maintenance: "Paused",
};
export const lifecycleLabels: Record<Lifecycle, string> = {
  idea: "Idea",
  building: "Building",
  live: "Live",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};
export function isFresh(
  check: Pick<Check, "observedAt" | "interval">,
  now = Date.now(),
): boolean {
  if (!check.observedAt) return false;
  const age = now - Date.parse(check.observedAt);
  return (
    Number.isFinite(age) &&
    age >= -60_000 &&
    age <= Math.max(check.interval * 2.5, 180) * 1000
  );
}
export function checkHealth(
  check: Check,
  collectors: Collector[] = [],
  now = Date.now(),
): Health {
  if (!check.enabled) return "maintenance";
  if (check.runner === "collector") {
    const machine = collectors.find((c) => c.id === check.collectorId);
    if (
      !machine ||
      machine.revokedAt ||
      !machine.lastSeenAt ||
      now - Date.parse(machine.lastSeenAt) > 180_000
    )
      return "unknown";
  }
  return isFresh(check, now) ? check.status : "unknown";
}
export function projectHealth(
  checks: Check[],
  collectors: Collector[] = [],
  now = Date.now(),
): Project["health"] {
  const active = checks.filter((c) => c.enabled);
  if (!active.length) return "unknown";
  const observed = active.map((c) => ({
    health: checkHealth(c, collectors, now),
    critical: c.critical,
  }));
  if (observed.some((c) => c.health === "major_outage" && c.critical))
    return "major_outage";
  if (
    observed.some((c) => c.health === "major_outage" || c.health === "degraded")
  )
    return "degraded";
  if (observed.some((c) => c.health === "unknown")) return "unknown";
  return "operational";
}
export function transitionStatus(
  previous: Pick<
    Check,
    | "status"
    | "failures"
    | "successes"
    | "failureThreshold"
    | "recoveryThreshold"
  >,
  result: Health,
) {
  if (result === "unknown")
    return { status: "unknown" as Health, failures: 0, successes: 0 };
  const success = result === "operational";
  const failures = success ? 0 : previous.failures + 1;
  const successes = success ? previous.successes + 1 : 0;
  let status = previous.status;
  if (
    success &&
    (previous.status === "unknown" || successes >= previous.recoveryThreshold)
  )
    status = "operational";
  if (!success && failures >= previous.failureThreshold) status = result;
  if (
    !success &&
    previous.status === "unknown" &&
    failures < previous.failureThreshold
  )
    status = "unknown";
  return { status, failures, successes };
}
export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "project"
  );
}
export function emptyProject(): Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "health" | "coverage"
> {
  return {
    name: "",
    slug: "",
    description: "",
    organisation: "Personal",
    owner: "",
    lifecycle: "building",
    tags: [],
    stack: [],
    resources: [],
    deployments: [],
    commands: { setup: "", dev: "", test: "", deploy: "" },
    nextAction: "",
    blockers: "",
    notes: "",
    lastWorkedAt: null,
  };
}
