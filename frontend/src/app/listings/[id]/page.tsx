import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getListing } from "@/services/listingServerApi";
import { formatPrice, listingTypeLabel } from "@/lib/format";

async function ListingDetail({ params }: { params: PageProps<"/listings/[id]">["params"] }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  return (
    <article className="rounded-xl border border-black/10 bg-white p-6">
      <span className="text-xs font-semibold uppercase tracking-wide text-accent">
        {listingTypeLabel(listing.listing_type)} · {listing.property_type}
      </span>
      <h1 className="mt-1 text-2xl font-bold">{listing.title}</h1>
      <p className="mt-1 text-black/60">
        {[listing.district, listing.region].filter(Boolean).join(", ")}
      </p>
      <p className="mt-4 text-2xl font-bold text-brand">{formatPrice(listing.price, listing.currency)}</p>
      {listing.description && <p className="mt-6 whitespace-pre-line">{listing.description}</p>}
    </article>
  );
}

export default function ListingPage(props: PageProps<"/listings/[id]">) {
  return (
    <Suspense fallback={<p className="text-black/60">Loading listing…</p>}>
      <ListingDetail params={props.params} />
    </Suspense>
  );
}
