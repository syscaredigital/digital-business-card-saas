BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Events Classic','Purple and pink event planner VCard with galleries, packages and customer enquiries.',
  '../public-vcard/final-13-events-classic.html',
  '{"finalized":true,"designKey":"events-classic","category":"Events & Entertainment","layout":"final-13","colors":{"primary":"#30003c","accent":"#f60083"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='events-classic');

-- Extend plans that already offer Event Planner; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='events-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[6]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='events-classic' ORDER BY id LIMIT 1));
COMMIT;


