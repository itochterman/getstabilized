-- Buildings come from public property records (assessor rolls, PLUTO, etc.).
CREATE TABLE buildings (
  id            BIGSERIAL PRIMARY KEY,
  city          TEXT NOT NULL,
  parcel        TEXT NOT NULL,
  address       TEXT NOT NULL,
  address_norm  TEXT NOT NULL,
  year_built    INTEGER,
  units         INTEGER,
  use_type      TEXT NOT NULL DEFAULT 'unknown',
  tax_benefit   TEXT,
  registered    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, parcel)
);
CREATE INDEX buildings_city_address ON buildings (city, address_norm);

-- One row per listing per source. Re-seeing a listing updates it in place.
CREATE TABLE listings (
  id             BIGSERIAL PRIMARY KEY,
  source         TEXT NOT NULL,
  source_id      TEXT NOT NULL,
  city           TEXT NOT NULL,
  title          TEXT NOT NULL,
  address        TEXT NOT NULL,
  address_norm   TEXT NOT NULL,
  neighborhood   TEXT,
  beds           INTEGER NOT NULL,
  baths          NUMERIC(3,1),
  rent           NUMERIC(10,2) NOT NULL,
  sqft           INTEGER,
  description    TEXT NOT NULL DEFAULT '',
  url            TEXT,
  no_fee         BOOLEAN,
  property_type  TEXT NOT NULL DEFAULT 'unknown',
  year_built     INTEGER,
  units          INTEGER,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  building_id    BIGINT REFERENCES buildings(id) ON DELETE SET NULL,
  score          INTEGER NOT NULL,
  tier           TEXT NOT NULL,
  reasons        JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  listed_at      TIMESTAMPTZ,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX listings_search ON listings (city, status, rent);
CREATE INDEX listings_score ON listings (city, status, score DESC);
CREATE INDEX listings_first_seen ON listings (first_seen DESC);

CREATE TABLE saved_searches (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  city        TEXT NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX saved_searches_city ON saved_searches (city) WHERE active;

CREATE TABLE alerts (
  id               BIGSERIAL PRIMARY KEY,
  saved_search_id  BIGINT NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id       BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ,
  UNIQUE (saved_search_id, listing_id)
);

CREATE TABLE ingest_runs (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL,
  city        TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  fetched     INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  updated     INTEGER NOT NULL DEFAULT 0,
  deactivated INTEGER NOT NULL DEFAULT 0,
  error       TEXT
);
