CREATE TABLE pricing_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO pricing_settings (id, discount_percent, version) VALUES (1, 0, 0);
