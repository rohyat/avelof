ALTER TABLE reviews ADD COLUMN driver_id TEXT;

CREATE INDEX reviews_driver_status_published
  ON reviews (driver_id, status, published_at DESC);
