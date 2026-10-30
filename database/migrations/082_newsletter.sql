CREATE TABLE newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('pending','subscribed','unsubscribed')),
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_version TEXT NOT NULL DEFAULT 'newsletter-v1',
  confirmation_hash CHAR(64) UNIQUE,
  confirmation_expires_at TIMESTAMPTZ,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE newsletter_campaigns (
  id BIGSERIAL PRIMARY KEY,
  request_key UUID NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE newsletter_deliveries (
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  campaign_id BIGINT REFERENCES newsletter_campaigns(id),
  kind TEXT NOT NULL CHECK(kind IN ('confirmation','campaign')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_token UUID,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  UNIQUE(subscriber_id,campaign_id)
);
CREATE INDEX newsletter_delivery_queue ON newsletter_deliveries(available_at) WHERE status IN ('pending','sending');
