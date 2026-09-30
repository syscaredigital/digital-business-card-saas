BEGIN;
INSERT INTO vcard_templates (name,description,preview_url,template_json,is_public)
SELECT 'Boutique Classic','Pink boutique VCard with products, gallery, styling services and customer enquiries.',
  '../public-vcard/final-16-boutique-classic.html',
  '{"finalized":true,"designKey":"boutique-classic","category":"Fashion, Retail & Lifestyle","layout":"final-16","colors":{"primary":"#fff4f5","accent":"#df5b82"}}'::jsonb,TRUE
WHERE NOT EXISTS (SELECT 1 FROM vcard_templates WHERE template_json->>'designKey'='boutique-classic');

-- Extend plans that already offer Style Boutique; preserve other restrictions.
UPDATE plans SET features=jsonb_set(features,'{templateIds}',
  (features->'templateIds') || to_jsonb((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='boutique-classic' ORDER BY id LIMIT 1)),TRUE)
WHERE jsonb_typeof(features)='object' AND jsonb_typeof(features->'templateIds')='array'
  AND (features->'templateIds') @> '[1]'::jsonb
  AND NOT (features->'templateIds') @> jsonb_build_array((SELECT id FROM vcard_templates WHERE template_json->>'designKey'='boutique-classic' ORDER BY id LIMIT 1));
COMMIT;


