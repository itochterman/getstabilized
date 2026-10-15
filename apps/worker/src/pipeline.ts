import { assess, matchesFilters, normalizeAddress, type CityRules } from "@getstabilized/core";
import {
  activeSavedSearches, deactivateUnseen, findBuilding, finishRun, markAlertDelivered, publishEvent,
  recordAlert, startRun, upsertListing, type SavedSearch,
} from "@getstabilized/db";
import type { ListingSource, RawListing } from "./sources/types";
import type { Notifier } from "./notify";

export interface RunStats {
  source: string;
  city: string;
  fetched: number;
  inserted: number;
  updated: number;
  deactivated: number;
  alerts: number;
  error?: string;
}

/** Fetch one source for one city, then match, score, store, and announce new listings. */
export async function ingest(source: ListingSource, city: CityRules, notifier: Notifier, log = console.log): Promise<RunStats> {
  const run = await startRun(source.id, city.id);
  const stats: RunStats = { source: source.id, city: city.id, fetched: 0, inserted: 0, updated: 0, deactivated: 0, alerts: 0 };
  try {
    const raw = await source.fetch(city);
    stats.fetched = raw.length;
    const searches = await activeSavedSearches(city.id);
    for (const r of raw) {
      if (!isValid(r)) continue;
      const res = await storeListing(source.id, city, r);
      if (res.inserted) {
        stats.inserted++;
        await publishEvent({ type: "new_listing", id: res.id, city: city.id });
        stats.alerts += await alertMatches(searches, res, notifier);
      } else {
        stats.updated++;
      }
    }
    if (source.fullSnapshot) stats.deactivated = await deactivateUnseen(source.id, city.id, run.startedAt);
  } catch (e) {
    stats.error = e instanceof Error ? e.message : String(e);
  }
  await finishRun(run.id, stats);
  log(`[${source.id}/${city.id}] fetched ${stats.fetched}, new ${stats.inserted}, updated ${stats.updated}, gone ${stats.deactivated}, alerts ${stats.alerts}${stats.error ? `, error: ${stats.error}` : ""}`);
  return stats;
}

function isValid(r: RawListing): boolean {
  return Boolean(r.sourceId && r.address && Number.isFinite(r.rent) && r.rent > 0 && Number.isFinite(r.beds));
}

type Stored = Awaited<ReturnType<typeof upsertListing>> & Parameters<typeof matchesFilters>[0] & { title: string; address: string };

async function storeListing(sourceId: string, city: CityRules, r: RawListing): Promise<Stored> {
  const addressNorm = normalizeAddress(r.address);
  const building = await findBuilding(city.id, addressNorm);
  const a = assess({
    city: city.id,
    rent: r.rent,
    description: r.description ?? "",
    propertyType: r.propertyType,
    building,
    listedYearBuilt: r.yearBuilt ?? null,
    listedUnits: r.units ?? null,
  });
  const saved = await upsertListing({
    source: sourceId,
    sourceId: r.sourceId,
    city: city.id,
    title: r.title,
    address: r.address,
    addressNorm,
    neighborhood: r.neighborhood ?? null,
    beds: r.beds,
    baths: r.baths ?? null,
    rent: r.rent,
    sqft: r.sqft ?? null,
    description: r.description ?? "",
    url: r.url ?? null,
    noFee: r.noFee ?? null,
    propertyType: building && building.useType !== "unknown" ? building.useType : r.propertyType,
    yearBuilt: r.yearBuilt ?? null,
    units: r.units ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    buildingId: building?.id ?? null,
    score: a.score,
    tier: a.tier,
    reasons: a.reasons,
    listedAt: r.listedAt ? new Date(r.listedAt) : null,
  });
  return {
    ...saved, city: city.id, beds: r.beds, rent: r.rent, tier: a.tier, noFee: r.noFee ?? null,
    propertyType: building && building.useType !== "unknown" ? building.useType : r.propertyType,
    title: r.title, address: r.address,
  };
}

async function alertMatches(searches: SavedSearch[], l: Stored, notifier: Notifier): Promise<number> {
  let n = 0;
  for (const s of searches) {
    if (!matchesFilters(l, s.filters)) continue;
    if (!(await recordAlert(s.id, l.id))) continue;
    try {
      await notifier.send({ email: s.email, listingId: l.id, title: l.title, rent: l.rent, tier: l.tier });
      await markAlertDelivered(s.id, l.id);
      n++;
    } catch (e) {
      console.error(`alert to ${s.email} failed:`, e);
    }
  }
  return n;
}
