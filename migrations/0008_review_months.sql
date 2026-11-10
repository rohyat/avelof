ALTER TABLE reviews ADD COLUMN review_month TEXT
  CHECK (review_month IS NULL OR (
    review_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    AND substr(review_month, 6, 2) BETWEEN '01' AND '12'
  ));

UPDATE reviews
SET review_month = CASE
    WHEN source_key IN ('owner:guest-rating-1', 'owner:guest-rating-2') THEN '2025-01'
    WHEN source_key IN ('owner:guest-rating-3', 'owner:guest-rating-4', 'owner:guest-rating-5', 'owner:guest-rating-6') THEN '2025-03'
    WHEN source_key IN ('owner:guest-rating-7', 'owner:guest-rating-8') THEN '2025-06'
    WHEN source_key IN ('owner:guest-rating-9', 'owner:guest-rating-10') THEN '2025-12'
  END,
  version = version + 1
WHERE submission_source = 'owner_provided' AND review_month IS NULL
  AND source_key IN (
    'owner:guest-rating-1', 'owner:guest-rating-2', 'owner:guest-rating-3', 'owner:guest-rating-4',
    'owner:guest-rating-5', 'owner:guest-rating-6', 'owner:guest-rating-7', 'owner:guest-rating-8',
    'owner:guest-rating-9', 'owner:guest-rating-10'
  );