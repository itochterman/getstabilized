import { describe, expect, it } from "vitest";
import { assess, pointsToScore, rentShape, tierFor, type BuildingFacts } from "../src";

const oldSfBuilding: BuildingFacts = { yearBuilt: 1924, units: 12, useType: "apartment", taxBenefit: null, registered: false };

describe("rentShape", () => {
  it("flags cents, uneven dollars, and round amounts", () => {
    expect(rentShape(2687.4)).toBe("cents");
    expect(rentShape(2347)).toBe("uneven");
    expect(rentShape(3150)).toBe("round");
    expect(rentShape(2475)).toBe("round");
  });
});

describe("pointsToScore", () => {
  it("stays between 1 and 99 and rises with points", () => {
    expect(pointsToScore(-100)).toBe(1);
    expect(pointsToScore(1000)).toBe(99);
    expect(pointsToScore(60)).toBeLessThan(pointsToScore(90));
  });
  it("maps to tiers", () => {
    expect(tierFor(85)).toBe("likely");
    expect(tierFor(55)).toBe("maybe");
    expect(tierFor(10)).toBe("unlikely");
  });
});

describe("assess", () => {
  it("rates an old SF building with an uneven rent and explicit wording as likely", () => {
    const a = assess({ city: "sf", rent: 2687.4, description: "Rent controlled Edwardian.", propertyType: "apartment", building: oldSfBuilding });
    expect(a.tier).toBe("likely");
    expect(a.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["rent_cents", "keyword_strong", "covered_building"]));
  });

  it("rates new luxury construction as unlikely", () => {
    const a = assess({
      city: "sf", rent: 3150, description: "Luxury studio, new construction.", propertyType: "apartment",
      building: { yearBuilt: 2016, units: 180, useType: "apartment", taxBenefit: null, registered: false },
    });
    expect(a.tier).toBe("unlikely");
    expect(a.reasons.some((r) => r.code === "built_after_cutoff")).toBe(true);
  });

  it("treats California condos as exempt even in old buildings", () => {
    const a = assess({ city: "sf", rent: 2400, description: "", propertyType: "apartment", building: { ...oldSfBuilding, useType: "condo" } });
    expect(a.reasons[0]?.code === "exempt_type" || a.reasons.some((r) => r.code === "exempt_type")).toBe(true);
    expect(a.reasons.some((r) => r.code === "covered_building")).toBe(false);
    expect(a.tier).toBe("unlikely");
  });

  it("is neutral about the cutoff year when the cutoff falls mid year", () => {
    const a = assess({ city: "sf", rent: 2400, description: "", propertyType: "apartment", building: { ...oldSfBuilding, yearBuilt: 1979 } });
    expect(a.reasons.find((r) => r.code === "built_cutoff_year")?.direction).toBe("neutral");
  });

  it("applies NYC's 6 unit minimum and tax benefit rule", () => {
    const small = assess({ city: "nyc", rent: 3100, description: "", propertyType: "apartment", building: { yearBuilt: 1899, units: 3, useType: "apartment", taxBenefit: null, registered: false } });
    expect(small.reasons.some((r) => r.code === "too_few_units")).toBe(true);
    const tax = assess({ city: "nyc", rent: 3511.27, description: "", propertyType: "apartment", building: { yearBuilt: 2019, units: 210, useType: "apartment", taxBenefit: "421-a", registered: true } });
    expect(tax.reasons.some((r) => r.code === "tax_benefit")).toBe(true);
    expect(tax.tier).not.toBe("unlikely");
  });

  it("falls back to listed year built when no record matched", () => {
    const a = assess({ city: "la", rent: 2213.48, description: "", propertyType: "apartment", building: null, listedYearBuilt: 1936, listedUnits: 10 });
    expect(a.reasons.some((r) => r.code === "covered_building")).toBe(true);
    const b = assess({ city: "la", rent: 2213.48, description: "", propertyType: "apartment", building: null });
    expect(b.reasons.some((r) => r.code === "building_unknown")).toBe(true);
  });

  it("orders positive reasons first", () => {
    const a = assess({ city: "sf", rent: 3150, description: "Rent controlled", propertyType: "apartment", building: oldSfBuilding });
    expect(a.reasons[0]?.direction).toBe("up");
    expect(a.reasons.at(-1)?.direction).toBe("down");
  });
});
