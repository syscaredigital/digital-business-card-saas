BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Technology Classic','Dark grid technology VCard with services, projects and customer enquiries.',
  '../public-vcard/final-18-technology-classic.html',
  '{"finalized":true,"designKey":"technology-classic","category":"Technology & IT","layout":"final-18","colors":{"primary":"#111111","accent":"#c7ff00"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='technology-classic');

-- Extend plans that already offer Technology Expert; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='technology-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[3]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='technology-classic' ORDER BY id LIMIT 1));
COMMIT;


