BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Automotive Classic','Compact black and red automotive VCard with a vehicle gallery and customer enquiries.',
  '../public-vcard/final-11-automotive-classic.html',
  '{"finalized":true,"designKey":"automotive-classic","category":"Automotive & Transport","layout":"final-11","colors":{"primary":"#030303","accent":"#ed1c24"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='automotive-classic');

-- Extend plans that already offer Automotive Showroom; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='automotive-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[9]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='automotive-classic' ORDER BY id LIMIT 1));
COMMIT;
