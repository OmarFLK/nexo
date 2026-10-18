CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role='owner'),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX single_owner ON users(role);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);
