CREATE TABLE nfc_cards (
  id SERIAL PRIMARY KEY,
  business_card_id INTEGER REFERENCES business_cards(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tag_identifier VARCHAR(255) NOT NULL UNIQUE,
  serial_number VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  assigned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nfc_cards_business_card_id ON nfc_cards(business_card_id);
