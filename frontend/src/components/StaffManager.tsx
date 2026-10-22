"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/apiClient";
import ActionForm, { errorText } from "./ActionForm";
import type { Geography, StaffMember } from "@/types/workspace";

const ROLES: [string, string, string][] = [
  ["officer", "BOMA officer", "Handles inquiries, viewings and verification in an assigned area"],
  ["regional_supervisor", "Regional supervisor", "Oversees officers and approvals in a region"],
  ["finance", "Finance", "Records commission payments"],
  ["support", "Support", "Helps customers with their accounts"],
];
const ROLE_LABELS: Record<string, string> = { ...Object.fromEntries(ROLES.map(([value, label]) => [value, label])), national_admin: "National administrator" };
const GEOGRAPHIC = new Set(["officer", "regional_supervisor"]);

export function useStaff(enabled = true) {
  return useQuery({ queryKey: ["staff"], enabled, queryFn: async () => (await api.get<{ items: StaffMember[] }>("/staff")).data.items });
}

export function staffName(person: StaffMember) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email || person.user_id;
}

function StaffActions({ person }: { person: StaffMember }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(done);
      await cache.invalidateQueries();
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }
  if (person.roles.includes("national_admin")) return <span className="text-xs text-black/40">Managed by operator</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {person.enabled && person.setup_pending && (
        <button type="button" disabled={busy} className="text-sm font-semibold text-brand hover:underline disabled:opacity-50"
          onClick={() => run(() => api.post(`/staff/${person.user_id}/invitation`), "Invitation sent")}>Resend invitation</button>
      )}
      <button type="button" disabled={busy} className={`text-sm font-semibold hover:underline disabled:opacity-50 ${person.enabled ? "text-red-700" : "text-brand"}`}
        onClick={() => {
          if (person.enabled && !window.confirm(`Deactivate ${staffName(person)}? They will be signed out and removed from coverage.`)) return;
          void run(() => api.patch(`/staff/${person.user_id}`, { enabled: !person.enabled }), person.enabled ? "Deactivated" : "Reactivated");
        }}>
        {person.enabled ? "Deactivate" : "Reactivate"}
      </button>
      {message && <span role="status" className="w-full text-right text-xs text-black/55">{message}</span>}
    </div>
  );
}

/** National admin: create staff accounts (with their area) and manage existing ones */
export default function StaffManager({ geography }: { geography?: Geography }) {
  const staff = useStaff();
  const [role, setRole] = useState("officer");
  const [regionCode, setRegionCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [wardCode, setWardCode] = useState("");
  const regions = geography?.regions ?? [];
  const districts = (geography?.districts ?? []).filter((x) => x.region_code === regionCode);
  const wards = (geography?.wards ?? []).filter((x) => x.district_code === districtCode);
  const regionName = (code: string) => regions.find((x) => x.code === code)?.name ?? code;
  const area = (a: StaffMember["assignments"][number]) => [
    regionName(a.region_code),
    a.district_code && (geography?.districts.find((x) => x.code === a.district_code)?.name ?? a.district_code),
    a.ward_code && (geography?.wards.find((x) => x.code === a.ward_code)?.name ?? a.ward_code),
  ].filter(Boolean).join(" › ");
  const geographic = GEOGRAPHIC.has(role);
  const fixed = { role, ...(geographic ? { region_code: regionCode, ...(districtCode ? { district_code: districtCode } : {}), ...(wardCode ? { ward_code: wardCode } : {}) } : {}) };

  return (
    <div className="space-y-8">
      <section className="panel">
        <h2 className="section-title">Create a staff account</h2>
        <p className="mt-1 text-sm text-black/55">The new staff member receives an email to set their password and an authenticator app. National administrators are created by an operator.</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <div role="radiogroup" aria-label="Staff role" className="grid gap-2 sm:grid-cols-2">
              {ROLES.map(([value, label, hint]) => (
                <label key={value} className={`cursor-pointer rounded-xl border p-3 transition ${role === value ? "border-brand bg-brand-light ring-2 ring-brand/20" : "border-black/10 hover:border-brand/40"}`}>
                  <input type="radio" name="staff_role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="text-xs text-black/50">{hint}</span>
                </label>
              ))}
            </div>
            {geographic && (
              <div className="grid gap-3 rounded-xl bg-surface p-4">
                <p className="text-sm font-semibold">Assigned area</p>
                <label className="field-label">Region
                  <select value={regionCode} onChange={(e) => { setRegionCode(e.target.value); setDistrictCode(""); setWardCode(""); }}>
                    <option value="">Select region…</option>
                    {regions.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label"><span>District <span className="font-normal text-black/40">(optional)</span></span>
                    <select value={districtCode} disabled={!regionCode} onChange={(e) => { setDistrictCode(e.target.value); setWardCode(""); }} className="disabled:bg-surface">
                      <option value="">Whole region</option>
                      {districts.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                    </select>
                  </label>
                  <label className="field-label"><span>Ward <span className="font-normal text-black/40">(optional)</span></span>
                    <select value={wardCode} disabled={!districtCode} onChange={(e) => setWardCode(e.target.value)} className="disabled:bg-surface">
                      <option value="">Whole district</option>
                      {wards.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
          {geographic && !regionCode ? (
            <p className="self-start rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Choose the region this {role === "officer" ? "officer" : "supervisor"} will cover.</p>
          ) : (
            <ActionForm path="/staff" fixed={fixed} label="Create account and send invitation" fields={[
              { name: "first_name", label: "First name" },
              { name: "last_name", label: "Last name" },
              { name: "email", label: "Work email", type: "email" },
            ]} />
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="section-title">Staff accounts</h2><p className="mt-1 text-sm text-black/55">Everyone with a BOMA staff role.</p></div>
          <span className="text-sm text-black/45">{staff.data?.length ?? "—"}</span>
        </div>
        {staff.isError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{errorText(staff.error)}</p>}
        {staff.isPending && <div className="skeleton h-32" />}
        {staff.data && (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-black/50">
                <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Area</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {staff.data.map((person) => (
                  <tr key={person.user_id} className={person.enabled ? "" : "bg-black/[0.02] text-black/50"}>
                    <td className="px-4 py-3"><p className="font-medium">{staffName(person)}</p><p className="text-xs text-black/50">{person.email}</p></td>
                    <td className="px-4 py-3">{person.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}</td>
                    <td className="px-4 py-3 text-black/60">{person.assignments.length ? person.assignments.map((a) => <span key={a.assignment_id} className="block">{area(a)}</span>) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${!person.enabled ? "bg-black/5 text-black/60" : person.setup_pending ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                        {!person.enabled ? "Deactivated" : person.setup_pending ? "Invitation pending" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StaffActions person={person} /></td>
                  </tr>
                ))}
                {!staff.data.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-black/45">No staff accounts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
