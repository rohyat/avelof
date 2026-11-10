ALTER TABLE enquiries ADD COLUMN phone_lookup TEXT;

UPDATE enquiries SET phone_lookup =
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    phone_number, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''),
    char(9), ''), char(10), ''), char(11), ''), char(12), ''), char(13), ''), char(160), ''), char(8239), '');

CREATE INDEX enquiries_phone_lookup ON enquiries (phone_lookup, created_at);