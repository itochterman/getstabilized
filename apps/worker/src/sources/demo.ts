import type { CityRules } from "@getstabilized/core";
import { loadSampleListings } from "./sample";
import type { ListingSource, RawListing } from "./types";

const OPENERS = ["Bright", "Quiet", "Sunny", "Spacious", "Updated", "Charming", "Top floor", "Corner"];
const EXTRAS = [
  "Laundry in building.",
  "Heat and hot water included.",
  "Cats considered.",
  "Hardwood floors throughout.",
  "Annual allowable increase only.",
  "Luxury finishes and in unit laundry.",
  "Close to transit.",
];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}

/**
 * Invents 1 or 2 fresh listings per run, placed at addresses from the sample data so
 * they match real building records. Use it to watch live updates arrive in the UI.
 */
export function makeDemoSource(rnd: () => number = Math.random): ListingSource {
  return {
    id: "demo",
    fullSnapshot: false,
    async fetch(city: CityRules): Promise<RawListing[]> {
      const base = loadSampleListings(city);
      if (base.length === 0) return [];
      const count = 1 + Math.floor(rnd() * 2);
      const out: RawListing[] = [];
      for (let i = 0; i < count; i++) {
        const t = pick(base, rnd);
        const beds = Math.max(0, Math.min(3, t.beds + (rnd() < 0.3 ? 1 : 0) - (rnd() < 0.3 ? 1 : 0)));
        const baseRent = 1500 + beds * 650 + rnd() * 900;
        // Roughly half get regulated looking rents, the rest round market prices.
        const rent = rnd() < 0.5 ? Math.round(baseRent * 100) / 100 : Math.round(baseRent / 50) * 50;
        const street = t.address.split(/[#,]| Apt | Unit /i)[0]!.trim();
        const unit = `${1 + Math.floor(rnd() * 6)}${"ABCD"[Math.floor(rnd() * 4)]}`;
        const bedLabel = beds === 0 ? "studio" : `${beds}BR`;
        out.push({
          ...t,
          sourceId: `demo-${Date.now()}-${i}-${Math.floor(rnd() * 1e6)}`,
          title: `${pick(OPENERS, rnd)} ${bedLabel} in ${t.neighborhood ?? city.name}`,
          address: `${street} #${unit}`,
          beds,
          rent,
          noFee: rnd() < 0.6,
          description: `${pick(OPENERS, rnd)} ${bedLabel}. ${pick(EXTRAS, rnd)} ${pick(EXTRAS, rnd)}`,
          listedAt: new Date().toISOString(),
        });
      }
      return out;
    },
  };
}
