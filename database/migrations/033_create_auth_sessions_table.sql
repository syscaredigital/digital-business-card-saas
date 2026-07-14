CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_status
  ON auth_sessions(user_id, revoked_at, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
  ON auth_sessions(expires_at);
