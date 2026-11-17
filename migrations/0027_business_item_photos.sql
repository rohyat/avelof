CREATE TABLE business_item_photos (
  business_id TEXT NOT NULL REFERENCES business_registrations(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  content BLOB NOT NULL,
  PRIMARY KEY (business_id, item_id)
);
