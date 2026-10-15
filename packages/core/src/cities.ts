import type { PropertyType } from "./types";

export type CityId = "sf" | "la" | "oak" | "nyc" | "dc";

/**
 * Coverage rules per city. These are simplified screening rules, not legal advice:
 * each city has more exemptions than are modeled here. They decide which listings
 * deserve a closer look, and the agency link is where a renter confirms.
 */
export interface CityRules {
  id: CityId;
  name: string;
  state: string;
  /** Phrase used in the UI, e.g. "rent controlled". */
  term: string;
  /** Buildings built before this year are generally covered. */
  cutoffYear: number;
  /** When true, a building built in the cutoff year itself could go either way. */
  cutoffYearAmbiguous: boolean;
  cutoffLabel: string;
  /** Smallest building (in units) that is generally covered. */
  minUnits: number;
  exemptTypes: PropertyType[];
  exemptNote: string;
  /** Wording in a listing that states coverage outright. */
  strongKeywords: RegExp[];
  /** Wording that tends to appear on covered units. */
  supportKeywords: RegExp[];
  /** Tax programs that require stabilization (NYC only today). */
  taxBenefitsRequireCoverage: boolean;
  /**
   * True where a regulated unit's rent can reset to market when a tenant moves out
   * (California's vacancy decontrol). Past listing prices then say little about regulation.
   */
  vacancyResetAllowed: boolean;
  agency: { name: string; url: string };
}

const CA_EXEMPT: PropertyType[] = ["single_family", "condo", "townhouse"];
const CA_EXEMPT_NOTE =
  "California's Costa-Hawkins Act exempts most single family homes and condos from local rent control";

export const CITIES: Record<CityId, CityRules> = {
  sf: {
    id: "sf",
    name: "San Francisco",
    state: "CA",
    term: "rent controlled",
    cutoffYear: 1979,
    cutoffYearAmbiguous: true,
    cutoffLabel: "June 13, 1979",
    minUnits: 2,
    exemptTypes: CA_EXEMPT,
    exemptNote: CA_EXEMPT_NOTE,
    strongKeywords: [/\brent[- ]controll?ed\b/i, /\bunder rent control\b/i],
    supportKeywords: [/annual allowable increase/i, /\brent board\b/i, /just cause/i],
    taxBenefitsRequireCoverage: false,
    vacancyResetAllowed: true,
    agency: { name: "SF Rent Board", url: "https://sf.gov/departments/rent-board" },
  },
  la: {
    id: "la",
    name: "Los Angeles",
    state: "CA",
    term: "rent stabilized",
    cutoffYear: 1978,
    cutoffYearAmbiguous: true,
    cutoffLabel: "October 1, 1978",
    minUnits: 2,
    exemptTypes: CA_EXEMPT,
    exemptNote: CA_EXEMPT_NOTE,
    strongKeywords: [/\bRSO\b/, /\brent[- ]stabili[sz]ed\b/i, /\brent[- ]controll?ed\b/i],
    supportKeywords: [/annual allowable increase/i, /\bLAHD\b/, /registered unit/i],
    taxBenefitsRequireCoverage: false,
    vacancyResetAllowed: true,
    agency: { name: "LA Housing Department", url: "https://housing.lacity.gov" },
  },
  oak: {
    id: "oak",
    name: "Oakland",
    state: "CA",
    term: "rent controlled",
    cutoffYear: 1983,
    cutoffYearAmbiguous: false,
    cutoffLabel: "January 1, 1983",
    minUnits: 2,
    exemptTypes: CA_EXEMPT,
    exemptNote: CA_EXEMPT_NOTE,
    strongKeywords: [/\brent[- ]controll?ed\b/i, /rent adjustment program/i],
    supportKeywords: [/\bRAP\b/, /allowable increase/i, /just cause/i],
    taxBenefitsRequireCoverage: false,
    vacancyResetAllowed: true,
    agency: { name: "Oakland Rent Adjustment Program", url: "https://www.oaklandca.gov/topics/rent-adjustment-program" },
  },
  nyc: {
    id: "nyc",
    name: "New York City",
    state: "NY",
    term: "rent stabilized",
    cutoffYear: 1974,
    cutoffYearAmbiguous: false,
    cutoffLabel: "January 1, 1974",
    minUnits: 6,
    exemptTypes: ["single_family", "condo", "coop", "townhouse"],
    exemptNote: "Condos, co-ops, and houses are usually not stabilized",
    strongKeywords: [/\brent[- ]stabili[sz]ed\b/i],
    supportKeywords: [/lease rider/i, /\bDHCR\b/i, /legal (regulated )?rent/i, /preferential rent/i, /renewal lease/i],
    taxBenefitsRequireCoverage: true,
    vacancyResetAllowed: false,
    agency: { name: "NY State HCR", url: "https://hcr.ny.gov/rent-stabilization-and-rent-control" },
  },
  dc: {
    id: "dc",
    name: "Washington, DC",
    state: "DC",
    term: "rent stabilized",
    cutoffYear: 1976,
    cutoffYearAmbiguous: false,
    cutoffLabel: "1976",
    minUnits: 5,
    exemptTypes: ["single_family", "condo"],
    exemptNote: "Houses, condos, and buildings owned by small landlords are often exempt",
    strongKeywords: [/\brent[- ]stabili[sz]ed\b/i, /\brent[- ]controll?ed\b/i],
    supportKeywords: [/rental accommodations/i, /\bRAD\b/, /CPI increase/i],
    taxBenefitsRequireCoverage: false,
    vacancyResetAllowed: false,
    agency: { name: "DC Housing and Community Development", url: "https://dhcd.dc.gov" },
  },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];

export function isCityId(v: unknown): v is CityId {
  return typeof v === "string" && v in CITIES;
}

/** Wording that suggests a market rate, luxury, or temporary rental. */
export const NEGATIVE_KEYWORDS: RegExp[] = [/\bluxury\b/i, /\bsublet\b/i, /new construction/i, /board approval/i, /furnished short[- ]term/i];
