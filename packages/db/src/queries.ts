import type { BuildingFacts, CityId, ListingDTO, PropertyType, Reason, SearchFilters, SortKey, Tier } from "@getstabilized/core";
import { EXEMPT_PROPERTY_TYPES } from "@getstabilized/core";
import { getPool, LISTING_CHANNEL } from "./pool";

/* ---------- Buildings ---------- */

export interface BuildingRow {
  city: CityId;
  parcel: string;
  address: string;
  addressNorm: string;
  yearBuilt: number | null;
  units: number | null;
  useType: PropertyType;
  taxBenefit: string | null;
  registered: boolean;
  source: string;
}

export async function upsertBuildings(rows: BuildingRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const pool = getPool();
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      const b = j * 10;
      values.push(r.city, r.parcel, r.address, r.addressNorm, r.yearBuilt, r.units, r.useType, r.taxBenefit, r.registered, r.source);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`;
    });
    const res = await pool.query(
      `INSERT INTO buildings (city, parcel, address, address_norm, year_built, units, use_type, tax_benefit, registered, source)
       VALUES ${tuples.join(",")}
       ON CONFLICT (city, parcel) DO UPDATE SET
         address = EXCLUDED.address, address_norm = EXCLUDED.address_norm, year_built = EXCLUDED.year_built,
         units = EXCLUDED.units, use_type = EXCLUDED.use_type, tax_benefit = EXCLUDED.tax_benefit,
         registered = EXCLUDED.registered, source = EXCLUDED.source, updated_at = now()`,
      values,
    );
    n += res.rowCount ?? 0;
  }
  return n;
}

export async function findBuilding(city: CityId, addressNorm: string): Promise<(BuildingFacts & { id: number }) | null> {
  // Several parcels can share a street address (condo units). Prefer the record with the most units.
  const { rows } = await getPool().query(
    `SELECT id, year_built, units, use_type, tax_benefit, registered FROM buildings
     WHERE city = $1 AND address_norm = $2 ORDER BY units DESC NULLS LAST LIMIT 1`,
    [city, addressNorm],
  );
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, yearBuilt: r.year_built, units: r.units, useType: r.use_type, taxBenefit: r.tax_benefit, registered: r.registered };
}

/* ---------- Listings ---------- */

export interface ListingWrite {
  source: string;
  sourceId: string;
  city: CityId;
  title: string;
  address: string;
  addressNorm: string;
  neighborhood: string | null;
  beds: number;
  baths: number | null;
  rent: number;
  sqft: number | null;
  description: string;
  url: string | null;
  noFee: boolean | null;
  propertyType: PropertyType;
  yearBuilt: number | null;
  units: number | null;
  lat: number | null;
  lng: number | null;
  buildingId: number | null;
  score: number;
  tier: Tier;
  reasons: Reason[];
  listedAt: Date | null;
}

export async function upsertListing(l: ListingWrite): Promise<{ id: number; inserted: boolean }> {
  const { rows } = await getPool().query(
    `INSERT INTO listings (source, source_id, city, title, address, address_norm, neighborhood, beds, baths, rent, sqft,
        description, url, no_fee, property_type, year_built, units, lat, lng, building_id, score, tier, reasons, listed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (source, source_id) DO UPDATE SET
       title = EXCLUDED.title, address = EXCLUDED.address, address_norm = EXCLUDED.address_norm,
       neighborhood = EXCLUDED.neighborhood, beds = EXCLUDED.beds, baths = EXCLUDED.baths, rent = EXCLUDED.rent,
       sqft = EXCLUDED.sqft, description = EXCLUDED.description, url = EXCLUDED.url, no_fee = EXCLUDED.no_fee,
       property_type = EXCLUDED.property_type, year_built = EXCLUDED.year_built, units = EXCLUDED.units,
       lat = EXCLUDED.lat, lng = EXCLUDED.lng, building_id = EXCLUDED.building_id, score = EXCLUDED.score,
       tier = EXCLUDED.tier, reasons = EXCLUDED.reasons, status = 'active', last_seen = now()
     RETURNING id, (xmax = 0) AS inserted`,
    [l.source, l.sourceId, l.city, l.title, l.address, l.addressNorm, l.neighborhood, l.beds, l.baths, l.rent, l.sqft,
     l.description, l.url, l.noFee, l.propertyType, l.yearBuilt, l.units, l.lat, l.lng, l.buildingId, l.score, l.tier,
     JSON.stringify(l.reasons), l.listedAt],
  );
  return { id: rows[0].id, inserted: rows[0].inserted };
}

/** Mark listings from a full snapshot source as gone when a run no longer sees them. */
export async function deactivateUnseen(source: string, city: CityId, runStartedAt: Date): Promise<number> {
  const res = await getPool().query(
    `UPDATE listings SET status = 'inactive' WHERE source = $1 AND city = $2 AND status = 'active' AND last_seen < $3`,
    [source, city, runStartedAt],
  );
  return res.rowCount ?? 0;
}

const SELECT_LISTING = `
  SELECT l.id, l.source, l.city, l.title, l.address, l.neighborhood, l.beds, l.baths, l.rent, l.sqft, l.description,
         l.url, l.no_fee, l.property_type,
         COALESCE(b.year_built, l.year_built) AS year_built, COALESCE(b.units, l.units) AS units,
         (l.building_id IS NOT NULL) AS building_matched,
         l.score, l.tier, l.reasons, l.first_seen
  FROM listings l LEFT JOIN buildings b ON b.id = l.building_id`;

function toDTO(r: any): ListingDTO {
  return {
    id: r.id, source: r.source, city: r.city, title: r.title, address: r.address, neighborhood: r.neighborhood,
    beds: r.beds, baths: r.baths, rent: r.rent, sqft: r.sqft, description: r.description, url: r.url,
    noFee: r.no_fee, propertyType: r.property_type, yearBuilt: r.year_built, units: r.units,
    buildingMatched: r.building_matched, score: r.score, tier: r.tier, reasons: r.reasons,
    firstSeen: new Date(r.first_seen).toISOString(),
  };
}

export interface SearchResult {
  listings: ListingDTO[];
  total: number;
  likely: number;
}

export async function searchListings(f: SearchFilters, sort: SortKey = "best", limit = 60, offset = 0): Promise<SearchResult> {
  const where = ["l.city = $1", "l.status = 'active'"];
  const params: unknown[] = [f.city];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.beds != null) where.push(f.beds >= 3 ? `l.beds >= 3` : `l.beds = ${p(f.beds)}`);
  if (f.maxRent != null) where.push(`l.rent <= ${p(f.maxRent)}`);
  if (f.likelyOnly) where.push(`l.tier = 'likely'`);
  if (f.noFee) where.push(`l.no_fee IS TRUE`);
  if (f.hideExempt) where.push(`l.property_type <> ALL(${p(EXEMPT_PROPERTY_TYPES)})`);
  const order = {
    // Balance likelihood against price: a likely unit that's also affordable ranks first.
    best: "(l.score / 99.0) * 0.65 - (l.rent / 6000.0) * 0.35 DESC, l.id DESC",
    cheap: "l.rent ASC, l.id DESC",
    likely: "l.score DESC, l.rent ASC",
    newest: "l.first_seen DESC, l.id DESC",
  }[sort];
  const w = where.join(" AND ");
  const pool = getPool();
  const [list, counts] = await Promise.all([
    pool.query(`${SELECT_LISTING} WHERE ${w} ORDER BY ${order} LIMIT ${p(limit)} OFFSET ${p(offset)}`, params),
    pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE l.tier = 'likely')::int AS likely FROM listings l WHERE ${w}`,
      params.slice(0, params.length - 2),
    ),
  ]);
  return { listings: list.rows.map(toDTO), total: counts.rows[0].total, likely: counts.rows[0].likely };
}

export async function getListing(id: number): Promise<ListingDTO | null> {
  const { rows } = await getPool().query(`${SELECT_LISTING} WHERE l.id = $1`, [id]);
  return rows[0] ? toDTO(rows[0]) : null;
}

export async function getListingsByIds(ids: number[]): Promise<ListingDTO[]> {
  if (ids.length === 0) return [];
  const { rows } = await getPool().query(`${SELECT_LISTING} WHERE l.id = ANY($1)`, [ids]);
  return rows.map(toDTO);
}

/* ---------- Saved searches and alerts ---------- */

export interface SavedSearch {
  id: number;
  email: string;
  filters: SearchFilters;
}

export async function createSavedSearch(email: string, filters: SearchFilters): Promise<number> {
  const { rows } = await getPool().query(
    `INSERT INTO saved_searches (email, city, filters) VALUES ($1, $2, $3) RETURNING id`,
    [email, filters.city, JSON.stringify(filters)],
  );
  return rows[0].id;
}

export async function activeSavedSearches(city: CityId): Promise<SavedSearch[]> {
  const { rows } = await getPool().query(`SELECT id, email, filters FROM saved_searches WHERE active AND city = $1`, [city]);
  return rows.map((r) => ({ id: r.id, email: r.email, filters: r.filters }));
}

export async function recordAlert(savedSearchId: number, listingId: number): Promise<boolean> {
  const res = await getPool().query(
    `INSERT INTO alerts (saved_search_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [savedSearchId, listingId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markAlertDelivered(savedSearchId: number, listingId: number): Promise<void> {
  await getPool().query(`UPDATE alerts SET delivered_at = now() WHERE saved_search_id = $1 AND listing_id = $2`, [savedSearchId, listingId]);
}

/* ---------- Ingest bookkeeping and events ---------- */

export async function startRun(source: string, city: CityId): Promise<{ id: number; startedAt: Date }> {
  const { rows } = await getPool().query(`INSERT INTO ingest_runs (source, city) VALUES ($1, $2) RETURNING id, started_at`, [source, city]);
  return { id: rows[0].id, startedAt: rows[0].started_at };
}

export async function finishRun(id: number, stats: { fetched: number; inserted: number; updated: number; deactivated: number; error?: string }): Promise<void> {
  await getPool().query(
    `UPDATE ingest_runs SET finished_at = now(), fetched = $2, inserted = $3, updated = $4, deactivated = $5, error = $6 WHERE id = $1`,
    [id, stats.fetched, stats.inserted, stats.updated, stats.deactivated, stats.error ?? null],
  );
}

export interface ListingEvent {
  type: "new_listing";
  id: number;
  city: CityId;
}

/** Tell every connected web server about a change. Payloads stay tiny; clients fetch details. */
export async function publishEvent(e: ListingEvent): Promise<void> {
  await getPool().query(`SELECT pg_notify($1, $2)`, [LISTING_CHANNEL, JSON.stringify(e)]);
}

export async function stats(): Promise<{ city: string; active: number; likely: number; buildings: number }[]> {
  const { rows } = await getPool().query(`
    SELECT c.city,
      (SELECT count(*)::int FROM listings WHERE city = c.city AND status = 'active') AS active,
      (SELECT count(*)::int FROM listings WHERE city = c.city AND status = 'active' AND tier = 'likely') AS likely,
      (SELECT count(*)::int FROM buildings WHERE city = c.city) AS buildings
    FROM (SELECT DISTINCT city FROM listings UNION SELECT DISTINCT city FROM buildings) c ORDER BY c.city`);
  return rows;
}
