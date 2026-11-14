ALTER TABLE business_registrations ADD COLUMN registration_key TEXT;

UPDATE business_registrations
SET registration_key = json_array(
  lower(trim(json_extract(details_json, '$.kind'))),
  lower(trim(json_extract(details_json, '$.location'))),
  lower(trim(json_extract(details_json, '$.name'))),
  lower(trim(json_extract(details_json, '$.address')))
);

CREATE UNIQUE INDEX business_registration_identity ON business_registrations (registration_key);

CREATE TRIGGER business_registration_photo_cleanup
AFTER DELETE ON business_registrations
BEGIN
  DELETE FROM registration_photos WHERE photo_key = OLD.photo_key;
END;
