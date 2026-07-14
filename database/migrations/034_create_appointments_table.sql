CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vcard_id INTEGER REFERENCES vcards(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  appointment_type VARCHAR(50) NOT NULL DEFAULT 'free',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_start
  ON appointments(user_id, starts_at DESC);
