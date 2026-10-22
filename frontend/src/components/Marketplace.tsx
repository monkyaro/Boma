"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/apiClient";
import ListingCard from "./ListingCard";
import Icon, { type IconName } from "./Icon";
import { errorText } from "./ActionForm";
import type { ListingPage, PropertyType } from "@/types/listing";
import type { Geography } from "@/types/workspace";

const PER_PAGE = 12;
const FILTERS = ["q", "listing_type", "region_code", "property_type", "min_price", "max_price"] as const;
const PURPOSES: [string, string][] = [["", "All"], ["sale", "Buy"], ["rent", "Rent"], ["short_stay", "Short stay"]];
const PROPERTY_TYPES: [PropertyType, string][] = [["house", "Houses"], ["apartment", "Apartments"], ["land", "Land"], ["commercial", "Commercial"], ["room", "Rooms"]];

function useGeography() {
  return useQuery({ queryKey: ["geography"], queryFn: async () => (await api.get<Geography>("/workspace/geography")).data });
}

/** Builds a marketplace URL from the current filters with some values changed */
function hrefWith(params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value); else next.delete(key);
  }
  if (!("page" in changes)) next.delete("page");
  const query = next.toString();
  return query ? `/?${query}` : "/";
}

function Search() {
  const params = useSearchParams();
  // Remount when the URL changes (e.g. header "Rent" link) so the form shows the current filters
  return <SearchPanel key={params.toString()} params={params} />;
}

function SearchPanel({ params }: { params: URLSearchParams }) {
  const router = useRouter();
  const geography = useGeography();
  const [purpose, setPurpose] = useState(params.get("listing_type") || "");
  const [moreFilters, setMoreFilters] = useState(!!(params.get("min_price") || params.get("max_price")));

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of FILTERS) {
      const value = String(data.get(key) || "");
      if (value) next.set(key, value);
    }
    router.push(next.size ? `/?${next}` : "/", { scroll: false });
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form onSubmit={search} className="search-panel">
      <div role="radiogroup" aria-label="Purpose" className="mb-4 inline-flex rounded-xl bg-surface p-1">
        {PURPOSES.map(([value, label]) => (
          <label key={value} className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${purpose === value ? "bg-white text-brand shadow-sm" : "text-black/50 hover:text-brand"}`}>
            <input type="radio" name="listing_type" value={value} checked={purpose === value} onChange={() => setPurpose(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <label className="field-label">What are you looking for?
          <input name="q" placeholder="Search by property title" defaultValue={params.get("q") || ""} />
        </label>
        <label className="field-label">Region
          <select name="region_code" defaultValue={params.get("region_code") || ""}>
            <option value="">Across Tanzania</option>
            {geography.data?.regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
          </select>
        </label>
        <label className="field-label">Property
          <select name="property_type" defaultValue={params.get("property_type") || ""}>
            <option value="">All types</option>
            {PROPERTY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="button h-[42px] px-6"><Icon name="search" className="h-4 w-4" />Find properties</button>
      </div>
      <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline" aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}>
        <Icon name="sliders" className="h-4 w-4" />{moreFilters ? "Fewer filters" : "More filters"}
      </button>
      {moreFilters && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 md:max-w-xl">
          <label className="field-label">Minimum price (TZS)<input name="min_price" type="number" min="0" placeholder="No minimum" defaultValue={params.get("min_price") || ""} /></label>
          <label className="field-label">Maximum price (TZS)<input name="max_price" type="number" min="0" placeholder="No maximum" defaultValue={params.get("max_price") || ""} /></label>
        </div>
      )}
    </form>
  );
}

function Results() {
  const params = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filters = Object.fromEntries(FILTERS.flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])));
  const results = useQuery({ queryKey: ["marketplace", filters, page], queryFn: async () => (await api.get<ListingPage>("/listings", { params: { ...filters, page, per_page: PER_PAGE } })).data });
  const activeType = params.get("property_type");
  const pages = results.data ? Math.max(1, Math.ceil(results.data.total / PER_PAGE)) : 1;

  return (
    <section id="results" className="mt-14 scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Explore the marketplace</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">A place for your next chapter</h2>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm font-medium text-black/55 shadow-sm">{results.data?.total ?? "—"} properties</p>
      </div>
      <nav aria-label="Property types" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={hrefWith(params, { property_type: null })} scroll={false} aria-current={!activeType} className="chip shrink-0">All properties</Link>
        {PROPERTY_TYPES.map(([value, label]) => (
          <Link key={value} href={hrefWith(params, { property_type: value })} scroll={false} aria-current={activeType === value} className="chip shrink-0">
            <Icon name={value} className="h-4 w-4" />{label}
          </Link>
        ))}
      </nav>

      {results.isPending && (
        <div role="status" aria-label="Finding properties…" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl bg-white"><div className="skeleton aspect-[16/10] rounded-none" /><div className="space-y-3 p-4"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-5 w-3/4" /><div className="skeleton h-4 w-1/2" /></div></div>
          ))}
        </div>
      )}
      {results.isError && (
        <div role="alert" className="panel flex flex-col items-center py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700"><Icon name="alert" /></span>
          <p className="mt-4 font-medium">{errorText(results.error)}</p>
          <button className="button mt-5" onClick={() => results.refetch()}>Try again</button>
        </div>
      )}
      {results.data?.items.length === 0 && (
        <div className="panel flex flex-col items-center py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-light text-brand"><Icon name="search" className="h-6 w-6" /></span>
          <h3 className="mt-4 text-lg font-semibold">No properties match this search yet</h3>
          <p className="mt-2 text-black/55">Try another region or a wider price range.</p>
          <Link href="/" className="button secondary mt-5">Clear all filters</Link>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {results.data?.items.map((listing) => <ListingCard key={listing.listing_id} listing={listing} />)}
      </div>
      {results.data && results.data.total > PER_PAGE && (
        <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3">
          {page > 1 ? <Link className="button secondary" href={hrefWith(params, { page: String(page - 1) })}>Previous</Link> : <button className="button secondary" disabled>Previous</button>}
          <span className="text-sm text-black/55">Page <strong className="text-ink">{page}</strong> of {pages}</span>
          {page < pages ? <Link className="button secondary" href={hrefWith(params, { page: String(page + 1) })}>Next</Link> : <button className="button secondary" disabled>Next</button>}
        </nav>
      )}
    </section>
  );
}

const STEPS: [string, string, string, IconName][] = [
  ["01", "Discover", "Browse properties across Tanzania. Every listing shows its verification status.", "search"],
  ["02", "Talk to BOMA", "An authorized BOMA officer coordinates inquiries, viewings and negotiations.", "chat"],
  ["03", "Move forward", "Follow your request in your workspace, with clear updates at every step.", "check"],
];

export default function Marketplace() {
  return <>
    <section className="hero">
      <p className="eyebrow text-white/70">Property. People. Possibility.</p>
      <h1 className="mt-4">Find your place<br />in Tanzania.</h1>
      <p className="mt-5 max-w-lg text-lg text-white/75">A new home, a promising plot, or a place to stay. BOMA guides every conversation and viewing.</p>
      <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">
        {["Owner identity checks", "Officer-guided viewings", "No buyer commission on sales or long-term rentals"].map((point) => (
          <li key={point} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent"><Icon name="check" className="h-3 w-3 text-white" /></span>{point}</li>
        ))}
      </ul>
    </section>
    <Suspense fallback={<div className="search-panel h-40" />}><Search /></Suspense>
    <Suspense fallback={<div role="status" className="mt-14 text-black/55">Finding properties…</div>}><Results /></Suspense>

    <section className="mt-20">
      <div className="text-center">
        <p className="eyebrow text-accent">How BOMA works</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Guided from first look to final handshake</h2>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {STEPS.map(([number, title, text, icon]) => (
          <div key={number} className="panel relative">
            <span className="absolute right-5 top-5 text-3xl font-black text-black/[0.05]">{number}</span>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-light text-accent"><Icon name={icon} /></span>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-black/55">{text}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="mt-16 flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-accent-light p-8 sm:flex-row sm:items-center sm:p-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Own a property in Tanzania?</h2>
        <p className="mt-2 max-w-lg text-black/60">List it for free. A BOMA officer verifies it and guides every buyer and tenant for you.</p>
      </div>
      <Link href="/dashboard?tab=owner" className="button accent lg shrink-0">List your property for free <Icon name="arrow" className="h-4 w-4" /></Link>
    </section>
  </>;
}
