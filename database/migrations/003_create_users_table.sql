CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER,
  role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_company_id ON users(company_id);
