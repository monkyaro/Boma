export type ListingType = "sale" | "rent";
export type PropertyType = "house" | "apartment" | "land" | "commercial" | "room";

export interface Listing {
  listing_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  listing_type: ListingType;
  property_type: PropertyType;
  price: string;
  currency: string;
  region: string;
  district: string | null;
  status: string;
  created_at: string;
}

export interface ListingPage {
  items: Listing[];
  total: number;
  page: number;
}

export interface NewListing {
  title: string;
  description?: string;
  listing_type: ListingType;
  property_type: PropertyType;
  price: string;
  region: string;
  district?: string;
  latitude?: number;
  longitude?: number;
}
