import { readFileSync } from "node:fs";
import { normalizeAddress, parseSfAssessorLocation, type PropertyType } from "@getstabilized/core";
import type { BuildingRow } from "@getstabilized/db";

/**
 * San Francisco building records from the Assessor's secured property tax rolls on DataSF.
 * Dataset: https://data.sfgov.org/Housing-and-Buildings/Assessor-Historical-Secured-Property-Tax-Rolls/wv5m-vpq2
 * Uses the Socrata SODA API. Field names follow the dataset's published columns.
 */
export const DATASF_DATASET = "https://data.sfgov.org/resource/wv5m-vpq2.json";

export interface AssessorRow {
  parcel_number?: string;
  property_location?: string;
  year_property_built?: string;
  number_of_units?: string;
  use_definition?: string;
  property_class_code?: string;
  closed_roll_year?: string;
}

/** Class code "Z" marks condominium parcels on SF rolls. Use definitions cover the rest. */
export function mapUseType(useDefinition = "", classCode = ""): PropertyType {
  if (classCode.trim().toUpperCase() === "Z") return "condo";
  const u = useDefinition.toLowerCase();
  if (u.includes("single family")) return "single_family";
  if (u.includes("multi-family") || u.includes("multi family")) return "apartment";
  if (u.includes("mixed")) return "apartment";
  return "unknown";
}

function int(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function mapAssessorRow(r: AssessorRow): BuildingRow | null {
  if (!r.parcel_number || !r.property_location) return null;
  const address = parseSfAssessorLocation(r.property_location);
  const addressNorm = normalizeAddress(address);
  if (!/^\d/.test(addressNorm)) return null; // no street number, can't match listings
  const year = int(r.year_property_built);
  return {
    city: "sf",
    parcel: r.parcel_number,
    address,
    addressNorm,
    // Year 0 or far future values appear in the rolls as placeholders.
    yearBuilt: year && year >= 1800 && year <= new Date().getFullYear() + 1 ? year : null,
    units: int(r.number_of_units),
    useType: mapUseType(r.use_definition, r.property_class_code),
    taxBenefit: null,
    registered: false,
    source: "datasf-assessor",
  };
}

/** Pull residential parcels for the latest roll year, 50,000 rows per page. */
export async function fetchAssessorRows(opts: { year?: string; appToken?: string; fetchImpl?: typeof fetch; log?: (m: string) => void } = {}): Promise<AssessorRow[]> {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.appToken) headers["X-App-Token"] = opts.appToken;
  let year = opts.year;
  if (!year) {
    const u = new URL(DATASF_DATASET);
    u.searchParams.set("$select", "max(closed_roll_year) AS y");
    const r = await f(u, { headers });
    if (!r.ok) throw new Error(`DataSF returned ${r.status}`);
    year = ((await r.json()) as { y: string }[])[0]?.y;
    if (!year) throw new Error("Could not find the latest roll year on DataSF");
  }
  const rows: AssessorRow[] = [];
  const page = 50000;
  for (let offset = 0; ; offset += page) {
    const u = new URL(DATASF_DATASET);
    u.searchParams.set("$select", "parcel_number,property_location,year_property_built,number_of_units,use_definition,property_class_code,closed_roll_year");
    u.searchParams.set("$where", `closed_roll_year='${year.replace(/'/g, "")}' AND (use_definition like '%Residential%' OR use_definition like '%Mixed%')`);
    u.searchParams.set("$order", "parcel_number");
    u.searchParams.set("$limit", String(page));
    u.searchParams.set("$offset", String(offset));
    const r = await f(u, { headers });
    if (!r.ok) throw new Error(`DataSF returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const batch = (await r.json()) as AssessorRow[];
    rows.push(...batch);
    opts.log?.(`fetched ${rows.length} parcels from roll year ${year}`);
    if (batch.length < page) break;
  }
  return rows;
}

export function readAssessorFile(path: string): AssessorRow[] {
  return JSON.parse(readFileSync(path, "utf8")) as AssessorRow[];
}
