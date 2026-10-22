"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/apiClient";
import ActionForm, { errorText } from "@/components/ActionForm";
import { formatPrice } from "@/lib/format";
import type { Listing } from "@/types/listing";
import type { Geography, IdentityCase, Inquiry, Notification, Booking, Deal, Message, Assignment, ChangeRequest } from "@/types/workspace";

function useItems<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], enabled, queryFn: async () => (await api.get<{ items: T[] }>(path)).data.items });
}
function Problem({ error }: { error: unknown }) { return error ? <p role="alert" className="text-sm text-red-700">{errorText(error)}</p> : null; }
function Conversation({ inquiry }: { inquiry: Inquiry }) {
  const path = `/workspace/inquiries/${inquiry.inquiry_id}/messages`;
  const [open, setOpen] = useState(false);
  const messages = useItems<Message>(path, open);
  return <div className="mt-4"><button className="button secondary" onClick={() => setOpen(!open)}>{open ? "Close conversation" : "Messages with BOMA"}</button>{open && <div className="mt-4 space-y-3">
    <Problem error={messages.error} />
    {messages.data?.length === 0 && <p className="text-sm text-black/60">No messages yet. BOMA will assign an officer to guide this request.</p>}
    {messages.data?.map((message) => <div key={message.message_id} className={`rounded-lg p-3 ${message.from_me ? "bg-brand/10" : "bg-surface"}`}><p className="text-xs font-semibold">{message.from_me ? "You" : "BOMA officer"}</p><p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p></div>)}
    <ActionForm path={path} fields={[{ name: "body", label: "Your message to BOMA", type: "textarea" }]} label="Send message" />
  </div>}</div>;
}
function Identity({ geography }: { geography?: Geography }) {
  const { data: identity, error } = useQuery({ queryKey: ["identity"], queryFn: async () => {
    try { return (await api.get<IdentityCase>("/onboarding/owner-identity")).data; }
    catch (error) { if ((error as { response?: { status: number } }).response?.status === 404) return null; throw error; }
  } });
  return <section className="panel"><h2 className="text-xl font-semibold">Become a property owner</h2><p className="mt-2 text-sm text-black/60">Keep your existing account. Prepare drafts while a BOMA officer reviews your identity. Publishing is free and requires approval.</p><div className="mt-4"><Problem error={error} />
    {identity ? <><p className="mb-3 font-semibold capitalize">Identity review: {identity.status}</p>{identity.status === "pending" && <ActionForm path="/onboarding/owner-identity" method="patch" fields={[{ name: "residence_region_code", label: "Where do you live?", value: identity.residence_region_code || "", options: geography?.regions.map((x) => ({ value: x.code, label: x.name })) || [] }]} label="Save residence region" />}<Link href="/dashboard/listings/new" className="button mt-4">Prepare a listing</Link></> :
    <ActionForm path="/onboarding/owner-identity" label="Request owner identity review" />}
  </div></section>;
}
function OwnerProperties() {
  const listings = useItems<Listing>("/listings/mine");
  return <section><h2 className="mb-4 text-xl font-semibold">My properties</h2><Problem error={listings.error} />{listings.data?.length === 0 && <p className="panel text-black/60">You have no property drafts yet. Start owner onboarding to create one.</p>}
    <div className="grid gap-4 lg:grid-cols-2">{listings.data?.map((listing) => <div className="panel" key={listing.listing_id}><p className="text-xs font-semibold uppercase text-accent">{listing.status} · {listing.verification_status}</p><h3 className="mt-2 text-lg font-semibold">{listing.title}</h3><p className="mb-4 text-sm text-black/60">{formatPrice(listing.price)} · {listing.region}</p>
      {listing.status === "draft" && <ActionForm path={`/listings/${listing.listing_id}/publish`} fixed={{ version: listing.version }} label="Publish property" />}
      {listing.status !== "withdrawn" && (listing.verification_status === "VERIFIED" ? <details className="mt-4"><summary>Request a change or withdrawal</summary><ActionForm path={`/listings/${listing.listing_id}/change-requests`} fields={[{ name: "reason", label: "Explain the requested change", type: "textarea" }]} label="Send to BOMA" /></details> : <details className="mt-4"><summary>Edit or withdraw</summary><div className="mt-3 space-y-4"><ActionForm path={`/listings/${listing.listing_id}`} method="patch" fixed={{ version: listing.version }} fields={[{ name: "title", label: "Property title", value: listing.title }, { name: "description", label: "Description", type: "textarea", value: listing.description || "", optional: true }]} label="Save changes" /><ActionForm path={`/listings/${listing.listing_id}`} method="delete" fixed={{ version: listing.version }} label="Withdraw property" /></div></details>)}
      {listing.listing_type === "short_stay" && listing.status === "published" && <details className="mt-4"><summary>Manage availability</summary><ActionForm path={`/bookings/availability/${listing.listing_id}`} fixed={{ blocked: true }} fields={[{ name: "check_in", label: "Block from", type: "date" }, { name: "check_out", label: "Until (exclusive)", type: "date" }]} label="Block dates" /><ActionForm path={`/bookings/availability/${listing.listing_id}`} fixed={{ blocked: false }} fields={[{ name: "check_in", label: "Open from", type: "date" }, { name: "check_out", label: "Until (exclusive)", type: "date" }]} label="Open dates" /></details>}
    </div>)}</div></section>;
}
function CustomerWorkspace() {
  const inquiries = useItems<Inquiry>("/workspace/inquiries");
  const saved = useItems<Listing>("/listings/favorites");
  const bookings = useItems<Booking>("/bookings");
  return <div className="space-y-8"><section><h2 className="mb-4 text-xl font-semibold">My requests & appointments</h2><Problem error={inquiries.error} />{inquiries.data?.length === 0 && <p className="panel">Find a property and ask BOMA to arrange the next step.</p>}{inquiries.data?.map((inquiry) => <div key={inquiry.inquiry_id} className="panel mb-3"><Link href={`/listings/${inquiry.listing_id}`} className="font-semibold text-brand">View property ↗</Link><p className="mt-2 capitalize">{inquiry.kind} · {inquiry.status}</p>{inquiry.scheduled_at && <p className="mt-1 text-sm">{new Date(inquiry.scheduled_at).toLocaleString("en-TZ", { timeZone: "Africa/Dar_es_Salaam" })} EAT · accompanied by BOMA</p>}<Conversation inquiry={inquiry} /></div>)}</section>
    <section><h2 className="mb-4 text-xl font-semibold">Short-stay requests</h2><Problem error={bookings.error} />{bookings.data?.length === 0 && <p className="text-black/60">No short-stay requests yet.</p>}{bookings.data?.map((booking) => <div className="panel mb-3" key={booking.booking_id}><p>{booking.check_in} → {booking.check_out} · {booking.guests} guests</p><p className="my-2 capitalize">{booking.status}</p><p className="mb-3 text-sm text-black/60">A request is not a confirmed stay. BOMA will coordinate with you.</p>{booking.status === "requested" && <ActionForm path={`/bookings/${booking.booking_id}/cancel`} label="Cancel request" />}</div>)}</section>
    <section><h2 className="mb-4 text-xl font-semibold">Saved properties</h2><Problem error={saved.error} />{saved.data?.length === 0 && <p className="text-black/60">Save properties from their detail pages.</p>}{saved.data?.map((listing) => <div key={listing.listing_id} className="panel mb-3 flex items-center justify-between gap-3"><Link href={`/listings/${listing.listing_id}`} className="font-semibold text-brand">{listing.title}</Link><ActionForm path={`/listings/${listing.listing_id}/favorite`} method="delete" label="Remove" /></div>)}</section></div>;
}
function Notifications() {
  const notifications = useItems<Notification>("/workspace/notifications");
  return <section><h2 className="mb-4 text-xl font-semibold">Notifications</h2><Problem error={notifications.error} />{notifications.data?.length === 0 && <p className="panel">You’re all caught up.</p>}{notifications.data?.map((item) => <div key={item.notification_id} className="panel mb-3"><p>{item.body}</p>{!item.read_at && <div className="mt-3"><ActionForm path={`/workspace/notifications/${item.notification_id}/read`} label="Mark as read" /></div>}</div>)}</section>;
}
function Commission({ deal }: { deal: Deal }) {
  const { data, error } = useQuery({ queryKey: ["commission", deal.deal_id], queryFn: async () => {
    try { return (await api.get<{ amount_due: string; paid: string; balance: string; approved_at: string | null; invoice_reference?: string; currency: string }>(`/deals/${deal.deal_id}/commission`)).data; }
    catch (error) { if ((error as { response?: { status: number } }).response?.status === 404) return null; throw error; }
  } });
  return <div className="mt-3"><Problem error={error} />{data ? <p className="text-sm">Owner-paid commission: {formatPrice(data.amount_due, data.currency)} · Remaining: {formatPrice(data.balance, data.currency)} · {data.approved_at ? "Approved" : "Awaiting approval"}</p> : <p className="text-sm text-black/60">No commission agreement available.</p>}</div>;
}
function Deals({ staff }: { staff: boolean }) {
  const { hasRole } = useAuth();
  const deals = useItems<Deal>("/deals");
  return <section><h2 className="mb-4 text-xl font-semibold">Transactions</h2><Problem error={deals.error} />{staff && <details className="panel mb-4"><summary>Open an officer-mediated transaction</summary><ActionForm path="/deals" fields={[{ name: "listing_id", label: "Property reference" }, { name: "customer_id", label: "Customer account reference" }, { name: "agreed_price", label: "Negotiated price (TZS)", type: "number" }]} label="Open transaction" /></details>}{deals.data?.length === 0 && <p className="panel">BOMA-coordinated property transactions will appear here.</p>}{deals.data?.map((deal) => <div className="panel mb-4" key={deal.deal_id}><p className="text-xs text-black/50">Transaction {deal.deal_id}</p><p className="mt-2 font-semibold capitalize">{deal.status} · {formatPrice(deal.agreed_price, deal.currency)}</p><Commission deal={deal} />{(staff || hasRole("finance")) && <details className="mt-4"><summary>Manage transaction</summary><div className="mt-4 space-y-5">
    {staff && deal.status === "negotiating" && <><ActionForm path={`/deals/${deal.deal_id}/offers`} fields={[{ name: "amount", label: "Offer amount (TZS)", type: "number" }, { name: "reference", label: "Written offer reference" }]} label="Record negotiated offer" /><ActionForm path={`/deals/${deal.deal_id}/commission`} fields={[{ name: "calculation", label: "Commission method", options: [{ value: "percentage", label: "Percentage" }, { value: "fixed", label: "Fixed amount" }] }, { name: "rate_or_amount", label: "Negotiated rate or amount", type: "number" }, { name: "basis_amount", label: "Calculation basis (TZS)", type: "number" }, { name: "basis_description", label: "What is this commission based on?" }, { name: "written_reference", label: "Signed commission agreement reference" }, { name: "due_date", label: "Payment due date", type: "date" }]} label="Propose owner-paid commission" /></>}
    {hasRole("regional_supervisor", "national_admin") && deal.status === "negotiating" && <ActionForm path={`/deals/${deal.deal_id}/commission/approve`} label="Approve commission agreement" />}
    {hasRole("finance", "national_admin") && <ActionForm path={`/deals/${deal.deal_id}/commission/payments`} fields={[{ name: "amount", label: "Commission received (TZS)", type: "number" }, { name: "reference", label: "Unique receipt reference" }]} label="Record owner commission payment" />}
    {staff && <ActionForm path={`/deals/${deal.deal_id}/outcome`} fields={[{ name: "status", label: "Outcome", options: [{ value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }] }, { name: "reference", label: "Outcome agreement reference" }]} label="Record transaction outcome" />}
  </div></details>}</div>)}</section>;
}
function Operations({ geography }: { geography?: Geography }) {
  const { hasRole } = useAuth();
  const cases = useItems<IdentityCase>("/workspace/identity-cases");
  const properties = useItems<Listing>("/workspace/properties");
  const assignments = useItems<Assignment>("/workspace/assignments");
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: async () => (await api.get<{ inquiries: Inquiry[]; changes: ChangeRequest[] }>("/workspace/tasks")).data });
  const report = useQuery({ queryKey: ["reports"], queryFn: async () => (await api.get<{ listings: number; verified: number }>("/workspace/reports")).data });
  const staffBookings = useItems<Booking>("/bookings/staff");
  return <div className="space-y-8"><p className="panel text-sm">Staff actions require multi-factor sign-in and an active geographic assignment. Reviews must be independent of the property owner.</p><Problem error={properties.error || cases.error || tasks.error || assignments.error || report.error} />
    {report.data && <div className="grid grid-cols-2 gap-4"><div className="panel"><p className="text-sm text-black/60">Properties in your area</p><p className="mt-2 text-3xl font-semibold">{report.data.listings}</p></div><div className="panel"><p className="text-sm text-black/60">Verified properties</p><p className="mt-2 text-3xl font-semibold">{report.data.verified}</p></div></div>}
    <section><h2 className="mb-4 text-xl font-semibold">Owner identity reviews</h2>{cases.data?.length === 0 && <p className="text-black/60">No pending reviews in your assigned area.</p>}<div className="grid gap-4 lg:grid-cols-2">{cases.data?.map((item) => <div className="panel" key={item.case_id}><p className="mb-3 text-sm">Owner account: {item.user_id}<br />Residence: {geography?.regions.find((region) => region.code === item.residence_region_code)?.name || "Not selected"}</p><ActionForm path={`/workspace/identity-cases/${item.case_id}/decision`} fields={[{ name: "decision", label: "Decision", options: [{ value: "approved", label: "Approve identity" }, { value: "rejected", label: "Reject identity" }] }, { name: "reference", label: "Physical identity check reference" }]} label="Record identity decision" /></div>)}</div></section>
    <section><h2 className="mb-4 text-xl font-semibold">Property verification</h2><div className="grid gap-4 lg:grid-cols-2">{properties.data?.map((listing) => <div className="panel" key={listing.listing_id}><h3 className="font-semibold">{listing.title}</h3><p className="mb-3 mt-1 text-sm">{listing.status} · {listing.verification_status}</p>{listing.status === "published" && listing.verification_status !== "VERIFIED" && <ActionForm path={`/workspace/properties/${listing.listing_id}/verification`} fixed={{ version: listing.version }} fields={[{ name: "decision", label: "Verification decision", options: [{ value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }] }, { name: "evidence", label: "Evidence and physical-check reference", type: "textarea" }]} label="Record property decision" />}</div>)}</div></section>
    <section><h2 className="mb-4 text-xl font-semibold">Inquiries & viewing requests</h2>{tasks.data?.inquiries.map((inquiry) => <div className="panel mb-3" key={inquiry.inquiry_id}><p className="font-semibold capitalize">{inquiry.kind} · {inquiry.status}</p><p className="my-2 text-sm">Property: {inquiry.listing_id}<br />Customer: {inquiry.customer_id}</p>{inquiry.status === "requested" && <ActionForm path={`/workspace/inquiries/${inquiry.inquiry_id}/schedule`} fields={[{ name: "officer_id", label: "Assigned officer account reference" }, { name: "scheduled_at", label: "Appointment time (ISO 8601 with +03:00 timezone)" }]} label="Assign officer and schedule" />}<Conversation inquiry={inquiry} /></div>)}</section>
    {hasRole("regional_supervisor", "national_admin") && <section><h2 className="mb-4 text-xl font-semibold">Property change approvals</h2>{tasks.data?.changes.map((change) => <div className="panel mb-3" key={change.request_id}><p className="mb-3 whitespace-pre-wrap">{change.reason}</p><ActionForm path={`/workspace/changes/${change.request_id}/decision`} fields={[{ name: "version", label: "Current property version", type: "number" }, { name: "decision", label: "Decision", options: [{ value: "approve", label: "Approve reviewed changes" }, { value: "reject", label: "Reject" }, { value: "withdraw", label: "Approve withdrawal" }] }, { name: "title", label: "Reviewed property title", optional: true }, { name: "description", label: "Reviewed property description", type: "textarea", optional: true }]} label="Record change decision" /></div>)}</section>}
    <section><h2 className="mb-4 text-xl font-semibold">Officer coverage</h2>{assignments.data?.map((assignment) => <div className="panel mb-3" key={assignment.assignment_id}><p>{assignment.officer_id} · {geography?.regions.find((region) => region.code === assignment.region_code)?.name}</p><p className="my-2 text-sm">{assignment.active ? "Active" : "Inactive"} · {assignment.available ? "Available" : "Unavailable"}</p><ActionForm path={`/workspace/assignments/${assignment.assignment_id}`} method="patch" fixed={{ available: !assignment.available }} label={assignment.available ? "Set unavailable" : "Set available"} /></div>)}{hasRole("regional_supervisor", "national_admin") && <details className="panel"><summary>Assign an officer</summary><ActionForm path="/workspace/assignments" fields={[{ name: "officer_id", label: "Officer account reference" }, { name: "region_code", label: "Region", options: geography?.regions.map((region) => ({ value: region.code, label: region.name })) || [] }, { name: "district_code", label: "District code (optional)", optional: true }, { name: "ward_code", label: "Ward code (optional)", optional: true }]} label="Create assignment" /></details>}</section>
    <section><h2 className="mb-4 text-xl font-semibold">Short-stay requests</h2><Problem error={staffBookings.error} />{staffBookings.data?.map((booking) => <div className="panel mb-3" key={booking.booking_id}><p>{booking.check_in} → {booking.check_out} · {booking.status}</p><p className="text-sm text-black/60">Confirmation and payment await approved short-stay policies.</p></div>)}</section>
    {hasRole("national_admin") && <details className="panel"><summary>Manage Tanzania geography</summary><p className="my-3 text-sm text-black/60">Use entries from the approved geography source. Create regions before their districts and wards.</p><ActionForm path="/workspace/geography" fields={[{ name: "kind", label: "Level", options: ["region", "district", "ward"].map((value) => ({ value, label: value })) }, { name: "code", label: "Official code" }, { name: "name", label: "Official name" }, { name: "parent_code", label: "Parent code", optional: true }]} label="Add geography" /></details>}
  </div>;
}

export default function Dashboard() {
  const { ready, user, login, register, hasRole } = useAuth();
  const [tab, setTab] = useState("requests");
  const geography = useQuery({ queryKey: ["geography"], enabled: !!user, queryFn: async () => (await api.get<Geography>("/workspace/geography")).data });
  if (!ready) return <p role="status">Loading your workspace…</p>;
  if (!user) return <section className="panel"><h1 className="text-2xl font-semibold">Your BOMA workspace</h1><p className="my-4 text-black/60">Sign in to save properties, contact a BOMA officer, or list your property.</p><div className="flex flex-wrap items-center gap-4"><button className="button" onClick={login}>Sign in</button><p className="text-sm text-black/60">New to BOMA? <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={register}>Create a free account</button></p></div></section>;
  const staff = hasRole("officer", "regional_supervisor", "national_admin");
  const tabs = [["requests", "My requests"], ["owner", "My properties"], ["deals", "Transactions"], ["notifications", "Notifications"], ...(staff ? [["operations", "Officer workspace"]] : [])];
  return <><p className="eyebrow text-accent">YOUR NEXT CHAPTER STARTS HERE</p><h1 className="mt-2 text-3xl font-semibold">Welcome{user.name ? `, ${user.name}` : " to BOMA"}</h1><p className="mt-2 text-black/60">Your properties, conversations and next steps, together.</p><nav className="my-7 flex flex-wrap gap-2" aria-label="Workspace sections">{tabs.map(([value, label]) => <button key={value} className={`button ${tab === value ? "" : "secondary"}`} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {tab === "requests" && <CustomerWorkspace />}
    {tab === "owner" && <div className="space-y-8"><Identity geography={geography.data} /><OwnerProperties /></div>}
    {tab === "deals" && <Deals staff={staff} />}
    {tab === "notifications" && <Notifications />}
    {tab === "operations" && staff && <Operations geography={geography.data} />}
  </>;
}
