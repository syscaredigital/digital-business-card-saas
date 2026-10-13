BEGIN;

-- Keep existing cards and plan restrictions while retiring the old catalogue.
CREATE TEMP TABLE classic_template_mapping ON COMMIT DROP AS
SELECT old.id AS old_id, classic.id AS classic_id
FROM vcard_templates old
JOIN vcard_templates classic ON classic.template_json->>'designKey' =
  CASE WHEN old.template_json->>'designKey' IN
    ('automotive','corporate','events','trainer','property','boutique','creative','technology','medical','legal')
    THEN (old.template_json->>'designKey') || '-classic'
    ELSE 'corporate-classic' END
WHERE COALESCE(old.template_json->>'designKey','') NOT IN
  ('automotive-classic','corporate-classic','events-classic','trainer-classic','property-classic',
   'boutique-classic','creative-classic','technology-classic','medical-classic','legal-classic');

DO $$ BEGIN
  IF (SELECT COUNT(DISTINCT template_json->>'designKey') FROM vcard_templates
      WHERE template_json->>'designKey' IN
      ('automotive-classic','corporate-classic','events-classic','trainer-classic','property-classic',
       'boutique-classic','creative-classic','technology-classic','medical-classic','legal-classic')) <> 10
  THEN RAISE EXCEPTION 'All ten Classic templates must exist before retiring older templates';
  END IF;
END $$;

UPDATE vcards v SET template_id=m.classic_id, updated_at=NOW()
FROM classic_template_mapping m WHERE v.template_id=m.old_id;

UPDATE plans p SET features=jsonb_set(p.features,'{templateIds}',(
  SELECT COALESCE(jsonb_agg(mapped.id ORDER BY mapped.id),'[]'::jsonb)
  FROM (
    SELECT DISTINCT COALESCE(m.classic_id,t.id) AS id
    FROM jsonb_array_elements(p.features->'templateIds') item
    JOIN vcard_templates t ON to_jsonb(t.id)=item
    LEFT JOIN classic_template_mapping m ON m.old_id=t.id
  ) mapped
),TRUE)
WHERE jsonb_typeof(p.features)='object' AND jsonb_typeof(p.features->'templateIds')='array';

DELETE FROM vcard_templates WHERE id IN (SELECT old_id FROM classic_template_mapping);
COMMIT;
