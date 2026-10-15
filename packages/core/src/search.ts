import { isCityId, type CityId } from "./cities";
import type { PropertyType, Reason, Tier } from "./types";

export type SortKey = "best" | "cheap" | "likely" | "newest";

/** Filters shared by the search API, saved searches, and alert matching. */
export interface SearchFilters {
  city: CityId;
  beds?: number | null; // 0 = studio, 3 = 3 or more
  maxRent?: number | null;
  likelyOnly?: boolean;
  noFee?: boolean;
  hideExempt?: boolean;
}

export interface ListingDTO {
  id: number;
  source: string;
  city: CityId;
  title: string;
  address: string;
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
  buildingMatched: boolean;
  score: number;
  tier: Tier;
  reasons: Reason[];
  firstSeen: string;
}

const EXEMPT_TYPES: PropertyType[] = ["condo", "coop", "single_family", "townhouse"];

/** Same logic the SQL query applies, used by the worker to match saved searches. */
export function matchesFilters(l: Pick<ListingDTO, "city" | "beds" | "rent" | "tier" | "noFee" | "propertyType">, f: SearchFilters): boolean {
  if (l.city !== f.city) return false;
  if (f.beds != null && (f.beds >= 3 ? l.beds < 3 : l.beds !== f.beds)) return false;
  if (f.maxRent != null && l.rent > f.maxRent) return false;
  if (f.likelyOnly && l.tier !== "likely") return false;
  if (f.noFee && l.noFee !== true) return false;
  if (f.hideExempt && EXEMPT_TYPES.includes(l.propertyType)) return false;
  return true;
}

/** Parse untrusted query params or JSON into filters. Returns null when the city is missing or unknown. */
export function parseFilters(input: Record<string, unknown>): SearchFilters | null {
  if (!isCityId(input.city)) return null;
  const num = (v: unknown) => {
    if (v === undefined || v === null || v === "" || v === "any") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const bool = (v: unknown) => v === true || v === "true" || v === "1";
  return {
    city: input.city,
    beds: num(input.beds),
    maxRent: num(input.maxRent),
    likelyOnly: bool(input.likelyOnly),
    noFee: bool(input.noFee),
    hideExempt: bool(input.hideExempt),
  };
}

export const EXEMPT_PROPERTY_TYPES = EXEMPT_TYPES;
