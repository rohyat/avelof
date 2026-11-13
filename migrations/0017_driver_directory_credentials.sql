ALTER TABLE driver_registrations
ADD COLUMN directory_credentials_consent INTEGER NOT NULL DEFAULT 0
CHECK (directory_credentials_consent IN (0, 1));

ALTER TABLE driver_registrations
ADD COLUMN directory_credentials_consented_at TEXT;

UPDATE driver_registrations
SET directory_credentials_consent = 1,
    directory_credentials_consented_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'f902d940-40df-40b9-bfac-0deec4d05ddd';
