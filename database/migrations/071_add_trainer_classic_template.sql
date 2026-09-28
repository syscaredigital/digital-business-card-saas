BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Trainer Classic','Black and sage training VCard with gold accents, services and customer enquiries.',
  '../public-vcard/final-14-trainer-classic.html',
  '{"finalized":true,"designKey":"trainer-classic","category":"Education & Training","layout":"final-14","colors":{"primary":"#030303","accent":"#d99b55"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='trainer-classic');

-- Extend plans that already offer Corporate Trainer; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='trainer-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[8]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='trainer-classic' ORDER BY id LIMIT 1));
COMMIT;


