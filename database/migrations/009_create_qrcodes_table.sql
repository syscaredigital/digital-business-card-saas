CREATE TABLE qrcodes (
  id SERIAL PRIMARY KEY,
  vcard_id INTEGER REFERENCES vcards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'url',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_qrcodes_vcard_id ON qrcodes(vcard_id);
