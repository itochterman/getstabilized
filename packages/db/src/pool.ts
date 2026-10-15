import pg from "pg";
import { databaseUrl } from "./env";

// NUMERIC comes back as a string by default; rents and baths fit safely in a JS number.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// BIGINT ids fit in a JS number for any realistic table size.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const g = globalThis as unknown as { __getstabilizedPool?: pg.Pool };

/** One pool per process. Survives Next.js dev reloads. */
export function getPool(): pg.Pool {
  if (!g.__getstabilizedPool) {
    g.__getstabilizedPool = new pg.Pool({ connectionString: databaseUrl(), max: 10 });
  }
  return g.__getstabilizedPool;
}

export async function closePool(): Promise<void> {
  if (g.__getstabilizedPool) {
    await g.__getstabilizedPool.end();
    g.__getstabilizedPool = undefined;
  }
}

/** A dedicated client for LISTEN, which must not be shared through the pool. */
export function newListenClient(): pg.Client {
  return new pg.Client({ connectionString: databaseUrl() });
}

export const LISTING_CHANNEL = "getstabilized_listing_events";
