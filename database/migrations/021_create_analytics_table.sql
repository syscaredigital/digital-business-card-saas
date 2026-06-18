CREATE TABLE analytics (
  id SERIAL PRIMARY KEY,
  business_card_id INTEGER REFERENCES business_cards(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  contact_requests INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_analytics_business_card_date ON analytics(business_card_id, event_date);
