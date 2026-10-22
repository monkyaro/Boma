import "server-only";
import { apiInternalUrl } from "@/config/appConfig";
import type { Listing, ListingPage } from "@/types/listing";

// Server components only: public, unauthenticated reads. Uncached, so callers
// must render inside <Suspense>.
export async function getListings(params: Record<string, string> = {}): Promise<ListingPage> {
  const query = new URLSearchParams(params).toString();
  const rs = await fetch(`${apiInternalUrl()}/listings${query ? `?${query}` : ""}`);
  if (!rs.ok) throw new Error(`Listings request failed: ${rs.status}`);
  return rs.json();
}

export async function getListing(listingId: string): Promise<Listing | null> {
  const rs = await fetch(`${apiInternalUrl()}/listings/${encodeURIComponent(listingId)}`);
  if (rs.status === 404) return null;
  if (!rs.ok) throw new Error(`Listing request failed: ${rs.status}`);
  return rs.json();
}
