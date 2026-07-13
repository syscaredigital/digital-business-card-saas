INSERT INTO vcard_templates (name, description, preview_url, template_json, is_public, created_at, updated_at)
SELECT seed.name, seed.description, seed.preview_url, seed.template_json::jsonb, TRUE, NOW(), NOW()
FROM (VALUES
  ('Retail E-Commerce', 'Commerce-focused profile for retail strategists, marketplace advisors, and growth consultants.', '../public-vcard/template-one.html', '{"layout":"retail","colors":{"primary":"#1f2937","accent":"#e63946"}}'),
  ('Luxury Realtor', 'Premium property profile for agencies, brokers, and real-estate advisors.', '../public-vcard/template-two.html', '{"layout":"realtor","colors":{"primary":"#17284d","accent":"#c6a15b"}}'),
  ('Healthcare Wellness', 'Healthcare consultant profile with services, expertise, programs, and contact sections.', '../public-vcard/template-three.html', '{"layout":"healthcare","colors":{"primary":"#075f66","accent":"#16a3a0"}}')
) AS seed(name, description, preview_url, template_json)
WHERE NOT EXISTS (
  SELECT 1 FROM vcard_templates existing WHERE LOWER(existing.name) = LOWER(seed.name)
);
