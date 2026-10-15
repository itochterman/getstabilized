import type { CityRules, PropertyType } from "@getstabilized/core";

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
}

export interface ListingSource {
  id: string;
  /**
   * True when each fetch returns every active listing for the city. The pipeline then
   * marks listings it no longer sees as inactive. Incremental sources leave them alone.
   */
  fullSnapshot: boolean;
  fetch(city: CityRules): Promise<RawListing[]>;
}
