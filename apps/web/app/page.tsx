import { searchListings } from "@getstabilized/db";
import { SearchApp } from "@/components/SearchApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Render the first page on the server so results are visible before any JavaScript runs.
  const initial = await searchListings({ city: "sf" }, "best").catch((e) => {
    console.error(e);
    return null;
  });
  return <SearchApp initial={initial} initialCity="sf" />;
}
