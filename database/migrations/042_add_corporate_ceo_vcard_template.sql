INSERT INTO vcard_templates (name, description, preview_url, template_json, is_public, created_at, updated_at)
SELECT
  'Corporate CEO',
  'Executive digital card with a banner, prominent contact details, services, bookings, portfolio, products, testimonials, and business hours.',
  '../public-vcard/corporate-ceo.html',
  '{"industry":true,"category":"Corporate & Business Professionals","layout":"corporate-ceo","colors":{"primary":"#0d3841","accent":"#a5ff62"}}'::jsonb,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM vcard_templates WHERE LOWER(name) = LOWER('Corporate CEO')
);

UPDATE plans
SET features = jsonb_set(
  COALESCE(features, '{}'::jsonb),
  '{templateIds}',
  COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM vcard_templates WHERE is_public = TRUE), '[]'::jsonb),
  TRUE
)
WHERE jsonb_typeof(COALESCE(features, '{}'::jsonb)) = 'object';
