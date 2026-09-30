BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Creative Classic','Charcoal and yellow creative portfolio VCard with projects, services and customer enquiries.',
  '../public-vcard/final-17-creative-classic.html',
  '{"finalized":true,"designKey":"creative-classic","category":"Creative & Media","layout":"final-17","colors":{"primary":"#181b1f","accent":"#ffd400"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='creative-classic');

-- Extend plans that already offer Creative Studio; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='creative-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[2]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='creative-classic' ORDER BY id LIMIT 1));
COMMIT;


