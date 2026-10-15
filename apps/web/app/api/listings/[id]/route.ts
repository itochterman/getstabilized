import { getListing } from "@getstabilized/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Listing id must be a positive number." }, { status: 400 });
  const listing = await getListing(id);
  if (!listing) return Response.json({ error: "That listing doesn't exist or has been removed." }, { status: 404 });
  return Response.json(listing);
}
