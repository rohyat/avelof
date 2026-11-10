CREATE TABLE IF NOT EXISTS enquiries (
  reference TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hotel', 'package', 'car', 'contact')),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  adults INTEGER NOT NULL CHECK (adults BETWEEN 1 AND 100),
  children INTEGER NOT NULL CHECK (children BETWEEN 0 AND 100),
  details TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL CHECK (json_valid(fields_json)),
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS enquiries_created_at ON enquiries (created_at);

CREATE TABLE IF NOT EXISTS enquiry_rate_limits (
  bucket INTEGER NOT NULL,
  client_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (bucket, client_hash)
);