ALTER TABLE hotel_registrations ADD COLUMN latitude REAL;
ALTER TABLE hotel_registrations ADD COLUMN longitude REAL CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL
   AND typeof(latitude) IN ('integer', 'real') AND latitude BETWEEN -90 AND 90
   AND typeof(longitude) IN ('integer', 'real') AND longitude BETWEEN -180 AND 180)
);

ALTER TABLE business_registrations ADD COLUMN latitude REAL;
ALTER TABLE business_registrations ADD COLUMN longitude REAL CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL
   AND typeof(latitude) IN ('integer', 'real') AND latitude BETWEEN -90 AND 90
   AND typeof(longitude) IN ('integer', 'real') AND longitude BETWEEN -180 AND 180)
);
