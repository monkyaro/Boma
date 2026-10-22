import PropertyActions from "@/components/PropertyActions";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getListing } from "@/services/listingServerApi";
import { formatPrice, listingTypeLabel } from "@/lib/format";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PropertyArt, VerificationBadge } from "@/components/ListingCard";

async function ListingDetail({ params }: { params: PageProps<"/listings/[id]">["params"] }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const verified = listing.verification_status === "VERIFIED";
  const location = [listing.district, listing.region].filter(Boolean).join(", ");
  const facts: [string, string][] = [
    ["Purpose", listingTypeLabel(listing.listing_type)],
    ["Property type", listing.property_type],
    ["Location", location],
    ["Status", verified ? "Verified by BOMA" : "Awaiting verification"],
  ];

  return (
    <>
      <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-black/55 hover:text-brand">
        <Icon name="back" className="h-4 w-4" /> Back to properties
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <article className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <div className="relative">
            <PropertyArt type={listing.property_type} className="aspect-[16/8]" />
            <span className="badge absolute left-4 top-4 bg-white/95 capitalize text-brand shadow-sm">{listingTypeLabel(listing.listing_type)} · {listing.property_type}</span>
          </div>
          <div className="p-6 sm:p-8">
            <VerificationBadge verified={verified} />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-black/55"><Icon name="pin" className="h-4 w-4" />{location}</p>
            <p className="mt-5 text-3xl font-bold text-brand">{formatPrice(listing.price, listing.currency)}</p>
            {!verified && <p className="mt-5 flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="alert" className="h-5 w-5 shrink-0" />BOMA has not yet verified this property.</p>}
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06] sm:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="bg-white p-4"><dt className="text-xs font-medium uppercase tracking-wider text-black/45">{label}</dt><dd className={`mt-1 font-semibold ${label === "Property type" ? "capitalize" : ""}`}>{value}</dd></div>
              ))}
            </dl>
            {listing.description && <><h2 className="mt-8 text-lg font-semibold">About this property</h2><p className="mt-3 whitespace-pre-line leading-7 text-black/75">{listing.description}</p></>}
            <p className="mt-8 flex gap-2 border-t border-black/[0.06] pt-5 text-sm text-black/50"><Icon name="shield" className="h-5 w-5 shrink-0" />Location shown at district and region level. Physical visits are coordinated by BOMA.</p>
          </div>
        </article>
        <div className="lg:sticky lg:top-24"><PropertyActions listingId={listing.listing_id} shortStay={listing.listing_type === "short_stay"} /></div>
      </div>
    </>
  );
}

export default function ListingPage(props: PageProps<"/listings/[id]">) {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading listing…" className="grid gap-6 lg:grid-cols-[1fr_380px]"><div className="skeleton aspect-[16/12] rounded-3xl" /><div className="skeleton h-64 rounded-2xl" /></div>}>
      <ListingDetail params={props.params} />
    </Suspense>
  );
}
