import type { NextRequest } from "next/server";
import { isCityId } from "@getstabilized/core";
import { getListing } from "@getstabilized/db";
import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-sent events: pushes each new listing in the requested city as it is ingested. */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  if (!isCityId(city)) return Response.json({ error: "Choose a city: sf, la, oak, nyc, or dc." }, { status: 400 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        try {
          ctrl.enqueue(enc.encode(chunk));
        } catch {
          open = false;
        }
      };
      send("retry: 3000\n: connected\n\n");
      const unsubscribe = await subscribe(async (e) => {
        if (e.type !== "new_listing" || e.city !== city) return;
        const listing = await getListing(e.id).catch(() => null);
        if (listing) send(`event: listing\ndata: ${JSON.stringify(listing)}\n\n`);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      cleanup = () => {
        open = false;
        unsubscribe();
        clearInterval(heartbeat);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          ctrl.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
