-- Contact details, MLS reference, and price history from listing sources such as RentCast.
ALTER TABLE listings
  ADD COLUMN contacts       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN mls_number     TEXT,
  ADD COLUMN price_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN days_on_market INTEGER;

-- Counts paid API requests per calendar month so the worker can stop before a plan's limit.
CREATE TABLE api_usage (
  provider  TEXT NOT NULL,
  month     TEXT NOT NULL, -- YYYY-MM in UTC
  requests  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, month)
);
