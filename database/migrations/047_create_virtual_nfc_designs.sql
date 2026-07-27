CREATE TABLE IF NOT EXISTS virtual_nfc_designs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vcard_id INTEGER REFERENCES vcards(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  front_image TEXT NOT NULL,
  back_image TEXT NOT NULL,
  logo_image TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virtual_nfc_designs_user_updated
  ON virtual_nfc_designs(user_id, updated_at DESC);
