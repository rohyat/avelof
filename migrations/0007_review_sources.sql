ALTER TABLE reviews ADD COLUMN submission_source TEXT NOT NULL DEFAULT 'guest_submission'
  CHECK (submission_source IN ('guest_submission', 'owner_provided'));

ALTER TABLE reviews ADD COLUMN source_key TEXT;

CREATE UNIQUE INDEX reviews_source_key ON reviews (source_key);