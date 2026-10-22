"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/services/apiClient";
import ListingCard from "./ListingCard";
import { errorText } from "./ActionForm";
import type { ListingPage } from "@/types/listing";
import type { Geography } from "@/types/workspace";

export default function Marketplace() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const geography = useQuery({ queryKey: ["geography"], queryFn: async () => (await api.get<Geography>("/workspace/geography")).data });
  const results = useQuery({ queryKey: ["marketplace", filters, page], queryFn: async () => (await api.get<ListingPage>("/listings", { params: { ...filters, page, per_page: 12 } })).data });
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFilters(Object.fromEntries([...data].map(([key, value]) => [key, String(value)]).filter(([, value]) => value)));
    setPage(1);
  }
  return <>
    <section className="hero">
      <p className="eyebrow">PROPERTY. PEOPLE. POSSIBILITY.</p>
      <h1>Find your place<br />in Tanzania.</h1>
      <p className="mt-5 max-w-lg text-lg text-white/80">A new home, a promising plot, or a place to stay. BOMA guides every conversation and viewing.</p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-full bg-white px-5 py-3 font-semibold text-brand">List your property for free ↗</Link>
      <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/75"><span>Owner identity checks</span><span>Officer-guided viewings</span><span>No buyer commission on sales or long-term rentals</span></div>
    </section>
    <form onSubmit={search} className="search-panel">
      <label className="field-label">What are you looking for?<input name="q" placeholder="Search by property title" /></label>
      <label className="field-label">Purpose<select name="listing_type"><option value="">All listings</option><option value="sale">Buy a property</option><option value="rent">Long-term rent</option><option value="short_stay">Short stay</option></select></label>
      <label className="field-label">Region<select name="region_code"><option value="">Across Tanzania</option>{geography.data?.regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}</select></label>
      <label className="field-label">Property<select name="property_type"><option value="">All types</option>{["house", "apartment", "land", "commercial", "room"].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="field-label">Minimum price (TZS)<input name="min_price" type="number" min="0" /></label>
      <label className="field-label">Maximum price (TZS)<input name="max_price" type="number" min="0" /></label>
      <button className="button">Find properties</button>
    </form>
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow text-accent">EXPLORE THE MARKETPLACE</p><h2 className="mt-2 text-2xl font-bold">A place for your next chapter</h2></div><p className="text-sm text-black/50">{results.data?.total ?? "—"} properties</p></div>
      {results.isPending && <p role="status">Finding properties…</p>}
      {results.isError && <div role="alert" className="panel"><p>{errorText(results.error)}</p><button className="button mt-3" onClick={() => results.refetch()}>Try again</button></div>}
      {results.data?.items.length === 0 && <div className="panel py-12 text-center"><h3 className="text-lg font-semibold">No properties match this search yet</h3><p className="mt-2 text-black/60">Try another region or a wider price range.</p></div>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{results.data?.items.map((listing) => <ListingCard key={listing.listing_id} listing={listing} />)}</div>
      <div className="mt-6 flex items-center justify-center gap-5"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="button secondary" disabled={!results.data || page * 12 >= results.data.total} onClick={() => setPage(page + 1)}>Next</button></div>
    </section>
    <section className="mt-14 grid gap-5 border-t border-black/10 pt-8 sm:grid-cols-3">{[
      ["01", "Discover", "Browse properties across Tanzania. Every listing shows its verification status."],
      ["02", "Talk to BOMA", "An authorized BOMA officer coordinates inquiries, viewings and negotiations."],
      ["03", "Move forward", "Follow your request in your workspace, with clear updates at every step."],
    ].map(([number, title, text]) => <div key={number}><span className="text-sm font-semibold text-accent">{number}</span><h3 className="mt-2 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-black/60">{text}</p></div>)}</section>
  </>;
}
