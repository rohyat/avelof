CREATE TABLE hotel_reference_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id TEXT NOT NULL UNIQUE REFERENCES hotel_registrations (id) ON DELETE CASCADE,
  legacy_hotel_id TEXT NOT NULL UNIQUE
);

INSERT INTO hotel_reference_numbers (registration_id, legacy_hotel_id)
SELECT id, hotel_id
FROM hotel_registrations
ORDER BY created_at, id;

UPDATE reviews
SET hotel_id = (
  SELECT 'AVELOF_HTL_' || printf('%05d', hotel_reference_numbers.number + 10000) ||
    CASE json_extract(hotel_registrations.details_json, '$.location')
      WHEN 'Srinagar' THEN 'SRG'
      WHEN 'Gulmarg' THEN 'GLM'
      WHEN 'Pahalgam' THEN 'PHL'
      WHEN 'Sonamarg' THEN 'SNG'
      WHEN 'Doodhpathri' THEN 'DDP'
      WHEN 'Yusmarg' THEN 'YSM'
      WHEN 'Gurez' THEN 'GRZ'
    END
  FROM hotel_reference_numbers
  JOIN hotel_registrations ON hotel_registrations.id = hotel_reference_numbers.registration_id
  WHERE hotel_reference_numbers.legacy_hotel_id = reviews.hotel_id
)
WHERE hotel_id IN (SELECT legacy_hotel_id FROM hotel_reference_numbers);

UPDATE hotel_registrations
SET hotel_id = (
  SELECT 'AVELOF_HTL_' || printf('%05d', hotel_reference_numbers.number + 10000) ||
    CASE json_extract(hotel_registrations.details_json, '$.location')
      WHEN 'Srinagar' THEN 'SRG'
      WHEN 'Gulmarg' THEN 'GLM'
      WHEN 'Pahalgam' THEN 'PHL'
      WHEN 'Sonamarg' THEN 'SNG'
      WHEN 'Doodhpathri' THEN 'DDP'
      WHEN 'Yusmarg' THEN 'YSM'
      WHEN 'Gurez' THEN 'GRZ'
    END
  FROM hotel_reference_numbers
  WHERE hotel_reference_numbers.registration_id = hotel_registrations.id
);
