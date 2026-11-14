ALTER TABLE business_registrations ADD COLUMN photo_keys_json TEXT NOT NULL DEFAULT '[]';

UPDATE business_registrations SET photo_keys_json = json_array(photo_key);

DROP TRIGGER business_registration_photo_cleanup;
CREATE TRIGGER business_registration_photo_cleanup
AFTER DELETE ON business_registrations
BEGIN
  DELETE FROM registration_photos
  WHERE photo_key = OLD.photo_key
     OR photo_key IN (SELECT value FROM json_each(OLD.photo_keys_json));
END;
