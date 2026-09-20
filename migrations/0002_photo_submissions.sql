CREATE TABLE IF NOT EXISTS photo_submissions (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL REFERENCES residents(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('events', 'critters', 'weather', 'neighborhood')),
  credit TEXT,
  content_type TEXT NOT NULL,
  object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('screening', 'cleared', 'specialist_review', 'high_risk', 'rejected', 'published', 'withdrawn')),
  provider_verdict TEXT,
  provider_reference TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  published_at TEXT,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_photo_submissions_status ON photo_submissions (status);
CREATE INDEX IF NOT EXISTS idx_photo_submissions_resident ON photo_submissions (resident_id);
