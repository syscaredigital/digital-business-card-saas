INSERT INTO vcard_templates (name, description, preview_url, template_json, is_public, created_at, updated_at)
SELECT seed.name, seed.description, seed.preview_url, seed.template_json::jsonb, TRUE, NOW(), NOW()
FROM (VALUES
  ('Corporate CEO', 'Executive digital card with a banner, prominent contact details, services, bookings, portfolio, products, testimonials, and business hours.', '../public-vcard/corporate-ceo.html', '{"industry":true,"category":"Corporate & Business Professionals","layout":"corporate-ceo","colors":{"primary":"#0d3841","accent":"#a5ff62"}}'),
  ('Retail E-Commerce', 'Commerce-focused profile for retail strategists, marketplace advisors, and growth consultants.', '../public-vcard/template-one.html', '{"layout":"retail","colors":{"primary":"#1f2937","accent":"#e63946"}}'),
  ('Luxury Realtor', 'Premium property profile for agencies, brokers, and real-estate advisors.', '../public-vcard/template-two.html', '{"layout":"realtor","colors":{"primary":"#17284d","accent":"#c6a15b"}}'),
  ('Healthcare Wellness', 'Healthcare consultant profile with services, expertise, programs, and contact sections.', '../public-vcard/template-three.html', '{"layout":"healthcare","colors":{"primary":"#075f66","accent":"#16a3a0"}}'),
  ('Corporate & Business', 'Executive profile for managers, sales teams, recruiters, consultants, and founders.', '../public-vcard/industry-template.html?category=corporate-business', '{"industry":true,"category":"Corporate & Business Professionals","layout":"executive","colors":{"primary":"#111827","accent":"#ff5a5f"}}'),
  ('Creative & Media', 'Expressive portfolio card for designers, photographers, creators, musicians, and agencies.', '../public-vcard/industry-template.html?category=creative-media', '{"industry":true,"category":"Creative & Media Industry","layout":"editorial","colors":{"primary":"#24123d","accent":"#ff4ecd"}}'),
  ('Technology & IT', 'High-impact digital profile for developers, freelancers, security experts, and technology teams.', '../public-vcard/industry-template.html?category=technology-it', '{"industry":true,"category":"Technology & IT","layout":"terminal","colors":{"primary":"#071b2b","accent":"#2ee6a6"}}'),
  ('Healthcare & Wellness', 'Calm, trustworthy profile for clinicians, therapists, trainers, and wellness professionals.', '../public-vcard/industry-template.html?category=healthcare-wellness', '{"industry":true,"category":"Healthcare & Wellness","layout":"wellness","colors":{"primary":"#073b4c","accent":"#57d6c7"}}'),
  ('Real Estate & Property', 'Premium property card for agents, architects, interior designers, and developers.', '../public-vcard/industry-template.html?category=real-estate-property', '{"industry":true,"category":"Real Estate & Property","layout":"architectural","colors":{"primary":"#171717","accent":"#d4a85c"}}'),
  ('Retail & E-Commerce', 'Product-led storefront profile for retailers, brand representatives, and sales professionals.', '../public-vcard/industry-template.html?category=retail-ecommerce', '{"industry":true,"category":"Retail & E-Commerce","layout":"commerce","colors":{"primary":"#301934","accent":"#ff8a5b"}}'),
  ('Hospitality & Food', 'Warm booking and menu profile for restaurants, hotels, resorts, caterers, and event planners.', '../public-vcard/industry-template.html?category=hospitality-food', '{"industry":true,"category":"Hospitality & Food","layout":"hospitality","colors":{"primary":"#2c1810","accent":"#efb366"}}'),
  ('Finance & Legal', 'Refined professional profile for lawyers, accountants, auditors, insurers, and financial planners.', '../public-vcard/industry-template.html?category=finance-legal', '{"industry":true,"category":"Finance & Legal","layout":"ledger","colors":{"primary":"#10253f","accent":"#b8d8d8"}}'),
  ('Education & Training', 'Friendly knowledge-focused card for educators, institutes, tutors, and corporate trainers.', '../public-vcard/industry-template.html?category=education-training', '{"industry":true,"category":"Education & Training","layout":"learning","colors":{"primary":"#312e81","accent":"#fbbf24"}}'),
  ('Automotive & Transport', 'Dynamic profile for showrooms, service centers, logistics providers, and transport teams.', '../public-vcard/industry-template.html?category=automotive-transport', '{"industry":true,"category":"Automotive & Transport","layout":"motion","colors":{"primary":"#111827","accent":"#f43f5e"}}'),
  ('Construction & Engineering', 'Structured project profile for engineers, contractors, suppliers, and distributors.', '../public-vcard/industry-template.html?category=construction-engineering', '{"industry":true,"category":"Construction & Engineering","layout":"blueprint","colors":{"primary":"#16324f","accent":"#ffb000"}}'),
  ('Events & Entertainment', 'Bold booking card for performers, hosts, planners, decorators, and event services.', '../public-vcard/industry-template.html?category=events-entertainment', '{"industry":true,"category":"Events & Entertainment","layout":"spotlight","colors":{"primary":"#170b2c","accent":"#a855f7"}}'),
  ('Sustainability & NGOs', 'Purpose-led card for environmental organizations, charities, campaigns, and nonprofits.', '../public-vcard/industry-template.html?category=sustainability-ngos', '{"industry":true,"category":"Sustainability & NGOs","layout":"organic","colors":{"primary":"#163a2a","accent":"#93c572"}}'),
  ('Personal & Lifestyle', 'Stylish portfolio and booking card for beauty, fashion, grooming, floral, and lifestyle brands.', '../public-vcard/industry-template.html?category=personal-lifestyle', '{"industry":true,"category":"Personal & Lifestyle","layout":"atelier","colors":{"primary":"#3d233a","accent":"#f0a6ca"}}'),
  ('Travel & Tourism', 'Immersive itinerary profile for travel agents, tour operators, and independent guides.', '../public-vcard/industry-template.html?category=travel-tourism', '{"industry":true,"category":"Travel & Tourism","layout":"journey","colors":{"primary":"#063b45","accent":"#ffcc66"}}')
) AS seed(name, description, preview_url, template_json)
WHERE NOT EXISTS (
  SELECT 1 FROM vcard_templates existing WHERE LOWER(existing.name) = LOWER(seed.name)
);

UPDATE plans
SET features = jsonb_set(
  features,
  '{templateIds}',
  COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM vcard_templates WHERE is_public = TRUE), '[]'::jsonb),
  TRUE
)
WHERE jsonb_typeof(features) = 'object';
