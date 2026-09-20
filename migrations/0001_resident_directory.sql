CREATE TABLE IF NOT EXISTS resident_applications (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  misc TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_resident_applications_email ON resident_applications (email);
CREATE INDEX IF NOT EXISTS idx_resident_applications_status ON resident_applications (status);

CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE REFERENCES resident_applications(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  misc TEXT,
  show_email INTEGER NOT NULL DEFAULT 0,
  show_phone INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_resident ON magic_link_tokens (resident_id);

CREATE TABLE IF NOT EXISTS resident_sessions (
  session_hash TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resident_sessions_resident ON resident_sessions (resident_id);

CREATE TABLE IF NOT EXISTS resident_audit_log (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  application_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
