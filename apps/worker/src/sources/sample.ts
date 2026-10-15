import { existsSync, readFileSync } from "node:fs";
import type { CityRules } from "@getstabilized/core";
import { fixturePath } from "../paths";
import type { ListingSource, RawListing } from "./types";

export function loadSampleListings(city: CityRules): RawListing[] {
  const file = fixturePath("listings", `${city.id}.json`);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")) as RawListing[];
}

/** Fixture listings that ship with the repo. Works with no network or API keys. */
export const sampleSource: ListingSource = {
  id: "sample",
  async fetch(city) {
    return { listings: loadSampleListings(city), complete: true };
  },
};
