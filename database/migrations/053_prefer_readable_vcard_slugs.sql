-- Remove the numeric suffix from automatically generated slugs when the VCard
-- name is unique. Duplicate names retain their ID suffix to remain unambiguous.
WITH normalized AS (
  SELECT id,
         CASE
           WHEN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(title, 'vcard')), '[^a-z0-9]+', '-', 'g')) = '' THEN 'vcard'
           ELSE LEFT(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(title), '[^a-z0-9]+', '-', 'g')), 100)
         END AS base_slug
  FROM vcards
), candidates AS (
  SELECT n.id,n.base_slug
  FROM normalized n
  JOIN vcards v ON v.id=n.id
  WHERE LOWER(v.slug)=LOWER(n.base_slug || '-' || n.id::TEXT)
    AND (SELECT COUNT(*) FROM normalized same_name WHERE same_name.base_slug=n.base_slug)=1
    AND NOT EXISTS (SELECT 1 FROM vcards used WHERE used.id<>n.id AND LOWER(used.slug)=LOWER(n.base_slug))
)
UPDATE vcards v SET slug=c.base_slug
FROM candidates c WHERE v.id=c.id;
