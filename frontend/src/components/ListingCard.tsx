import Link from "next/link";
import type { Listing } from "@/types/listing";
import { formatPrice, listingTypeLabel } from "@/lib/format";

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.listing_id}`}
      className="block rounded-lg border border-black/10 bg-white p-4 transition hover:shadow-md"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-accent">
        {listingTypeLabel(listing.listing_type)} · {listing.property_type}
      </span>
      <p className={`mt-3 text-xs font-semibold ${listing.verification_status === "VERIFIED" ? "text-brand" : "text-amber-800"}`}>
        {listing.verification_status === "VERIFIED" ? "✓ BOMA verified property" : "Unverified property"}
      </p>
      <h3 className="mt-1 line-clamp-2 font-semibold">{listing.title}</h3>
      <p className="mt-1 text-sm text-black/60">
        {[listing.district, listing.region].filter(Boolean).join(", ")}
      </p>
      <p className="mt-3 text-lg font-bold text-brand">{formatPrice(listing.price, listing.currency)}</p>
    </Link>
  );
}
