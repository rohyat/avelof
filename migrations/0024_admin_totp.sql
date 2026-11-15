CREATE TABLE admin_totp_counters (
  credential_hash TEXT PRIMARY KEY NOT NULL,
  last_counter INTEGER NOT NULL CHECK (last_counter >= 0)
);
