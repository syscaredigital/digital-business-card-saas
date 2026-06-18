CREATE TABLE card_gallery (
  id SERIAL PRIMARY KEY,
  business_card_id INTEGER REFERENCES business_cards(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title VARCHAR(255),
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_card_gallery_business_card_id ON card_gallery(business_card_id);
