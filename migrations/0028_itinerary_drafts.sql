CREATE TABLE itinerary_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
