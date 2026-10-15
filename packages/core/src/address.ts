const SUFFIX: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", AV: "AVE", BOULEVARD: "BLVD", DRIVE: "DR", PLACE: "PL",
  TERRACE: "TER", COURT: "CT", LANE: "LN", ROAD: "RD", PARKWAY: "PKWY", HIGHWAY: "HWY",
  ALLEY: "ALY", WAY: "WAY", CIRCLE: "CIR", SQUARE: "SQ", PLAZA: "PLZ",
};
const DIRECTION: Record<string, string> = { NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W" };
const ORDINAL: Record<string, string> = {
  FIRST: "1ST", SECOND: "2ND", THIRD: "3RD", FOURTH: "4TH", FIFTH: "5TH", SIXTH: "6TH",
  SEVENTH: "7TH", EIGHTH: "8TH", NINTH: "9TH", TENTH: "10TH",
};

/**
 * Reduce a street address to a comparable key: "1234 Main Street, Apt 5, San Francisco, CA"
 * becomes "1234 MAIN ST". Unit numbers, city, state, and zip are dropped so a listing
 * matches its building's record.
 */
export function normalizeAddress(raw: string): string {
  let s = raw.toUpperCase();
  s = s.split(",")[0] ?? s; // street line only
  s = s.replace(/\s(#|APT\.?|UNIT|STE\.?|SUITE|FL\.?|FLOOR)\s*[\w-]+\s*$/, "");
  s = s.replace(/#\s*[\w-]+/g, "");
  s = s.replace(/[.'’]/g, "").replace(/[^A-Z0-9\s-]/g, " ");
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  // House number: drop leading zeros and ranges like 100-110 (keep the first number)
  const first = parts[0]!;
  if (/^\d+[A-Z]?(-\d+[A-Z]?)?$/.test(first)) parts[0] = first.split("-")[0]!.replace(/^0+(?=\d)/, "");
  return parts
    .map((p, i) => {
      if (i === 0) return p;
      if (SUFFIX[p] && i === parts.length - 1) return SUFFIX[p];
      if (DIRECTION[p] && (i === 1 || i === parts.length - 1)) return DIRECTION[p];
      if (ORDINAL[p]) return ORDINAL[p];
      return p.replace(/^0+(?=\d)/, "");
    })
    .join(" ");
}

/**
 * DataSF assessor rolls store locations as fixed width strings such as
 * "0000 0420 HAYES                ST0000" (from number, to number, street, type, unit).
 * Returns a plain street line like "420 HAYES ST".
 */
export function parseSfAssessorLocation(loc: string): string {
  const m = loc.trim().match(/^(\d{4})\s+(\d{4}[A-Z]?)\s+(.+?)\s*([A-Z]{2})?(\d{4}[A-Z]?)?$/);
  if (!m) return loc.replace(/\s+/g, " ").trim();
  const num = m[2]!.replace(/^0+(?=\d)/, "");
  const street = m[3]!.replace(/\s+/g, " ").trim();
  const type = m[4] ?? "";
  return `${num} ${street}${type ? " " + type : ""}`.trim();
}
