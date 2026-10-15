import type { NextRequest } from "next/server";
import { parseFilters, type SortKey } from "@getstabilized/core";
import { getListingsByIds, searchListings } from "@getstabilized/db";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = ["best", "cheap", "likely", "newest"];

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  try {
    // ?ids=1,2,3 returns specific listings (used by the Saved view)
    if (q.ids !== undefined) {
      const ids = q.ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
      return Response.json({ listings: await getListingsByIds(ids) });
    }
    const filters = parseFilters(q);
    if (!filters) return Response.json({ error: "Choose a city: sf, la, oak, nyc, or dc." }, { status: 400 });
    const sort = SORTS.includes(q.sort as SortKey) ? (q.sort as SortKey) : "best";
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 60));
    const offset = Math.max(0, Number(q.offset) || 0);
    return Response.json(await searchListings(filters, sort, limit, offset));
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Search is unavailable right now. Check that the database is running." }, { status: 503 });
  }
}
