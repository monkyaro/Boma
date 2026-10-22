"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/apiClient";
import ActionForm, { errorText } from "@/components/ActionForm";
import Icon, { type IconName } from "@/components/Icon";
import { formatPrice } from "@/lib/format";
import type { Listing } from "@/types/listing";
import type { Geography, IdentityCase, Inquiry, Notification, Booking, Deal, Message, Assignment, ChangeRequest } from "@/types/workspace";

function useItems<T>(path: string, enabled = true) {
  return useQuery({ queryKey: [path], enabled, queryFn: async () => (await api.get<{ items: T[] }>(path)).data.items });
}
function Problem({ error }: { error: unknown }) { return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{errorText(error)}</p> : null; }
function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="mb-4"><h2 className="section-title">{children}</h2>{hint && <p className="mt-1 text-sm text-black/55">{hint}</p>}</div>;
}
function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center text-sm text-black/55"><span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-light text-brand"><Icon name={icon} /></span>{children}</div>;
}
const STATUS_TONES: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-800", approved: "bg-emerald-50 text-emerald-800", completed: "bg-emerald-50 text-emerald-800", published: "bg-emerald-50 text-emerald-800", confirmed: "bg-emerald-50 text-emerald-800", scheduled: "bg-sky-50 text-sky-800",
  rejected: "bg-red-50 text-red-800", cancelled: "bg-red-50 text-red-800", withdrawn: "bg-black/5 text-black/60", expired: "bg-black/5 text-black/60",
};
function Status({ value }: { value: string }) {
  return <span className={`badge capitalize ${STATUS_TONES[value.toLowerCase()] ?? "bg-amber-50 text-amber-800"}`}>{value.toLowerCase().replaceAll("_", " ")}</span>;
}
function Conversation({ inquiry }: { inquiry: Inquiry }) {
  const path = `/workspace/inquiries/${inquiry.inquiry_id}/messages`;
  const [open, setOpen] = useState(false);
  const messages = useItems<Message>(path, open);
  return <div className="mt-4"><button className="button secondary" onClick={() => setOpen(!open)}><Icon name="chat" className="h-4 w-4" />{open ? "Close conversation" : "Messages with BOMA"}</button>{open && <div className="mt-4 space-y-3 rounded-2xl bg-surface p-4">
    <Problem error={messages.error} />
    {messages.data?.length === 0 && <p className="text-sm text-black/60">No messages yet. BOMA will assign an officer to guide this request.</p>}
    {messages.data?.map((message) => <div key={message.message_id} className={`max-w-[85%] rounded-2xl p-3 ${message.from_me ? "ml-auto rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-white"}`}><p className="text-xs font-semibold opacity-75">{message.from_me ? "You" : "BOMA officer"}</p><p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p></div>)}
    <ActionForm path={path} fields={[{ name: "body", label: "Your message to BOMA", type: "textarea" }]} label="Send message" />
  </div>}</div>;
}
function Identity({ geography }: { geography?: Geography }) {
  const { data: identity, error } = useQuery({ queryKey: ["identity"], queryFn: async () => {
    try { return (await api.get<IdentityCase>("/onboarding/owner-identity")).data; }
    catch (error) { if ((error as { response?: { status: number } }).response?.status === 404) return null; throw error; }
  } });
  return <section className="panel bg-gradient-to-br from-white to-brand-light/60"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Icon name="key" /></span><div><h2 className="section-title">Become a property owner</h2><p className="mt-1 text-sm text-black/55">Keep your existing account. Prepare drafts while a BOMA officer reviews your identity. Publishing is free and requires approval.</p></div></div><div className="mt-5"><Problem error={error} />
    {identity ? <><p className="mb-4 flex items-center gap-2 font-semibold">Identity review <Status value={identity.status} /></p>{identity.status === "pending" && <ActionForm path="/onboarding/owner-identity" method="patch" fields={[{ name: "residence_region_code", label: "Where do you live?", value: identity.residence_region_code || "", options: geography?.regions.map((x) => ({ value: x.code, label: x.name })) || [] }]} label="Save residence region" />}<Link href="/dashboard/listings/new" className="button mt-4"><Icon name="plus" className="h-4 w-4" />Prepare a listing</Link></> :
    <ActionForm path="/onboarding/owner-identity" label="Request owner identity review" />}
  </div></section>;
}
function OwnerProperties() {
  const listings = useItems<Listing>("/listings/mine");
  return <section><SectionTitle>My properties</SectionTitle><Problem error={listings.error} />{listings.data?.length === 0 && <Empty icon="house">You have no property drafts yet. Start owner onboarding to create one.</Empty>}
    <div className="grid gap-4 lg:grid-cols-2">{listings.data?.map((listing) => <div className="panel" key={listing.listing_id}><div className="flex flex-wrap gap-2"><Status value={listing.status} /><Status value={listing.verification_status} /></div><h3 className="mt-3 text-lg font-semibold">{listing.title}</h3><p className="mb-4 text-sm text-black/55">{formatPrice(listing.price)} · {listing.region}</p>
      {listing.status === "draft" && <ActionForm path={`/listings/${listing.listing_id}/publish`} fixed={{ version: listing.version }} label="Publish property" />}
      {listing.status !== "withdrawn" && (listing.verification_status === "VERIFIED" ? <details className="mt-4"><summary>Request a change or withdrawal</summary><ActionForm path={`/listings/${listing.listing_id}/change-requests`} fields={[{ name: "reason", label: "Explain the requested change", type: "textarea" }]} label="Send to BOMA" /></details> : <details className="mt-4"><summary>Edit or withdraw</summary><div className="mt-3 space-y-4"><ActionForm path={`/listings/${listing.listing_id}`} method="patch" fixed={{ version: listing.version }} fields={[{ name: "title", label: "Property title", value: listing.title }, { name: "description", label: "Description", type: "textarea", value: listing.description || "", optional: true }]} label="Save changes" /><ActionForm path={`/listings/${listing.listing_id}`} method="delete" fixed={{ version: listing.version }} label="Withdraw property" variant="danger" /></div></details>)}
      {listing.listing_type === "short_stay" && listing.status === "published" && <details className="mt-4"><summary>Manage availability</summary><ActionForm path={`/bookings/availability/${listing.listing_id}`} fixed={{ blocked: true }} fields={[{ name: "check_in", label: "Block from", type: "date" }, { name: "check_out", label: "Until (exclusive)", type: "date" }]} label="Block dates" /><ActionForm path={`/bookings/availability/${listing.listing_id}`} fixed={{ blocked: false }} fields={[{ name: "check_in", label: "Open from", type: "date" }, { name: "check_out", label: "Until (exclusive)", type: "date" }]} label="Open dates" /></details>}
    </div>)}</div></section>;
}
function CustomerWorkspace() {
  const inquiries = useItems<Inquiry>("/workspace/inquiries");
  const saved = useItems<Listing>("/listings/favorites");
  const bookings = useItems<Booking>("/bookings");
  return <div className="space-y-8"><section><SectionTitle>My requests & appointments</SectionTitle><Problem error={inquiries.error} />{inquiries.data?.length === 0 && <Empty icon="inbox">Find a property and ask BOMA to arrange the next step.<Link href="/" className="button mt-4">Browse properties</Link></Empty>}{inquiries.data?.map((inquiry) => <div key={inquiry.inquiry_id} className="panel mb-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 font-semibold capitalize"><Icon name={inquiry.kind === "viewing" ? "calendar" : "chat"} className="h-5 w-5 text-accent" />{inquiry.kind} <Status value={inquiry.status} /></p><Link href={`/listings/${inquiry.listing_id}`} className="text-sm font-semibold text-brand hover:underline">View property ↗</Link></div>{inquiry.scheduled_at && <p className="mt-2 text-sm text-black/60">{new Date(inquiry.scheduled_at).toLocaleString("en-TZ", { timeZone: "Africa/Dar_es_Salaam" })} EAT · accompanied by BOMA</p>}<Conversation inquiry={inquiry} /></div>)}</section>
    <section><SectionTitle>Short-stay requests</SectionTitle><Problem error={bookings.error} />{bookings.data?.length === 0 && <Empty icon="calendar">No short-stay requests yet.</Empty>}{bookings.data?.map((booking) => <div className="panel mb-3" key={booking.booking_id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{booking.check_in} → {booking.check_out} · {booking.guests} guests</p><Status value={booking.status} /></div><p className="my-3 text-sm text-black/55">A request is not a confirmed stay. BOMA will coordinate with you.</p>{booking.status === "requested" && <ActionForm path={`/bookings/${booking.booking_id}/cancel`} label="Cancel request" variant="danger" />}</div>)}</section>
    <section><SectionTitle>Saved properties</SectionTitle><Problem error={saved.error} />{saved.data?.length === 0 && <Empty icon="heart">Save properties from their detail pages.</Empty>}{saved.data?.map((listing) => <div key={listing.listing_id} className="panel mb-3 flex items-center justify-between gap-3"><Link href={`/listings/${listing.listing_id}`} className="flex items-center gap-3 font-semibold hover:text-brand"><Icon name="heart" className="h-5 w-5 text-accent" />{listing.title}</Link><ActionForm path={`/listings/${listing.listing_id}/favorite`} method="delete" label="Remove" variant="ghost" /></div>)}</section></div>;
}
function Notifications() {
  const notifications = useItems<Notification>("/workspace/notifications");
  return <section><SectionTitle>Notifications</SectionTitle><Problem error={notifications.error} />{notifications.data?.length === 0 && <Empty icon="bell">You’re all caught up.</Empty>}{notifications.data?.map((item) => <div key={item.notification_id} className={`panel mb-3 flex gap-4 ${item.read_at ? "opacity-70" : "border-l-4 border-l-accent"}`}><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.read_at ? "bg-black/5 text-black/40" : "bg-accent-light text-accent"}`}><Icon name="bell" className="h-4 w-4" /></span><div className="flex-1"><p>{item.body}</p><p className="mt-1 text-xs text-black/45">{new Date(item.created_at).toLocaleString("en-TZ", { timeZone: "Africa/Dar_es_Salaam" })}</p>{!item.read_at && <div className="mt-3"><ActionForm path={`/workspace/notifications/${item.notification_id}/read`} label="Mark as read" variant="secondary" /></div>}</div></div>)}</section>;
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
  return <section><SectionTitle hint="Officer-mediated sales and rentals, with owner-paid commission.">Transactions</SectionTitle><Problem error={deals.error} />{staff && <details className="panel mb-4"><summary>Open an officer-mediated transaction</summary><ActionForm path="/deals" fields={[{ name: "listing_id", label: "Property reference" }, { name: "customer_id", label: "Customer account reference" }, { name: "agreed_price", label: "Negotiated price (TZS)", type: "number" }]} label="Open transaction" /></details>}{deals.data?.length === 0 && <Empty icon="briefcase">BOMA-coordinated property transactions will appear here.</Empty>}{deals.data?.map((deal) => <div className="panel mb-4" key={deal.deal_id}><p className="font-mono text-xs text-black/45">Transaction {deal.deal_id}</p><p className="mt-2 flex flex-wrap items-center gap-3 text-xl font-bold text-brand">{formatPrice(deal.agreed_price, deal.currency)} <Status value={deal.status} /></p><Commission deal={deal} />{(staff || hasRole("finance")) && <details className="mt-4"><summary>Manage transaction</summary><div className="mt-4 space-y-5">
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
  return <div className="space-y-8"><p className="flex gap-3 rounded-2xl bg-brand-light px-5 py-4 text-sm text-brand-dark"><Icon name="shield" className="h-5 w-5 shrink-0" />Staff actions require multi-factor sign-in and an active geographic assignment. Reviews must be independent of the property owner.</p><Problem error={properties.error || cases.error || tasks.error || assignments.error || report.error} />
    {report.data && <div className="grid grid-cols-2 gap-4"><div className="panel"><p className="text-sm text-black/55">Properties in your area</p><p className="mt-2 text-4xl font-bold text-brand">{report.data.listings}</p></div><div className="panel"><p className="text-sm text-black/55">Verified properties</p><p className="mt-2 text-4xl font-bold text-emerald-700">{report.data.verified}</p></div></div>}
    <section><SectionTitle>Owner identity reviews</SectionTitle>{cases.data?.length === 0 && <Empty icon="user">No pending reviews in your assigned area.</Empty>}<div className="grid gap-4 lg:grid-cols-2">{cases.data?.map((item) => <div className="panel" key={item.case_id}><p className="mb-3 text-sm">Owner account: {item.user_id}<br />Residence: {geography?.regions.find((region) => region.code === item.residence_region_code)?.name || "Not selected"}</p><ActionForm path={`/workspace/identity-cases/${item.case_id}/decision`} fields={[{ name: "decision", label: "Decision", options: [{ value: "approved", label: "Approve identity" }, { value: "rejected", label: "Reject identity" }] }, { name: "reference", label: "Physical identity check reference" }]} label="Record identity decision" /></div>)}</div></section>
    <section><SectionTitle>Property verification</SectionTitle><div className="grid gap-4 lg:grid-cols-2">{properties.data?.map((listing) => <div className="panel" key={listing.listing_id}><h3 className="font-semibold">{listing.title}</h3><div className="mb-4 mt-2 flex flex-wrap gap-2"><Status value={listing.status} /><Status value={listing.verification_status} /></div>{listing.status === "published" && listing.verification_status !== "VERIFIED" && <ActionForm path={`/workspace/properties/${listing.listing_id}/verification`} fixed={{ version: listing.version }} fields={[{ name: "decision", label: "Verification decision", options: [{ value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" }] }, { name: "evidence", label: "Evidence and physical-check reference", type: "textarea" }]} label="Record property decision" />}</div>)}</div></section>
    <section><SectionTitle>Inquiries & viewing requests</SectionTitle>{tasks.data?.inquiries.map((inquiry) => <div className="panel mb-3" key={inquiry.inquiry_id}><p className="flex items-center gap-2 font-semibold capitalize">{inquiry.kind} <Status value={inquiry.status} /></p><p className="my-3 text-sm text-black/60">Property: {inquiry.listing_id}<br />Customer: {inquiry.customer_id}</p>{inquiry.status === "requested" && <ActionForm path={`/workspace/inquiries/${inquiry.inquiry_id}/schedule`} fields={[{ name: "officer_id", label: "Assigned officer account reference" }, { name: "scheduled_at", label: "Appointment time (ISO 8601 with +03:00 timezone)" }]} label="Assign officer and schedule" />}<Conversation inquiry={inquiry} /></div>)}</section>
    {hasRole("regional_supervisor", "national_admin") && <section><SectionTitle>Property change approvals</SectionTitle>{tasks.data?.changes.map((change) => <div className="panel mb-3" key={change.request_id}><p className="mb-3 whitespace-pre-wrap">{change.reason}</p><ActionForm path={`/workspace/changes/${change.request_id}/decision`} fields={[{ name: "version", label: "Current property version", type: "number" }, { name: "decision", label: "Decision", options: [{ value: "approve", label: "Approve reviewed changes" }, { value: "reject", label: "Reject" }, { value: "withdraw", label: "Approve withdrawal" }] }, { name: "title", label: "Reviewed property title", optional: true }, { name: "description", label: "Reviewed property description", type: "textarea", optional: true }]} label="Record change decision" /></div>)}</section>}
    <section><SectionTitle>Officer coverage</SectionTitle>{assignments.data?.map((assignment) => <div className="panel mb-3" key={assignment.assignment_id}><p>{assignment.officer_id} · {geography?.regions.find((region) => region.code === assignment.region_code)?.name}</p><p className="my-2 text-sm">{assignment.active ? "Active" : "Inactive"} · {assignment.available ? "Available" : "Unavailable"}</p><ActionForm path={`/workspace/assignments/${assignment.assignment_id}`} method="patch" fixed={{ available: !assignment.available }} label={assignment.available ? "Set unavailable" : "Set available"} /></div>)}{hasRole("regional_supervisor", "national_admin") && <details className="panel"><summary>Assign an officer</summary><ActionForm path="/workspace/assignments" fields={[{ name: "officer_id", label: "Officer account reference" }, { name: "region_code", label: "Region", options: geography?.regions.map((region) => ({ value: region.code, label: region.name })) || [] }, { name: "district_code", label: "District code (optional)", optional: true }, { name: "ward_code", label: "Ward code (optional)", optional: true }]} label="Create assignment" /></details>}</section>
    <section><SectionTitle>Short-stay requests</SectionTitle><Problem error={staffBookings.error} />{staffBookings.data?.map((booking) => <div className="panel mb-3" key={booking.booking_id}><p>{booking.check_in} → {booking.check_out} · {booking.status}</p><p className="text-sm text-black/60">Confirmation and payment await approved short-stay policies.</p></div>)}</section>
    {hasRole("national_admin") && <details className="panel"><summary>Manage Tanzania geography</summary><p className="my-3 text-sm text-black/60">Use entries from the approved geography source. Create regions before their districts and wards.</p><ActionForm path="/workspace/geography" fields={[{ name: "kind", label: "Level", options: ["region", "district", "ward"].map((value) => ({ value, label: value })) }, { name: "code", label: "Official code" }, { name: "name", label: "Official name" }, { name: "parent_code", label: "Parent code", optional: true }]} label="Add geography" /></details>}
  </div>;
}

const SECTIONS: { value: string; label: string; icon: IconName; staff?: boolean }[] = [
  { value: "requests", label: "My requests", icon: "inbox" },
  { value: "owner", label: "My properties", icon: "key" },
  { value: "deals", label: "Transactions", icon: "briefcase" },
  { value: "notifications", label: "Notifications", icon: "bell" },
  { value: "operations", label: "Officer workspace", icon: "clipboard", staff: true },
];

function Workspace() {
  const { ready, user, login, register, hasRole } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const geography = useQuery({ queryKey: ["geography"], enabled: !!user, queryFn: async () => (await api.get<Geography>("/workspace/geography")).data });
  const notifications = useItems<Notification>("/workspace/notifications", !!user);
  if (!ready) return <div role="status" aria-label="Loading your workspace…" className="grid gap-6 lg:grid-cols-[240px_1fr]"><div className="skeleton h-72" /><div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40" /><div className="skeleton h-40" /></div></div>;
  if (!user) return <section className="panel mx-auto max-w-lg py-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-light text-brand"><Icon name="user" className="h-6 w-6" /></span><h1 className="mt-5 text-2xl font-semibold">Your BOMA workspace</h1><p className="my-4 text-black/55">Sign in to save properties, contact a BOMA officer, or list your property.</p><button className="button lg" onClick={login}>Sign in</button><p className="mt-5 text-sm text-black/55">New to BOMA? <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={register}>Create a free account</button></p></section>;
  const staff = hasRole("officer", "regional_supervisor", "national_admin");
  const sections = SECTIONS.filter((section) => !section.staff || staff);
  const requested = params.get("tab");
  const tab = sections.some((section) => section.value === requested) ? requested : "requests";
  const unread = notifications.data?.filter((item) => !item.read_at).length ?? 0;
  const select = (value: string) => router.replace(`/dashboard?tab=${value}`, { scroll: false });

  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow text-accent">Your next chapter starts here</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome{user.name ? `, ${user.name}` : " to BOMA"}</h1><p className="mt-1 text-black/55">Your properties, conversations and next steps, together.</p></div>
      <Link href="/dashboard/listings/new" className="button accent"><Icon name="plus" className="h-4 w-4" />List a property</Link>
    </div>
    <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
      <nav aria-label="Workspace sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:rounded-2xl lg:border lg:border-black/[0.06] lg:bg-white lg:p-2 lg:shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        {sections.map((section) => (
          <button key={section.value} aria-current={tab === section.value ? "page" : undefined} onClick={() => select(section.value)} className="menu-item shrink-0 whitespace-nowrap max-lg:w-auto max-lg:border max-lg:border-black/[0.06]">
            <Icon name={section.icon} className="h-[18px] w-[18px]" />
            <span className="flex-1">{section.label}</span>
            {section.value === "notifications" && unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
          </button>
        ))}
      </nav>
      <div className="min-w-0">
        {tab === "requests" && <CustomerWorkspace />}
        {tab === "owner" && <div className="space-y-8"><Identity geography={geography.data} /><OwnerProperties /></div>}
        {tab === "deals" && <Deals staff={staff} />}
        {tab === "notifications" && <Notifications />}
        {tab === "operations" && staff && <Operations geography={geography.data} />}
      </div>
    </div>
  </>;
}

export default function Dashboard() {
  return <Suspense fallback={<p role="status">Loading your workspace…</p>}><Workspace /></Suspense>;
}
