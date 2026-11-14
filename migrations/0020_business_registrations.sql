CREATE TABLE business_registrations (
  id TEXT PRIMARY KEY,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  details_json TEXT NOT NULL,
  photo_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 0,
  owner_note TEXT NOT NULL DEFAULT '',
  publication_consent INTEGER NOT NULL CHECK (publication_consent = 1),
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX business_registrations_status ON business_registrations (status, created_at DESC, id);
