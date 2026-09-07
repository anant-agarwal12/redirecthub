-- RedirectHub database schema
-- This file runs automatically when PostgreSQL container starts

CREATE TABLE IF NOT EXISTS links (
  id           SERIAL PRIMARY KEY,
  short_code   VARCHAR(10) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  expires_at   TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clicks (
  id           SERIAL PRIMARY KEY,
  short_code   VARCHAR(10) NOT NULL,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  clicked_at   TIMESTAMP DEFAULT NOW()
);
