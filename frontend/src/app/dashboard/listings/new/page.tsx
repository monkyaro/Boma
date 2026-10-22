"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/apiClient";
import type { Geography, IdentityCase } from "@/types/workspace";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateListing } from "@/hooks/useCreateListing";
import Icon from "@/components/Icon";
import type { ListingType, NewListing, PropertyType } from "@/types/listing";

const PROPERTY_TYPES: PropertyType[] = ["house", "apartment", "land", "commercial", "room"];

const inputClass = "mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-normal outline-none transition hover:border-black/20 focus:border-brand focus:ring-4 focus:ring-brand/10";
const PURPOSES: [ListingType, string, string][] = [["sale", "For sale", "Sell to a buyer"], ["rent", "For rent", "Long-term tenants"], ["short_stay", "Short stay", "Nightly guests"]];

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-black/[0.06] pt-6 first-of-type:border-0 first-of-type:pt-0">
      <legend className="mb-4 flex items-center gap-3 text-base font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">{number}</span>{title}
      </legend>
      {children}
    </fieldset>
  );
}

export default function NewListingPage() {
  const { ready, user, login, register, hasRole } = useAuth();
  const createListing = useCreateListing();
  const geography = useQuery({ queryKey: ["geography"], queryFn: async () => (await api.get<Geography>("/workspace/geography")).data });
  const identity = useQuery({ queryKey: ["identity-draft"], enabled: !!user, queryFn: async () => {
    try { return (await api.get<IdentityCase>("/onboarding/owner-identity")).data; }
    catch { return null; }
  } });
  const [form, setForm] = useState<NewListing>({
    title: "",
    description: "",
    listing_type: "sale",
    property_type: "house",
    price: "",
    region: "",
    district: "",
  });

  if (!ready) return <p role="status" className="text-black/60">Loading…</p>;
  if (!user) {
    return (
      <div className="panel mx-auto max-w-lg py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-light text-brand"><Icon name="key" className="h-6 w-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold">List your property for free</h1>
        <p className="my-4 text-black/55">Sign in to prepare a listing. A BOMA officer verifies it before buyers and tenants are guided to it.</p>
        <button onClick={login} className="button lg">
          Sign in to list a property
        </button>
        <p className="mt-5 text-sm text-black/60">
          New to BOMA?{" "}
          <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={register}>
            Create a free account
          </button>
        </p>
      </div>
    );
  }
  if (identity.isPending && !hasRole("owner")) return <p role="status" className="text-black/60">Checking owner onboarding…</p>;
  if (!hasRole("owner") && !identity.data) {
    return <div className="panel mx-auto max-w-lg py-10 text-center"><h1 className="text-xl font-semibold">One step before listing</h1><p className="my-3 text-black/55">Start owner onboarding to prepare property drafts.</p><Link href="/dashboard?tab=owner" className="button">Start owner onboarding</Link></div>;
  }

  const set = <K extends keyof NewListing>(key: K, value: NewListing[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createListing.mutate(Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "")) as unknown as NewListing);
  };

  if (createListing.isSuccess) {
    return (
      <div className="panel mx-auto max-w-lg py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" className="h-7 w-7" /></span>
        <p className="mt-5 text-xl font-semibold">Listing saved as a draft.</p>
        <p className="mt-2 text-black/55">It will appear publicly once it is published.</p>
        <Link href="/dashboard?tab=owner" className="button mt-6">
          Go to my workspace
        </Link>
      </div>
    );
  }

  const error = createListing.error;
  const errorMessage = error
    ? isAxiosError(error) && error.response?.data?.error
      ? JSON.stringify(error.response.data.error)
      : "Could not save the listing. Please try again."
    : null;

  return (
    <div className="mx-auto max-w-2xl">
    <Link href="/dashboard?tab=owner" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-black/55 hover:text-brand"><Icon name="back" className="h-4 w-4" /> Back to my properties</Link>
    <h1 className="text-3xl font-bold tracking-tight">List a property</h1>
    <p className="mt-2 text-black/55">Save a draft now and publish when you are ready. Listing on BOMA is free.</p>
    <form onSubmit={onSubmit} className="panel mt-6 space-y-6 sm:p-8">
      <Step number={1} title="What are you listing?">
        <div role="radiogroup" aria-label="Listing type" className="grid gap-3 sm:grid-cols-3">
          {PURPOSES.map(([value, label, hint]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${form.listing_type === value ? "border-brand bg-brand-light ring-2 ring-brand/20" : "border-black/10 hover:border-brand/40"}`}>
              <input type="radio" name="listing_type" value={value} checked={form.listing_type === value} onChange={() => set("listing_type", value)} className="sr-only" />
              <span className="block font-semibold">{label}</span>
              <span className="text-xs text-black/50">{hint}</span>
            </label>
          ))}
        </div>
        <label className="block text-sm font-medium">
          Property type
          <select value={form.property_type} onChange={(e) => set("property_type", e.target.value as PropertyType)} className={`${inputClass} capitalize`}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Title
          <input required minLength={3} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Three-bedroom family home near the beach" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Price (TZS)
          <input required inputMode="numeric" pattern="[0-9]+(\.[0-9]{1,2})?" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" className={inputClass} />
        </label>
      </Step>

      <Step number={2} title="Where is it?">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Region
            <select required value={form.region_code || ""} onChange={(e) => setForm((old) => ({ ...old, region_code: e.target.value, region: geography.data?.regions.find((x) => x.code === e.target.value)?.name || "", district_code: "", ward_code: "", district: "" }))} className={inputClass}>
              <option value="">Select region</option>{geography.data?.regions.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            District
            <select required disabled={!form.region_code} value={form.district_code || ""} onChange={(e) => setForm((old) => ({ ...old, district_code: e.target.value, district: geography.data?.districts.find((x) => x.code === e.target.value)?.name || "", ward_code: "" }))} className={`${inputClass} disabled:bg-surface`}>
              <option value="">Select district</option>{geography.data?.districts.filter((x) => x.region_code === form.region_code).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Ward
          <select required disabled={!form.district_code} value={form.ward_code || ""} onChange={(e) => set("ward_code", e.target.value)} className={`${inputClass} disabled:bg-surface`}>
            <option value="">Select ward</option>{geography.data?.wards.filter((x) => x.district_code === form.district_code).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
        {!geography.isPending && !geography.data?.regions.length && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">BOMA is preparing the Tanzania region directory. Listing creation will be available once locations are loaded.</p>}
        <p className="text-xs text-black/45">Buyers only see the district and region. Exact locations stay private.</p>
      </Step>

      <Step number={3} title="Describe it">
        <label className="block text-sm font-medium">
          Description
          <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Rooms, size, condition, nearby amenities…" className={inputClass} />
        </label>
      </Step>

      {errorMessage && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</p>}

      <div className="flex justify-end border-t border-black/[0.06] pt-6">
        <button type="submit" disabled={createListing.isPending} className="button lg">
          {createListing.isPending ? "Saving…" : "Save draft"}
        </button>
      </div>
    </form>
    </div>
  );
}
