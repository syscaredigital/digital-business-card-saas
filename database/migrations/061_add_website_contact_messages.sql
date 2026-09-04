CREATE TABLE IF NOT EXISTS website_contact_messages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  source_page VARCHAR(255),
  visitor_hash CHAR(64) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','failed')),
  delivery_error VARCHAR(500),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_contact_messages_created
  ON website_contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_contact_messages_visitor
  ON website_contact_messages(visitor_hash,created_at DESC);
