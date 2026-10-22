"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/apiClient";
import ActionForm, { errorText } from "./ActionForm";
import { nextGeographyCode } from "@/lib/geography";
import type { Geography } from "@/types/workspace";

type Level = "region" | "district" | "ward";
const LEVELS: [Level, string][] = [["region", "Regions"], ["district", "Districts"], ["ward", "Wards"]];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function EditableRow({ level, code, name, detail }: { level: Level; code: string; name: string; detail: string }) {
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (!value || value === name) { setEditing(false); return; }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/workspace/geography/${level}/${encodeURIComponent(code)}`, { name: value });
      await cache.invalidateQueries();
      setEditing(false);
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  return (
    <tr className="hover:bg-brand-light/40">
      <td className="px-4 py-2.5 font-mono text-xs">{code}</td>
      <td className="px-4 py-2.5 font-medium">
        {editing ? (
          <form onSubmit={save} className="flex flex-wrap items-center gap-2">
            <input name="name" defaultValue={name} required maxLength={100} autoFocus aria-label={`New name for ${code}`}
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-2.5 py-1.5 text-sm font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
            <button disabled={busy} className="button px-3 py-1.5">{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="button ghost px-3 py-1.5" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
            {error && <p role="alert" className="w-full text-xs font-normal text-red-700">{error}</p>}
          </form>
        ) : name}
      </td>
      <td className="px-4 py-2.5 text-black/55">{detail}</td>
      <td className="px-4 py-2.5 text-right">
        {!editing && <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setEditing(true)} aria-label={`Edit ${name}`}>Edit</button>}
      </td>
    </tr>
  );
}

/** National admin tool: add regions, then districts under a region, then wards under a district */
export default function GeographyManager({ geography }: { geography?: Geography }) {
  const [level, setLevel] = useState<Level>("region");
  const [regionCode, setRegionCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [filter, setFilter] = useState("");
  const regions = geography?.regions ?? [];
  const districts = geography?.districts ?? [];
  const wards = geography?.wards ?? [];
  const regionName = (code: string) => regions.find((x) => x.code === code)?.name ?? code;
  const districtName = (code: string) => districts.find((x) => x.code === code)?.name ?? code;
  const regionDistricts = districts.filter((x) => x.region_code === regionCode);

  const parent = level === "district" ? regionCode : level === "ward" ? districtCode : "";
  const needsParent = level !== "region" && !parent;
  const rows = level === "region"
    ? regions.map((x) => ({ code: x.code, name: x.name, detail: plural(districts.filter((d) => d.region_code === x.code).length, "district") }))
    : level === "district"
      ? districts.filter((x) => !regionCode || x.region_code === regionCode).map((x) => ({ code: x.code, name: x.name, detail: regionName(x.region_code) }))
      : wards.filter((x) => (districtCode ? x.district_code === districtCode : regionDistricts.some((d) => d.code === x.district_code))).map((x) => ({ code: x.code, name: x.name, detail: districtName(x.district_code) }));
  const query = filter.trim().toLowerCase();
  const shown = query ? rows.filter((x) => `${x.code} ${x.name}`.toLowerCase().includes(query)) : rows;
  const noun = level === "region" ? "region" : level === "district" ? "district" : "ward";
  const siblings = level === "region" ? regions.map((x) => x.code) : level === "district" ? regionDistricts.map((x) => x.code) : wards.filter((x) => x.district_code === districtCode).map((x) => x.code);
  const nextCode = nextGeographyCode(siblings, parent);

  return (
    <section className="panel">
      <h2 className="section-title">Tanzania geography</h2>
      <p className="mt-1 text-sm text-black/55">Use entries from the approved geography source. Add regions first, then their districts, then wards.</p>

      <div role="tablist" aria-label="Geography level" className="mt-5 inline-flex rounded-xl bg-surface p-1">
        {LEVELS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={level === value} onClick={() => { setLevel(value); setFilter(""); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${level === value ? "bg-white text-brand shadow-sm" : "text-black/50 hover:text-brand"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid content-start gap-3">
          {level !== "region" && (
            <label className="field-label">Region
              <select value={regionCode} onChange={(e) => { setRegionCode(e.target.value); setDistrictCode(""); }}>
                <option value="">Select region first…</option>
                {regions.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}
              </select>
            </label>
          )}
          {level === "ward" && (
            <label className="field-label">District
              <select value={districtCode} disabled={!regionCode} onChange={(e) => setDistrictCode(e.target.value)} className="disabled:bg-surface">
                <option value="">{regionCode && !regionDistricts.length ? "No districts in this region yet" : "Select district…"}</option>
                {regionDistricts.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}
              </select>
            </label>
          )}
          {needsParent ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {level === "district" ? "Choose the region this district belongs to." : "Choose the region and district this ward belongs to."}
            </p>
          ) : (
            <>
            <p className="rounded-xl bg-surface px-4 py-3 text-sm text-black/60">
              New code <span className="ml-1 font-mono font-semibold text-ink">{nextCode}</span>
              <span className="block text-xs text-black/45">Assigned automatically when you save.</span>
            </p>
            <ActionForm
              key={`${level}-${parent}`}
              path="/workspace/geography"
              fixed={{ kind: level, ...(parent ? { parent_code: parent } : {}) }}
              fields={[{ name: "name", label: `Official ${noun} name` }]}
              label={`Add ${noun}${parent ? ` to ${level === "district" ? regionName(parent) : districtName(parent)}` : ""}`}
            />
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {level === "region" ? "All regions" : level === "district" ? (regionCode ? `Districts in ${regionName(regionCode)}` : "All districts") : districtCode ? `Wards in ${districtName(districtCode)}` : regionCode ? `Wards in ${regionName(regionCode)}` : "Choose a region to see wards"}
              <span className="ml-2 font-normal text-black/45">{shown.length}</span>
            </p>
            <input aria-label="Filter list" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)}
              className="w-36 rounded-xl border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
          </div>
          <div className="max-h-80 overflow-auto rounded-xl border border-black/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-black/50">
                <tr><th className="px-4 py-2.5 font-semibold">Code</th><th className="px-4 py-2.5 font-semibold">Name</th><th className="px-4 py-2.5 font-semibold">{level === "region" ? "Districts" : level === "district" ? "Region" : "District"}</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {shown.map((row) => <EditableRow key={`${level}-${row.code}`} level={level} {...row} />)}
                {!shown.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-black/45">{level === "ward" && !regionCode ? "Select a region and district." : `No ${noun}s yet.`}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
