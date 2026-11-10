CREATE TABLE reviews (
  id TEXT PRIMARY KEY NOT NULL,
  reviewer_name TEXT NOT NULL,
  booking_id TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  review_text TEXT NOT NULL,
  publication_consent INTEGER NOT NULL CHECK (publication_consent = 1),
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT
);

CREATE INDEX reviews_status_published ON reviews (status, published_at);
CREATE INDEX reviews_status_created ON reviews (status, created_at);