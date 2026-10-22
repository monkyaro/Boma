import Link from "next/link";
import type { Listing, PropertyType } from "@/types/listing";
import { formatPrice, listingTypeLabel } from "@/lib/format";
import Icon from "./Icon";

const ART: Record<PropertyType, string> = {
  house: "from-[#0f4c5c] to-[#3a8a93]",
  apartment: "from-[#28485e] to-[#6b8ea6]",
  land: "from-[#4d6b3c] to-[#a3b86c]",
  commercial: "from-[#5b4636] to-[#c08a5b]",
  room: "from-[#7a4a3a] to-[#e07a2f]",
};

/** Placeholder artwork until listing photos are available */
export function PropertyArt({ type, className = "" }: { type: PropertyType; className?: string }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden bg-gradient-to-br ${ART[type] ?? ART.house} ${className}`}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-black/10" />
      <Icon name={ART[type] ? type : "house"} className="relative h-14 w-14 text-white/85" />
    </div>
  );
}

export function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge bg-emerald-50 text-emerald-800"><Icon name="shield" className="h-3.5 w-3.5" />BOMA verified property</span>
  ) : (
    <span className="badge bg-amber-50 text-amber-800">Unverified property</span>
  );
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.listing_id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/10"
    >
      <div className="relative">
        <PropertyArt type={listing.property_type} className="aspect-[16/10] transition duration-300 group-hover:brightness-110" />
        <span className="badge absolute left-3 top-3 bg-white/95 text-brand shadow-sm">{listingTypeLabel(listing.listing_type)}</span>
        <span className="badge absolute right-3 top-3 capitalize bg-black/30 text-white backdrop-blur-sm">{listing.property_type}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div><VerificationBadge verified={listing.verification_status === "VERIFIED"} /></div>
        <h3 className="mt-3 line-clamp-2 font-semibold leading-snug group-hover:text-brand">{listing.title}</h3>
        <p className="mt-1.5 flex items-center gap-1 text-sm text-black/55">
          <Icon name="pin" className="h-4 w-4 shrink-0" />
          {[listing.district, listing.region].filter(Boolean).join(", ")}
        </p>
        <div className="mt-auto flex items-end justify-between pt-4">
          <p className="text-lg font-bold text-brand">{formatPrice(listing.price, listing.currency)}</p>
          <Icon name="arrow" className="h-5 w-5 text-black/25 transition group-hover:translate-x-1 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
