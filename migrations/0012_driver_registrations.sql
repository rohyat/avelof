CREATE TABLE driver_registrations (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  private_json TEXT NOT NULL,
  details_json TEXT NOT NULL,
  photo_keys_json TEXT NOT NULL,
  submitted_price REAL NOT NULL CHECK (submitted_price > 0),
  price REAL NOT NULL CHECK (price > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  version INTEGER NOT NULL DEFAULT 0,
  owner_note TEXT NOT NULL DEFAULT '',
  publication_consent INTEGER NOT NULL CHECK (publication_consent = 1),
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX driver_registrations_status ON driver_registrations (status, created_at DESC, id);
