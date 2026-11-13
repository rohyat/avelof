CREATE TABLE registration_photos (
  photo_key TEXT PRIMARY KEY,
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 1048576),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
