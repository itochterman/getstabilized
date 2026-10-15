import type { CityRules, PropertyType } from "@getstabilized/core";
import type { ListingSource, RawListing } from "./types";

/**
 * RentCast long term rental listings API.
 * Docs: https://developers.rentcast.io/reference/rental-listings-long-term
 * Requires RENTCAST_API_KEY. Field names below follow RentCast's documented response;
 * check them against a live response before relying on them in production.
 */
const BASE = "https://api.rentcast.io/v1/listings/rental/long-term";
const PAGE = 500;
const MAX_PAGES = 10;

const CITY_QUERY: Record<string, { city: string; state: string }> = {
  sf: { city: "San Francisco", state: "CA" },
  la: { city: "Los Angeles", state: "CA" },
  oak: { city: "Oakland", state: "CA" },
  nyc: { city: "New York", state: "NY" },
  dc: { city: "Washington", state: "DC" },
};

interface RentcastListing {
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

export function mapRentcast(r: RentcastListing): RawListing | null {
  if (!r.price || !r.addressLine1) return null;
  const beds = Math.max(0, Math.round(r.bedrooms ?? 0));
  const type = mapPropertyType(r.propertyType);
  const street = r.addressLine1.replace(/\s+/g, " ").trim();
  return {
    sourceId: r.id,
    title: `${beds === 0 ? "Studio" : `${beds} bed`} ${type === "unknown" ? "rental" : type.replace("_", " ")} on ${street.replace(/^\d+\s+/, "")}`,
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
  };
}

export function makeRentcastSource(apiKey: string, fetchImpl: typeof fetch = fetch): ListingSource {
  return {
    id: "rentcast",
    fullSnapshot: true,
    async fetch(city: CityRules): Promise<RawListing[]> {
      const q = CITY_QUERY[city.id];
      if (!q) return [];
      const out: RawListing[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(BASE);
        url.searchParams.set("city", q.city);
        url.searchParams.set("state", q.state);
        url.searchParams.set("status", "Active");
        url.searchParams.set("limit", String(PAGE));
        url.searchParams.set("offset", String(page * PAGE));
        const res = await fetchImpl(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" } });
        if (!res.ok) throw new Error(`RentCast returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const rows = (await res.json()) as RentcastListing[];
        for (const r of rows) {
          const m = mapRentcast(r);
          if (m) out.push(m);
        }
        if (rows.length < PAGE) break;
      }
      return out;
    },
  };
}
