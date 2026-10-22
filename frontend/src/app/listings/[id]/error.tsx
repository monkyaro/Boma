"use client";
export default function ListingError({ reset }: { reset: () => void }) {
  return <section className="panel mx-auto max-w-lg py-12 text-center" role="alert"><h1 className="text-xl font-semibold">This property is temporarily unavailable</h1><p className="my-3 text-black/55">Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></section>;
}
