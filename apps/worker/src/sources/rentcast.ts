import type { CityRules, ListingContact, PriceEvent, PropertyType } from "@getstabilized/core";
import type { FetchResult, ListingSource, RawListing } from "./types";

/**
 * RentCast long term rental listings API.
 * Docs: https://developers.rentcast.io/reference/rental-listings-long-term
 * Schema: https://developers.rentcast.io/reference/property-listings-schema
 *
 * Every HTTP request counts against the RentCast plan (the free plan includes 50 a month
 * and bills extra requests), so each request must first be approved by `budget`.
 */
const BASE = "https://api.rentcast.io/v1/listings/rental/long-term";
const PAGE = 500;

const CITY_QUERY: Record<string, { city: string; state: string }> = {
  sf: { city: "San Francisco", state: "CA" },
  la: { city: "Los Angeles", state: "CA" },
  oak: { city: "Oakland", state: "CA" },
  nyc: { city: "New York", state: "NY" },
  dc: { city: "Washington", state: "DC" },
};

interface RcContact {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface RcHistoryEntry {
  event?: string;
  price?: number;
  listedDate?: string;
  removedDate?: string;
}

export interface RentcastListing {
  id: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  price?: number;
  status?: string;
  listedDate?: string;
  daysOnMarket?: number;
  mlsNumber?: string;
  listingAgent?: RcContact;
  listingOffice?: RcContact;
  builder?: RcContact;
  history?: Record<string, RcHistoryEntry>;
}

export interface RentcastBudget {
  /** Called before each HTTP request. Return false to stop without making it. */
  reserve(): Promise<boolean>;
  /** Called once per city before any request. Return a reason string to skip the city entirely. */
  shouldSkip?(city: CityRules): Promise<string | null>;
}

export function mapPropertyType(t: string | undefined): PropertyType {
  switch ((t ?? "").toLowerCase()) {
    case "apartment": return "apartment";
    case "multi-family": return "multi_family";
    case "single family": return "single_family";
    case "condo": return "condo";
    case "townhouse": return "townhouse";
    default: return "unknown";
  }
}

function contact(role: ListingContact["role"], c: RcContact | undefined): ListingContact | null {
  if (!c) return null;
  const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
  const out = { role, name: clean(c.name), phone: clean(c.phone), email: clean(c.email), website: clean(c.website) };
  return out.name || out.phone || out.email || out.website ? out : null;
}

function history(h: RentcastListing["history"]): PriceEvent[] {
  if (!h) return [];
  return Object.entries(h)
    .map(([date, e]) => ({ date: (e.listedDate ?? date).slice(0, 10), price: Number(e.price), event: e.event ?? "Listing" }))
    .filter((e) => Number.isFinite(e.price) && e.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mapRentcast(r: RentcastListing): RawListing | null {
  if (!r.price || !r.addressLine1) return null;
  const beds = Math.max(0, Math.round(r.bedrooms ?? 0));
  const type = mapPropertyType(r.propertyType);
  const street = r.addressLine1.replace(/\s+/g, " ").trim();
  const kind = type === "unknown" ? "rental" : type === "single_family" ? "house" : type.replace("_", " ");
  return {
    sourceId: r.id,
    title: `${beds === 0 ? "Studio" : `${beds} bed`} ${kind} on ${street.replace(/^\d+[A-Z]?\s+/, "")}`,
    address: [street, r.addressLine2].filter(Boolean).join(" "),
    neighborhood: r.zipCode ?? null,
    beds,
    baths: r.bathrooms ?? null,
    rent: r.price,
    sqft: r.squareFootage ?? null,
    description: "",
    url: null,
    noFee: null,
    propertyType: type,
    yearBuilt: r.yearBuilt ?? null,
    units: null,
    lat: r.latitude ?? null,
    lng: r.longitude ?? null,
    listedAt: r.listedDate ?? null,
    contacts: [contact("agent", r.listingAgent), contact("office", r.listingOffice), contact("builder", r.builder)].filter(
      (c): c is ListingContact => c !== null,
    ),
    mlsNumber: r.mlsNumber ?? null,
    priceHistory: history(r.history),
    daysOnMarket: r.daysOnMarket ?? null,
  };
}

export interface RentcastOptions {
  budget: RentcastBudget;
  /** Requests allowed per city per run. Each returns up to 500 listings. */
  maxPagesPerRun?: number;
  fetchImpl?: typeof fetch;
  /** Override for tests or a proxy. */
  baseUrl?: string;
}

export function makeRentcastSource(apiKey: string, opts: RentcastOptions): ListingSource {
  const f = opts.fetchImpl ?? fetch;
  const maxPages = Math.max(1, opts.maxPagesPerRun ?? 1);
  return {
    id: "rentcast",
    // A capped run sees only part of the market, so retire listings only after two weeks unseen.
    staleAfterDays: 14,
    async fetch(city: CityRules): Promise<FetchResult> {
      const q = CITY_QUERY[city.id];
      if (!q) return { listings: [], complete: false, skipped: "city not supported by RentCast" };
      const skip = await opts.budget.shouldSkip?.(city);
      if (skip) return { listings: [], complete: false, skipped: skip };
      const out: RawListing[] = [];
      for (let page = 0; page < maxPages; page++) {
        if (!(await opts.budget.reserve())) {
          return { listings: out, complete: false, skipped: out.length ? undefined : "monthly RentCast request limit reached" };
        }
        const url = new URL(opts.baseUrl || BASE);
        url.searchParams.set("city", q.city);
        url.searchParams.set("state", q.state);
        url.searchParams.set("status", "Active");
        url.searchParams.set("limit", String(PAGE));
        url.searchParams.set("offset", String(page * PAGE));
        const res = await f(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" } });
        if (!res.ok) throw new Error(`RentCast returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const rows = (await res.json()) as RentcastListing[];
        for (const r of rows) {
          const m = mapRentcast(r);
          if (m) out.push(m);
        }
        if (rows.length < PAGE) return { listings: out, complete: true };
      }
      return { listings: out, complete: false };
    },
  };
}
