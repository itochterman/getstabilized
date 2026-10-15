import { notFound } from "next/navigation";
import { getListing } from "@getstabilized/db";
import { ListingDetail } from "@/components/ListingDetail";

export const dynamic = "force-dynamic";

/** Shareable page for one listing. Alert emails link here. */
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const l = Number.isInteger(id) && id > 0 ? await getListing(id) : null;
  if (!l) notFound();
  return (
    <main className="wrap page-detail">
      <div className="sheet">
        <ListingDetail l={l} />
        <div className="sheet-in" style={{ paddingTop: 0 }}>
          <a className="check alt" href="/">Back to search</a>
        </div>
      </div>
    </main>
  );
}
