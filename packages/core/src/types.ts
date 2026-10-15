export type PropertyType =
  | "apartment"
  | "multi_family"
  | "single_family"
  | "condo"
  | "coop"
  | "townhouse"
  | "unknown";

export type Tier = "likely" | "maybe" | "unlikely";

/** What we know about the building a listing sits in, from public records. */
export interface BuildingFacts {
  yearBuilt: number | null;
  units: number | null;
  useType: PropertyType;
  taxBenefit: string | null;
  /** On a government list of registered rent regulated buildings. */
  registered: boolean;
}

export interface Reason {
  /** Stable identifier for analytics and tests. */
  code: string;
  direction: "up" | "down" | "neutral";
  points: number;
  text: string;
}

/** Who to contact about a listing, as provided by the listing source. */
export interface ListingContact {
  role: "agent" | "office" | "builder";
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

/** A past listing of the same unit. */
export interface PriceEvent {
  date: string; // YYYY-MM-DD
  price: number;
  event: string;
}

export interface Assessment {
  score: number;
  tier: Tier;
  points: number;
  reasons: Reason[];
}
