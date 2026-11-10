ALTER TABLE enquiries ADD COLUMN booking_status TEXT NOT NULL DEFAULT 'received'
  CHECK (booking_status IN ('received', 'booked', 'running', 'completed'));

ALTER TABLE enquiries ADD COLUMN booking_status_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE enquiries ADD COLUMN booking_status_updated_at TEXT;

CREATE INDEX enquiries_booking_status ON enquiries (booking_status, created_at);