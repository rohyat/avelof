CREATE TABLE driver_reference_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id TEXT NOT NULL UNIQUE REFERENCES driver_registrations (id) ON DELETE CASCADE,
  legacy_driver_id TEXT NOT NULL UNIQUE
);

INSERT INTO driver_reference_numbers (registration_id, legacy_driver_id)
SELECT id, driver_id
FROM driver_registrations
ORDER BY created_at, id;

UPDATE reviews
SET driver_id = (
  SELECT 'AVELOF-DRV-' || printf('%05d', number + 10000)
  FROM driver_reference_numbers
  WHERE legacy_driver_id = reviews.driver_id
)
WHERE driver_id IN (SELECT legacy_driver_id FROM driver_reference_numbers);

UPDATE driver_registrations
SET driver_id = (
  SELECT 'AVELOF-DRV-' || printf('%05d', number + 10000)
  FROM driver_reference_numbers
  WHERE registration_id = driver_registrations.id
);
