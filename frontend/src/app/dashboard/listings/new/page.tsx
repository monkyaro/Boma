"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/apiClient";
import type { Geography, IdentityCase } from "@/types/workspace";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateListing } from "@/hooks/useCreateListing";
import type { ListingType, NewListing, PropertyType } from "@/types/listing";

const PROPERTY_TYPES: PropertyType[] = ["house", "apartment", "land", "commercial", "room"];

const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-white px-3 py-2";

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

  if (!ready) return <p className="text-black/60">Loading…</p>;
  if (!user) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={login} className="rounded-md bg-brand px-4 py-2 font-semibold text-white">
          Sign in to list a property
        </button>
        <p className="text-sm text-black/60">
          New to BOMA?{" "}
          <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={register}>
            Create a free account
          </button>
        </p>
      </div>
    );
  }
  if (identity.isPending && !hasRole("owner")) return <p>Checking owner onboarding…</p>;
  if (!hasRole("owner") && !identity.data) {
    return <p>Start <Link href="/dashboard" className="text-brand underline">owner onboarding</Link> to prepare property drafts.</p>;
  }

  const set = <K extends keyof NewListing>(key: K, value: NewListing[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createListing.mutate(Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "")) as unknown as NewListing);
  };

  if (createListing.isSuccess) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-6">
        <p className="font-semibold">Listing saved as a draft.</p>
        <p className="mt-1 text-sm text-black/60">It will appear publicly once it is published.</p>
        <Link href="/dashboard" className="mt-4 inline-block font-semibold text-brand">
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
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-xl border border-black/10 bg-white p-6">
      <h1 className="text-2xl font-bold">List a property</h1>

      <label className="block text-sm font-medium">
        Title
        <input required minLength={3} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Listing type
          <select value={form.listing_type} onChange={(e) => set("listing_type", e.target.value as ListingType)} className={inputClass}>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
            <option value="short_stay">Short stay</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Property type
          <select value={form.property_type} onChange={(e) => set("property_type", e.target.value as PropertyType)} className={inputClass}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        Price (TZS)
        <input required inputMode="numeric" pattern="[0-9]+(\.[0-9]{1,2})?" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Region
          <select required value={form.region_code || ""} onChange={(e) => setForm((old) => ({ ...old, region_code: e.target.value, region: geography.data?.regions.find((x) => x.code === e.target.value)?.name || "", district_code: "", ward_code: "", district: "" }))} className={inputClass}>
            <option value="">Select region</option>{geography.data?.regions.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          District
          <select required value={form.district_code || ""} onChange={(e) => setForm((old) => ({ ...old, district_code: e.target.value, district: geography.data?.districts.find((x) => x.code === e.target.value)?.name || "", ward_code: "" }))} className={inputClass}>
            <option value="">Select district</option>{geography.data?.districts.filter((x) => x.region_code === form.region_code).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">Ward
        <select required value={form.ward_code || ""} onChange={(e) => set("ward_code", e.target.value)} className={inputClass}>
          <option value="">Select ward</option>{geography.data?.wards.filter((x) => x.district_code === form.district_code).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
        </select>
      </label>
      {!geography.isPending && !geography.data?.regions.length && <p role="status">BOMA is preparing the Tanzania region directory. Listing creation will be available once locations are loaded.</p>}
      <label className="block text-sm font-medium">
        Description
        <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />
      </label>

      {errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}

      <button type="submit" disabled={createListing.isPending} className="rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60">
        {createListing.isPending ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}
