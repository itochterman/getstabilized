import { stats } from "@getstabilized/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ ok: true, cities: await stats() });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
