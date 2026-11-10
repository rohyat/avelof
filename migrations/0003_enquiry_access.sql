ALTER TABLE enquiries ADD COLUMN access_code_hash TEXT;

CREATE TABLE enquiry_access_limits (
  bucket INTEGER NOT NULL,
  client_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (bucket, client_hash)
);