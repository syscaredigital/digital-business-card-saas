BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Real Estate Classic','Light real estate VCard with property listings, reviews and customer enquiries.',
  '../public-vcard/final-15-property-classic.html',
  '{"finalized":true,"designKey":"property-classic","category":"Real Estate & Property","layout":"final-15","colors":{"primary":"#f1f2e9","accent":"#17875f"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='property-classic');

-- Extend plans that already offer Real Estate Professional; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='property-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[7]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='property-classic' ORDER BY id LIMIT 1));
COMMIT;


