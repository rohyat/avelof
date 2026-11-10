ALTER TABLE enquiries ADD COLUMN public_reference TEXT;

CREATE UNIQUE INDEX enquiries_public_reference ON enquiries (public_reference);

CREATE TABLE enquiry_reference_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  request_reference TEXT NOT NULL UNIQUE REFERENCES enquiries (reference) ON DELETE CASCADE
);

INSERT INTO enquiry_reference_numbers (request_reference)
SELECT reference FROM enquiries ORDER BY created_at, reference;

UPDATE enquiries
SET public_reference = 'AVELOF_' || CASE
  WHEN kind = 'hotel' THEN 'HTL'
  WHEN kind = 'car' THEN 'CAB'
  WHEN kind = 'contact' THEN 'INQ'
  WHEN json_extract(fields_json, '$.packagePreference') = 'Deluxe' THEN 'DLX'
  WHEN json_extract(fields_json, '$.packagePreference') = 'Premium' THEN 'PRM'
  ELSE 'CSTM'
END || '_' || (
  SELECT number + 10000 FROM enquiry_reference_numbers
  WHERE request_reference = enquiries.reference
);