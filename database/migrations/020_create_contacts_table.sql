CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  business_card_id INTEGER REFERENCES business_cards(id) ON DELETE CASCADE,
  name VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  message TEXT,
  source VARCHAR(100),
  contacted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contacts_business_card_id ON contacts(business_card_id);
