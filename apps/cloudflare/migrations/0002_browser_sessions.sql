CREATE TABLE login_flows (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_flows_expiry ON login_flows(expires_at);
CREATE TABLE browser_sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX browser_sessions_expiry ON browser_sessions(expires_at);
CREATE TABLE login_rate_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_rate_limits_expiry ON login_rate_limits(expires_at);
