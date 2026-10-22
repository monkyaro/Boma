"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import api from "@/services/apiClient";
import ActionForm, { errorText } from "./ActionForm";

function ShortStayRequest({ listingId }: { listingId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const availability = useQuery({ queryKey: ["availability", listingId], queryFn: async () => (await api.get<{ unavailable: string[] }>(`/bookings/availability/${listingId}`)).data });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = new FormData(event.currentTarget);
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      await api.post("/bookings", { listing_id: listingId, check_in: values.get("check_in"), check_out: values.get("check_out"), guests: Number(values.get("guests")), idempotency_key: key });
      setMessage("BOMA received your request. No payment has been taken. Follow it in your workspace.");
      await availability.refetch();
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 border-t border-black/10 pt-5"><h3 className="text-lg font-semibold">Request a short stay</h3><p className="my-3 text-sm text-black/60">BOMA coordinates all stays. Your request holds the dates for 15 minutes and requires further arrangements before confirmation.</p>
    <form onSubmit={submit} onChange={() => setRequestKey(null)} className="action-form">
      <label className="field-label">Check-in<input name="check_in" type="date" required /></label>
      <label className="field-label">Check-out<input name="check_out" type="date" required /></label>
      <label className="field-label">Guests<input name="guests" type="number" min="1" max="20" defaultValue="1" required /></label>
      <button className="button" disabled={busy}>{busy ? "Requesting…" : "Request dates with BOMA"}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
    {availability.data && <details className="mt-4 text-sm"><summary>Unavailable dates ({availability.data.unavailable.length})</summary><p className="mt-2">{availability.data.unavailable.join(", ") || "No dates are currently blocked."}</p></details>}
  </div>;
}
export default function PropertyActions({ listingId, shortStay }: { listingId: string; shortStay: boolean }) {
  const { ready, user, login, register } = useAuth();
  if (!ready) return <p role="status">Loading…</p>;
  if (!user) return <div className="panel mt-6"><h2 className="text-lg font-semibold">Interested in this property?</h2><p className="my-3 text-sm text-black/60">Sign in to save it or speak with a BOMA officer.</p><div className="flex flex-wrap items-center gap-4"><button className="button" onClick={login}>Sign in to continue</button><p className="text-sm text-black/60">New to BOMA? <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={register}>Create a free account</button></p></div></div>;
  return <aside className="panel mt-6"><h2 className="text-xl font-semibold">Let BOMA guide the next step</h2><p className="my-3 text-sm text-black/60">An authorized officer handles your questions, viewing and negotiations. Owner contact and exact locations remain private.</p>
    <div className="grid gap-3 sm:grid-cols-3"><ActionForm path={`/listings/${listingId}/favorite`} label="Save property" /><ActionForm path="/workspace/inquiries" fixed={{ listing_id: listingId, kind: "inquiry" }} label="Ask BOMA" /><ActionForm path="/workspace/inquiries" fixed={{ listing_id: listingId, kind: "viewing" }} label="Request guided viewing" /></div>
    {shortStay && <ShortStayRequest listingId={listingId} />}
  </aside>;
}
