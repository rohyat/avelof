ALTER TABLE reviews ADD COLUMN hotel_id TEXT;

CREATE INDEX reviews_hotel_status_published
  ON reviews (hotel_id, status, published_at DESC);
