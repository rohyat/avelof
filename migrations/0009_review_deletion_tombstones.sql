CREATE TABLE deleted_owner_review_sources (
  source_key TEXT PRIMARY KEY NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER reviews_record_owner_deletion
AFTER DELETE ON reviews
WHEN OLD.submission_source = 'owner_provided' AND OLD.source_key IS NOT NULL
BEGIN
  INSERT INTO deleted_owner_review_sources (source_key)
  VALUES (OLD.source_key)
  ON CONFLICT (source_key) DO NOTHING;
END;