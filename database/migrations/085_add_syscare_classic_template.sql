INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'SysCare Classic','Navy blue, light blue, black and white corporate design with swipeable services, products, galleries, testimonials and blogs.',
  '../public-vcard/final-21-syscare-classic.html',
  '{"finalized":true,"designKey":"syscare-classic","category":"Corporate & Business","layout":"final-21","colors":{"primary":"#0b1f3a","accent":"#8ad4ff"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='syscare-classic');

-- Offer the variant to plans that already include Corporate Classic.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='syscare-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='corporate-classic' ORDER BY id LIMIT 1))
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='syscare-classic' ORDER BY id LIMIT 1));
