import { describe, expect, it } from "vitest";
import { CITIES } from "@getstabilized/core";
import { mapAssessorRow, mapUseType, readAssessorFile } from "../src/importers/datasf";
import { makeDemoSource } from "../src/sources/demo";
import { mapRentcast, makeRentcastSource } from "../src/sources/rentcast";
import { fixturePath } from "../src/paths";

describe("DataSF importer", () => {
  it("maps assessor rows to buildings", () => {
    const b = mapAssessorRow({
      parcel_number: "0812001", property_location: "0000 0420 HAYES                ST0000",
      year_property_built: "1928", number_of_units: "40", use_definition: "Multi-Family Residential", property_class_code: "A",
    });
    expect(b).toMatchObject({ city: "sf", address: "420 HAYES ST", addressNorm: "420 HAYES ST", yearBuilt: 1928, units: 40, useType: "apartment" });
  });
  it("drops placeholder years and detects condos", () => {
    const b = mapAssessorRow({ parcel_number: "1", property_location: "0000 0300 BERRY ST0000", year_property_built: "0", use_definition: "Multi-Family Residential", property_class_code: "Z" });
    expect(b?.yearBuilt).toBeNull();
    expect(b?.useType).toBe("condo");
    expect(mapUseType("Single Family Residential")).toBe("single_family");
  });
  it("parses every fixture row", () => {
    const rows = readAssessorFile(fixturePath("buildings", "sf-assessor-sample.json"));
    expect(rows.map(mapAssessorRow).every(Boolean)).toBe(true);
  });
  it("pages through DataSF until a short page", async () => {
    const calls: string[] = [];
    const fake = (async (u: URL) => {
      calls.push(String(u));
      if (u.searchParams.get("$select")?.startsWith("max")) return new Response(JSON.stringify([{ y: "2023" }]));
      return new Response(JSON.stringify([{ parcel_number: "1", property_location: "0000 0001 A ST0000" }]));
    }) as unknown as typeof fetch;
    const { fetchAssessorRows } = await import("../src/importers/datasf");
    const rows = await fetchAssessorRows({ fetchImpl: fake });
    expect(rows).toHaveLength(1);
    expect(calls[1]).toContain("closed_roll_year%3D%272023%27");
  });
});

describe("RentCast source", () => {
  it("maps a listing", () => {
    const m = mapRentcast({ id: "abc", addressLine1: "1650 Golden Gate Ave", addressLine2: "Apt 4", propertyType: "Apartment", bedrooms: 1, bathrooms: 1, price: 2687, yearBuilt: 1912, zipCode: "94115" });
    expect(m).toMatchObject({ sourceId: "abc", address: "1650 Golden Gate Ave Apt 4", beds: 1, rent: 2687, propertyType: "apartment", yearBuilt: 1912 });
    expect(mapRentcast({ id: "x" })).toBeNull();
  });
  it("sends the API key and stops on a short page", async () => {
    let seen: Headers | undefined;
    const fake = (async (_u: URL, init: RequestInit) => {
      seen = new Headers(init.headers);
      return new Response(JSON.stringify([{ id: "1", addressLine1: "1 A St", price: 2000, bedrooms: 0 }]));
    }) as unknown as typeof fetch;
    const out = await makeRentcastSource("k", fake).fetch(CITIES.sf);
    expect(out).toHaveLength(1);
    expect(seen?.get("X-Api-Key")).toBe("k");
  });
});

describe("demo source", () => {
  it("produces 1 or 2 new listings with unique ids", async () => {
    const src = makeDemoSource();
    const a = await src.fetch(CITIES.sf);
    const b = await src.fetch(CITIES.sf);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(2);
    expect(new Set([...a, ...b].map((l) => l.sourceId)).size).toBe(a.length + b.length);
  });
});
