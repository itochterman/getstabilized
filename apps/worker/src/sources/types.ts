import type { CityRules, ListingContact, PriceEvent, PropertyType } from "@getstabilized/core";

/** A listing as a source hands it to us, before matching and scoring. */
export interface RawListing {
  sourceId: string;
  title: string;
  address: string;
  neighborhood?: string | null;
  beds: number;
  baths?: number | null;
  rent: number;
  sqft?: number | null;
  description?: string;
  url?: string | null;
  noFee?: boolean | null;
  propertyType: PropertyType;
  yearBuilt?: number | null;
  units?: number | null;
  lat?: number | null;
  lng?: number | null;
  listedAt?: string | null;
  contacts?: ListingContact[];
  mlsNumber?: string | null;
  priceHistory?: PriceEvent[];
  daysOnMarket?: number | null;
}

export interface FetchResult {
  listings: RawListing[];
  /**
   * True when this is every active listing the source has for the city. The pipeline then
   * marks listings it no longer sees as inactive. Partial results (a request cap, a page
   * limit) leave existing listings alone.
   */
  complete: boolean;
  /** Why the source fetched nothing on purpose, e.g. a daily or monthly budget. */
  skipped?: string;
}

export interface ListingSource {
  id: string;
  /** Listings unseen for this many days are marked inactive, for sources that can't send full snapshots. */
  staleAfterDays?: number;
  fetch(city: CityRules): Promise<FetchResult>;
}
