import { CITIES, CITY_IDS, isCityId, type CityId } from "@getstabilized/core";
import { apiUsageThisMonth, closePool, lastSuccessfulRun, loadEnv, migrate, reserveApiRequest, retireSources, stats, upsertBuildings } from "@getstabilized/db";
import { fetchAssessorRows, mapAssessorRow, readAssessorFile } from "./importers/datasf";
import { consoleNotifier } from "./notify";
import { ingest } from "./pipeline";
import { fixturePath } from "./paths";
import { makeDemoSource } from "./sources/demo";
import { makeRentcastSource } from "./sources/rentcast";
import { sampleSource } from "./sources/sample";
import type { ListingSource } from "./sources/types";

const HELP = `GetStabilized worker

  import-buildings --city sf [--file path.json] [--year 2023]
      Load building records. Without --file, downloads from DataSF.

  ingest [--city sf,la] [--source sample,demo,rentcast] [--watch] [--interval 5]
      Fetch listings, match buildings, score, store, and send alerts.
      --watch repeats every --interval minutes (default INGEST_INTERVAL_MINUTES or 5).

  seed
      Migrate, load the sample SF buildings, and ingest sample listings for every city.

  stats
      Show listing and building counts per city, and this month's RentCast usage.

  retire --source sample,demo
      Hide every listing from those sources (for example, sample data once real listings flow).

RentCast budget (environment variables):
  RENTCAST_CITIES          cities to fetch, default "sf"
  RENTCAST_HOURS_BETWEEN   minimum hours between fetches per city, default 24
  RENTCAST_PAGES_PER_RUN   requests per city per fetch (500 listings each), default 1
  RENTCAST_MONTHLY_LIMIT   hard stop for requests per calendar month, default 45
`;

const num = (v: string | undefined, d: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

function args(argv: string[]) {
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[a.slice(2)] = next;
      i++;
    } else flags[a.slice(2)] = true;
  }
  return flags;
}

function cities(v: string | true | undefined): CityId[] {
  if (!v || v === true || v === "all") return CITY_IDS;
  const ids = v.split(",").map((s) => s.trim());
  const bad = ids.filter((c) => !isCityId(c));
  if (bad.length) throw new Error(`Unknown city: ${bad.join(", ")}. Use one of ${CITY_IDS.join(", ")}.`);
  return ids as CityId[];
}

function sources(v: string | true | undefined): ListingSource[] {
  const ids = (typeof v === "string" ? v : process.env.LISTING_SOURCES || "sample").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.map((id) => {
    if (id === "sample") return sampleSource;
    if (id === "demo") return makeDemoSource();
    if (id === "rentcast") {
      const key = process.env.RENTCAST_API_KEY;
      if (!key) throw new Error("The rentcast source needs RENTCAST_API_KEY in .env");
      const allowed = (process.env.RENTCAST_CITIES || "sf").split(",").map((c) => c.trim());
      const hours = num(process.env.RENTCAST_HOURS_BETWEEN, 24);
      const limit = num(process.env.RENTCAST_MONTHLY_LIMIT, 45);
      return makeRentcastSource(key, {
        maxPagesPerRun: num(process.env.RENTCAST_PAGES_PER_RUN, 1),
        baseUrl: process.env.RENTCAST_BASE_URL,
        budget: {
          reserve: () => reserveApiRequest("rentcast", limit),
          async shouldSkip(city) {
            if (!allowed.includes(city.id)) return `not in RENTCAST_CITIES (${allowed.join(",")})`;
            const last = await lastSuccessfulRun("rentcast", city.id);
            // Small allowance so a daily schedule that drifts a few minutes still runs.
            if (last && Date.now() - last.getTime() < hours * 3600_000 - 15 * 60_000) {
              return `fetched ${Math.round((Date.now() - last.getTime()) / 3600_000)}h ago; waits ${hours}h between fetches`;
            }
            return null;
          },
        },
      });
    }
    throw new Error(`Unknown source: ${id}`);
  });
}

async function importBuildings(flags: Record<string, string | true>) {
  const city = flags.city ?? "sf";
  if (city !== "sf") throw new Error("Only San Francisco building import is built so far (--city sf).");
  const rows = typeof flags.file === "string"
    ? readAssessorFile(flags.file)
    : await fetchAssessorRows({ year: typeof flags.year === "string" ? flags.year : undefined, appToken: process.env.DATASF_APP_TOKEN, log: console.log });
  const mapped = rows.map(mapAssessorRow).filter((r): r is NonNullable<typeof r> => r !== null);
  const n = await upsertBuildings(mapped);
  console.log(`saved ${n} SF buildings (${rows.length - mapped.length} rows skipped without a usable address)`);
}

async function runIngest(flags: Record<string, string | true>) {
  const cs = cities(flags.city);
  const ss = sources(flags.source);
  const once = async () => {
    for (const s of ss) for (const c of cs) await ingest(s, CITIES[c], consoleNotifier);
  };
  await once();
  if (!flags.watch) return;
  const minutes = Number(typeof flags.interval === "string" ? flags.interval : process.env.INGEST_INTERVAL_MINUTES || 5);
  console.log(`watching: next run every ${minutes} minute(s). Ctrl+C to stop.`);
  await new Promise<void>((resolve) => {
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await once();
      } finally {
        busy = false;
      }
    }, minutes * 60_000);
    process.once("SIGINT", () => {
      clearInterval(timer);
      resolve();
    });
  });
}

async function main() {
  loadEnv();
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = args(rest);
  switch (cmd) {
    case "import-buildings":
      return importBuildings(flags);
    case "ingest":
      return runIngest(flags);
    case "seed":
      await migrate();
      await importBuildings({ city: "sf", file: fixturePath("buildings", "sf-assessor-sample.json") });
      return runIngest({ source: "sample" });
    case "stats":
      console.table(await stats());
      console.log(`RentCast requests this month: ${await apiUsageThisMonth("rentcast")} of ${num(process.env.RENTCAST_MONTHLY_LIMIT, 45)}`);
      return;
    case "retire": {
      const list = typeof flags.source === "string" ? flags.source.split(",").map((x) => x.trim()) : [];
      if (list.length === 0) throw new Error("Name the sources to retire, e.g. --source sample,demo");
      console.log(`hid ${await retireSources(list)} listings from ${list.join(", ")}`);
      return;
    }
    default:
      console.log(HELP);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closePool);
