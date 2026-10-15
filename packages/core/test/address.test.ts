import { describe, expect, it } from "vitest";
import { normalizeAddress, parseSfAssessorLocation, matchesFilters, parseFilters } from "../src";

describe("normalizeAddress", () => {
  it.each([
    ["1234 Main Street, Apt 5, San Francisco, CA 94110", "1234 MAIN ST"],
    ["1234 main st #5", "1234 MAIN ST"],
    ["0420 Hayes St", "420 HAYES ST"],
    ["100-110 Valencia Street", "100 VALENCIA ST"],
    ["55 West 104th Street Unit 3B", "55 W 104TH ST"],
    ["2200 Fifth Avenue", "2200 5TH AVE"],
    ["800 Haight Av", "800 HAIGHT AVE"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeAddress(input)).toBe(out);
  });
});

describe("parseSfAssessorLocation", () => {
  it("parses DataSF fixed width locations", () => {
    expect(parseSfAssessorLocation("0000 0420 HAYES                ST0000")).toBe("420 HAYES ST");
    expect(parseSfAssessorLocation("0000 1650 GOLDEN GATE          AV0012")).toBe("1650 GOLDEN GATE AV");
  });
  it("matches listings after normalization", () => {
    expect(normalizeAddress(parseSfAssessorLocation("0000 1650 GOLDEN GATE          AV0012"))).toBe(normalizeAddress("1650 Golden Gate Avenue #12"));
  });
});

describe("filters", () => {
  const l = { city: "sf" as const, beds: 1, rent: 2500, tier: "likely" as const, noFee: true, propertyType: "apartment" as const };
  it("parses query params safely", () => {
    expect(parseFilters({ city: "nowhere" })).toBeNull();
    expect(parseFilters({ city: "sf", beds: "any", maxRent: "3000", noFee: "true" })).toMatchObject({ city: "sf", beds: null, maxRent: 3000, noFee: true });
  });
  it("matches like the search query", () => {
    expect(matchesFilters(l, { city: "sf", beds: 1, maxRent: 3000 })).toBe(true);
    expect(matchesFilters(l, { city: "sf", maxRent: 2000 })).toBe(false);
    expect(matchesFilters({ ...l, beds: 4 }, { city: "sf", beds: 3 })).toBe(true);
    expect(matchesFilters({ ...l, propertyType: "condo" }, { city: "sf", hideExempt: true })).toBe(false);
  });
});
