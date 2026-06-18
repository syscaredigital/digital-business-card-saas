CREATE TABLE card_social_links (
  id SERIAL PRIMARY KEY,
  business_card_id INTEGER REFERENCES business_cards(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  icon VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_card_social_links_business_card_id ON card_social_links(business_card_id);
