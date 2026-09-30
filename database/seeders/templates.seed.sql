-- The template catalogue is installed and maintained by
-- migrations 054 and 068 through 077. Keep plan access in
-- sync when seeds are rerun without recreating removed legacy templates.
UPDATE plans
SET features=jsonb_set(
  COALESCE(features,'{}'::jsonb),
  '{templateIds}',
  (SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM vcard_templates WHERE is_public=TRUE),
  TRUE
)
WHERE jsonb_typeof(COALESCE(features,'{}'::jsonb))='object';
