UPDATE driver_registrations
SET details_json = json_remove(details_json, '$.price')
WHERE json_type(details_json, '$.price') IS NOT NULL;

ALTER TABLE driver_registrations DROP COLUMN submitted_price;
ALTER TABLE driver_registrations DROP COLUMN price;
