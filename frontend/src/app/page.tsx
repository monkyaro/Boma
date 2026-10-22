import { Suspense } from "react";
import ListingCard from "@/components/ListingCard";
import { getListings } from "@/services/listingServerApi";

async function LatestListings() {
  const { items } = await getListings({ per_page: "12" });

  if (items.length === 0) {
    return <p className="text-black/60">No listings yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((listing) => (
        <ListingCard key={listing.listing_id} listing={listing} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section className="mb-10 rounded-xl bg-brand px-6 py-12 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Find your next home in Tanzania</h1>
        <p className="mt-2 max-w-xl text-white/80">
          Houses, apartments, land and commercial property for sale and rent.
        </p>
      </section>

      <h2 className="mb-4 text-xl font-semibold">Latest listings</h2>
      <Suspense fallback={<p className="text-black/60">Loading listings…</p>}>
        <LatestListings />
      </Suspense>
    </>
  );
}
