CREATE TRIGGER hotel_registrations_cleanup
AFTER DELETE ON hotel_registrations
BEGIN
  DELETE FROM reviews WHERE hotel_id = OLD.hotel_id;
  DELETE FROM registration_photos
  WHERE photo_key IN (SELECT value FROM json_each(OLD.photo_keys_json));
END;

CREATE TRIGGER driver_registrations_cleanup
AFTER DELETE ON driver_registrations
BEGIN
  DELETE FROM reviews WHERE driver_id = OLD.driver_id;
  DELETE FROM registration_photos
  WHERE photo_key IN (SELECT value FROM json_each(OLD.photo_keys_json));
END;
