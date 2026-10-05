CREATE TABLE monitoring_credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('basic', 'bearer', 'cloudflare_access')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX monitoring_credentials_name ON monitoring_credentials(name COLLATE NOCASE);
