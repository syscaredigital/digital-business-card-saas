BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Legal Classic','Black and gold lawyer profile with services, appointments and enquiries.',
  '../public-vcard/final-20-legal-classic.html',
  '{"finalized":true,"designKey":"legal-classic","category":"Legal & Professional","layout":"final-20","colors":{"primary":"#151515","accent":"#cc9558"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='legal-classic');

-- Extend plans that already offer Legal Counsel; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='legal-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[5]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='legal-classic' ORDER BY id LIMIT 1));
COMMIT;
