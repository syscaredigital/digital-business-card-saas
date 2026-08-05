-- The finalized ten-template catalogue is installed and maintained by
-- migration 054_replace_with_final_vcard_templates.sql. Keep plan access in
-- sync when seeds are rerun without recreating removed legacy templates.
UPDATE plans
SET features=jsonb_set(
  COALESCE(features,'{}'::jsonb),
  '{templateIds}',
  '[1,2,3,4,5,6,7,8,9,10]'::jsonb,
  TRUE
)
WHERE jsonb_typeof(COALESCE(features,'{}'::jsonb))='object';
