PRAGMA foreign_keys = ON;
CREATE TABLE projects (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE collectors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL DEFAULT '', token_hash TEXT NOT NULL UNIQUE,
  last_seen_at TEXT, created_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE checks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document TEXT NOT NULL CHECK(json_valid(document)), runner TEXT NOT NULL CHECK(runner IN ('cloud','collector')),
  collector_id TEXT REFERENCES collectors(id), enabled INTEGER NOT NULL DEFAULT 1,
  interval_seconds INTEGER NOT NULL DEFAULT 600, status TEXT NOT NULL DEFAULT 'unknown', latest_status TEXT NOT NULL DEFAULT 'unknown',
  observed_at TEXT, scheduled_at TEXT, next_run_at TEXT NOT NULL, lease_id TEXT, lease_until TEXT,
  failures INTEGER NOT NULL DEFAULT 0, successes INTEGER NOT NULL DEFAULT 0, latency REAL, message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX checks_due ON checks(runner, enabled, next_run_at);
CREATE INDEX checks_project ON checks(project_id);
CREATE INDEX checks_collector ON checks(collector_id);
CREATE TABLE check_results (
  id TEXT PRIMARY KEY, check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  status TEXT NOT NULL, latency REAL, message TEXT NOT NULL, observed_at TEXT NOT NULL
);
CREATE INDEX results_recent ON check_results(check_id, observed_at DESC);
CREATE INDEX results_expiry ON check_results(observed_at);
CREATE TABLE incidents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE, title TEXT NOT NULL, message TEXT NOT NULL,
  created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE UNIQUE INDEX one_open_incident ON incidents(check_id) WHERE resolved_at IS NULL;
CREATE INDEX incident_project ON incidents(project_id, created_at DESC);
CREATE TABLE journal (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, actor TEXT NOT NULL
);
CREATE INDEX journal_project ON journal(project_id, created_at DESC);
CREATE TABLE audit (
  id TEXT PRIMARY KEY, project_id TEXT, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX audit_time ON audit(created_at DESC);
CREATE TABLE monitor_state (id INTEGER PRIMARY KEY CHECK(id=1), last_tick_at TEXT, last_cleanup_at TEXT);
INSERT INTO monitor_state(id) VALUES(1);
CREATE TABLE project_access (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE, created_at TEXT NOT NULL,
  PRIMARY KEY(project_id, email)
);
CREATE INDEX access_email ON project_access(email);
