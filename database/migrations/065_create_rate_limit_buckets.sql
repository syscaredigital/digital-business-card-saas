CREATE TABLE rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limit_buckets_expiry ON rate_limit_buckets(expires_at);
