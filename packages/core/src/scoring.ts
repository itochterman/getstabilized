import { CITIES, NEGATIVE_KEYWORDS, type CityId } from "./cities";
import type { Assessment, BuildingFacts, PropertyType, Reason, Tier } from "./types";

export interface ScoringInput {
  city: CityId;
  rent: number;
  description: string;
  propertyType: PropertyType;
  /** Matched public building record, if any. */
  building: BuildingFacts | null;
  /** Year built and unit count as stated by the listing source, used when no record matched. */
  listedYearBuilt?: number | null;
  listedUnits?: number | null;
}

export const POINTS = {
  start: 10,
  rentCents: 20,
  rentUneven: 15,
  rentRound: -5,
  strongKeyword: 35,
  supportKeywordEach: 12,
  supportKeywordMax: 24,
  negativeKeywords: -10,
  exemptType: -30,
  builtAfterCutoff: -30,
  tooFewUnits: -25,
  coveredBuilding: 35,
  coveredBuildingUnitsUnknown: 25,
  taxBenefit: 30,
  registered: 35,
} as const;

/** Raw points become a 1 to 99 score with diminishing returns, so no listing reads as certain. */
export function pointsToScore(points: number): number {
  const s = Math.round(99 * (1 - Math.exp(-Math.max(points, 0) / 50)));
  return Math.min(99, Math.max(1, s));
}

export function tierFor(score: number): Tier {
  if (score >= 70) return "likely";
  if (score >= 40) return "maybe";
  return "unlikely";
}

export function formatMoney(n: number, withCents = false): string {
  return "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: withCents && n % 1 ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
}

/**
 * Capped yearly increases are percentages of the prior rent, so regulated rents
 * drift to uneven amounts. Market rents are usually set on round numbers.
 */
export function rentShape(rent: number): "cents" | "uneven" | "round" {
  const cents = Math.round((rent % 1) * 100);
  if (cents > 0) return "cents";
  if (Math.floor(rent) % 25 !== 0) return "uneven";
  return "round";
}

export function assess(input: ScoringInput): Assessment {
  const city = CITIES[input.city];
  const reasons: Reason[] = [];
  const add = (code: string, points: number, text: string, neutral = false) =>
    reasons.push({ code, points, text, direction: neutral ? "neutral" : points >= 0 ? "up" : "down" });

  // 1. Pricing
  const shape = rentShape(input.rent);
  if (shape === "cents") add("rent_cents", POINTS.rentCents, `The rent is an uneven ${formatMoney(input.rent, true)}, down to the cent. Capped yearly increases produce amounts like this.`);
  else if (shape === "uneven") add("rent_uneven", POINTS.rentUneven, `The rent is an uneven ${formatMoney(input.rent)}. Capped yearly increases often produce amounts like this.`);
  else add("rent_round", POINTS.rentRound, `The rent is a round ${formatMoney(input.rent)}, which is more typical of market rate pricing.`);

  // 2. Listing language
  const text = input.description || "";
  if (city.strongKeywords.some((r) => r.test(text))) {
    add("keyword_strong", POINTS.strongKeyword, `The listing says it's ${city.term}.`);
  } else {
    const hits = city.supportKeywords.filter((r) => r.test(text)).length;
    if (hits > 0) add("keyword_support", Math.min(POINTS.supportKeywordMax, hits * POINTS.supportKeywordEach), `The listing uses language that usually comes with ${city.term} units.`);
  }
  if (NEGATIVE_KEYWORDS.some((r) => r.test(text))) add("keyword_negative", POINTS.negativeKeywords, "The listing reads like a luxury, new, or temporary rental.");

  // 3. Property type. A building record's use type beats the listing's own label.
  const type = input.building && input.building.useType !== "unknown" ? input.building.useType : input.propertyType;
  const exempt = city.exemptTypes.includes(type);
  if (exempt) add("exempt_type", POINTS.exemptType, `It's a ${typeLabel(type)}. ${city.exemptNote}.`);

  // 4. Building age and size
  const year = input.building?.yearBuilt ?? input.listedYearBuilt ?? null;
  const units = input.building?.units ?? input.listedUnits ?? null;
  const fromRecord = input.building?.yearBuilt != null;
  if (!exempt) {
    if (year == null) {
      add("building_unknown", 0, "We couldn't match this address to a building record yet, so the building's age is unknown.", true);
    } else if (year > city.cutoffYear) {
      add("built_after_cutoff", POINTS.builtAfterCutoff, `Built in ${year}, after ${city.name}'s ${city.cutoffLabel} cutoff.`);
    } else if (year === city.cutoffYear && city.cutoffYearAmbiguous) {
      add("built_cutoff_year", 0, `Built in ${year}, the cutoff year. Coverage depends on the exact date (${city.cutoffLabel}).`, true);
    } else if (year === city.cutoffYear) {
      add("built_after_cutoff", POINTS.builtAfterCutoff, `Built in ${year}, on or after ${city.name}'s ${city.cutoffLabel} cutoff.`);
    } else if (units != null && units < city.minUnits) {
      add("too_few_units", POINTS.tooFewUnits, `The building has ${units} unit${units === 1 ? "" : "s"}. Buildings this small are usually exempt in ${city.name}.`);
    } else if (units == null) {
      add("covered_building", POINTS.coveredBuildingUnitsUnknown, `Built in ${year}, before ${city.name}'s ${city.cutoffLabel} cutoff. Unit count unknown.`);
    } else {
      add("covered_building", POINTS.coveredBuilding, `Built in ${year}, before ${city.name}'s ${city.cutoffLabel} cutoff, with ${units} units${fromRecord ? " per city records" : ""}.`);
    }
  }

  // 5. Programs that require regulation
  if (input.building?.taxBenefit && city.taxBenefitsRequireCoverage) {
    add("tax_benefit", POINTS.taxBenefit, `The building receives the ${input.building.taxBenefit} tax benefit, which requires stabilized rents.`);
  }
  if (input.building?.registered) {
    add("registered", POINTS.registered, `The building is on the government's list of buildings with registered regulated units.`);
  }

  const points = POINTS.start + reasons.reduce((a, r) => a + r.points, 0);
  const score = pointsToScore(points);
  const order = { up: 0, neutral: 1, down: 2 } as const;
  reasons.sort((a, b) => order[a.direction] - order[b.direction] || Math.abs(b.points) - Math.abs(a.points));
  return { score, tier: tierFor(score), points, reasons };
}

export function typeLabel(t: PropertyType): string {
  return {
    apartment: "apartment",
    multi_family: "multi family building",
    single_family: "single family home",
    condo: "condo",
    coop: "co-op",
    townhouse: "townhouse",
    unknown: "property of unknown type",
  }[t];
}
