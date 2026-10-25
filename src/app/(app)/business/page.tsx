import type { Metadata } from "next";
import { Building2, CreditCard, MapPinned, Users } from "lucide-react";
import { Flash, PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/status-badge";
import { BusinessForm, InviteForm, SavePlaceForm } from "@/components/app/business-forms";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { removeTeamMember, requestCredit, revokeInvite } from "@/app/actions/account";
import { deletePlace } from "@/app/actions/loads";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { placeMap } from "@/lib/places";
import { displayPhone } from "@/lib/phone";
import { formatDate, formatKes } from "@/lib/utils";
import type { BusinessAccount, SavedPlace, TeamMember } from "@/lib/types";

export const metadata: Metadata = { title: "Business account" };

const SAVED = { credit: "Request sent. Vemi checks your business and usually decides within two working days.", revoked: "Invite cancelled.", removed: "Removed from the team.", place: "Place removed." };
const CREDIT = { none: null, requested: ["info", "Requested"], approved: ["success", "Approved"], declined: ["danger", "Declined"], suspended: ["danger", "Suspended"] } as const;

/** Uber for Business: one account for the company, team logins, saved places, and invoice terms. */
export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ user, profile, accountId, accountAdmin, team }, query] = await Promise.all([requireRole("shipper"), searchParams]);
  const supabase = await createClient();
  const [{ data: businessRow }, { data: members }, { data: invites }, { data: saved }, places] = await Promise.all([
    supabase.from("business_accounts").select("*").eq("owner_id", accountId).maybeSingle(),
    supabase.from("team_members").select("member_id, account_id, role, created_at").eq("account_id", accountId),
    accountAdmin ? supabase.from("team_invites").select("id, email, role, created_at, expires_at, accepted_at").is("accepted_at", null).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("saved_places").select("*").eq("account_id", accountId).order("label"),
    placeMap(),
  ]);
  const business = businessRow as BusinessAccount | null;
  const memberRows = (members ?? []) as TeamMember[];
  const ids = [accountId, ...memberRows.map((m) => m.member_id)];
  const { data: people } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
  const name = (id: string) => people?.find((p) => p.id === id);
  const credit = business ? CREDIT[business.credit_status] : null;
  const placeList = [...places.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

  return <div className="max-w-3xl space-y-6">
    <Flash error={query.error} saved={query.saved} savedText={SAVED} />
    <PageHeader title="Business account" description={team ? "You book trucks for this business. Trips are shared with your team." : "Book for your company: team logins, saved places, monthly reports and pay on invoice."} />

    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5 text-primary" />Company details</h2>
      <BusinessForm business={business} fallbackName={profile.company || profile.full_name} disabled={!accountAdmin} />
    </section>

    {business ? <section id="team" className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" />Team</h2>
      <p className="mb-4 text-sm text-muted-foreground">Everyone books on the company account and sees its trips. Bookers can post loads and pay; managers can also change these settings, cash out and invite people.</p>
      <ul className="divide-y rounded-md border text-sm">
        <li className="flex items-center justify-between gap-2 px-3 py-2"><span>{name(accountId)?.full_name ?? "Owner"} <span className="text-xs text-muted-foreground">· owner</span></span></li>
        {memberRows.map((m) => <li key={m.member_id} className="flex items-center justify-between gap-2 px-3 py-2">
          <span>{name(m.member_id)?.full_name ?? "Team member"} <span className="text-xs text-muted-foreground">· {m.role === "admin" ? "manager" : "booker"}{name(m.member_id)?.phone ? ` · ${displayPhone(name(m.member_id)!.phone)}` : ""}</span></span>
          {accountAdmin || m.member_id === user.id ? <form action={removeTeamMember}><input type="hidden" name="memberId" value={m.member_id} /><Button size="sm" variant="ghost">{m.member_id === user.id ? "Leave" : "Remove"}</Button></form> : null}
        </li>)}
      </ul>
      {(invites ?? []).length ? <ul className="mt-3 space-y-1 text-sm">{(invites ?? []).map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Invited {i.email} · expires {formatDate(i.expires_at)}</span><form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><Button size="sm" variant="ghost">Cancel</Button></form></li>)}</ul> : null}
      {accountAdmin ? <div className="mt-4 border-t pt-4"><InviteForm /></div> : null}
    </section> : null}

    {business ? <section id="credit" className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><CreditCard className="h-5 w-5 text-primary" />Pay on invoice</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">{credit ? <ToneBadge tone={credit[0]}>{credit[1]}</ToneBadge> : null}
        {business.credit_status === "approved" ? <span>Limit {formatKes(business.credit_limit)} · pay within {business.terms_days} days</span> : null}</div>
      <p className="text-sm text-muted-foreground">{business.credit_status === "approved" ? "On any trip, choose \"Book on account\" and the truck goes without paying first. We send one invoice per trip to your accounts email." : "Regular shippers can book now and pay within 30 days. Vemi checks your KRA PIN and trading history first."}</p>
      {business.credit_note ? <p className="mt-2 text-sm">Note from Vemi: {business.credit_note}</p> : null}
      {accountAdmin && ["none", "declined"].includes(business.credit_status) ? <form action={requestCredit} className="mt-3"><SubmitButton variant="outline" size="sm" pendingLabel="…">Ask for credit terms</SubmitButton></form> : null}
    </section> : null}

    <section id="places" className="scroll-mt-20 rounded-lg border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><MapPinned className="h-5 w-5 text-primary" />Saved places</h2>
      <p className="mb-4 text-sm text-muted-foreground">Your warehouses, depots and customers. Pick them with one tap when you post a load.</p>
      {(saved ?? []).length ? <ul className="mb-4 divide-y rounded-md border text-sm">{((saved ?? []) as SavedPlace[]).map((p) => <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0"><span className="font-medium">{p.label}</span> <span className="text-muted-foreground">· {p.detail ? `${p.detail}, ` : ""}{places.get(p.place_id)?.name}{p.contact_phone ? ` · ${p.contact_name ?? ""} ${displayPhone(p.contact_phone)}` : ""}</span></span>
        <form action={deletePlace}><input type="hidden" name="id" value={p.id} /><Button size="sm" variant="ghost">Remove</Button></form>
      </li>)}</ul> : null}
      <SavePlaceForm places={placeList} />
    </section>
  </div>;
}
