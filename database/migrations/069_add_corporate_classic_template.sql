BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Corporate Classic','Teal and lime corporate VCard with services, testimonials and customer enquiries.',
  '../public-vcard/final-12-corporate-classic.html',
  '{"finalized":true,"designKey":"corporate-classic","category":"Corporate & Business","layout":"final-12","colors":{"primary":"#0b3641","accent":"#9cff63"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='corporate-classic');

-- Extend plans that already offer Corporate Executive; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='corporate-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[10]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='corporate-classic' ORDER BY id LIMIT 1));
COMMIT;

