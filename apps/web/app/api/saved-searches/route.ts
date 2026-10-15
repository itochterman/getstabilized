import { parseFilters } from "@getstabilized/core";
import { createSavedSearch } from "@getstabilized/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send the search as JSON." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const filters = parseFilters((body.filters ?? {}) as Record<string, unknown>);
  if (!filters) return Response.json({ error: "Pick a city before saving the search." }, { status: 400 });
  const id = await createSavedSearch(email, filters);
  return Response.json({ id }, { status: 201 });
}
