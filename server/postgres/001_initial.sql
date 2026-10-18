CREATE TABLE IF NOT EXISTS nexo_schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS nexo_workspace (
  id TEXT PRIMARY KEY CHECK (id='nexo'),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision>=0),
  state JSONB NOT NULL CHECK (jsonb_typeof(state)='object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nexo_commands (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nexo_audit (
  id TEXT PRIMARY KEY REFERENCES nexo_commands(id),
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nexo_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email=lower(email)),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' UNIQUE CHECK (role='owner'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nexo_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nexo_users(id) ON DELETE CASCADE,
  credential_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL
);
CREATE OR REPLACE FUNCTION nexo_protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are immutable'; END; $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='nexo_audit_immutable') THEN
    CREATE TRIGGER nexo_audit_immutable BEFORE UPDATE OR DELETE ON nexo_audit FOR EACH ROW EXECUTE FUNCTION nexo_protect_audit();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS nexo_session_expiry ON nexo_sessions(expires_at);
CREATE TABLE IF NOT EXISTS nexo_login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);
