BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Medical Classic','Navy and teal medical profile with appointments, services and enquiries.',
  '../public-vcard/final-19-medical-classic.html',
  '{"finalized":true,"designKey":"medical-classic","category":"Healthcare & Wellness","layout":"final-19","colors":{"primary":"#edf3f7","accent":"#087f86"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='medical-classic');

-- Extend plans that already offer Medical Professional; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='medical-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[4]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='medical-classic' ORDER BY id LIMIT 1));
COMMIT;
