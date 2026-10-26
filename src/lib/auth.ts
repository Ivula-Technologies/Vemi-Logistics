import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, Profile, TeamMember } from "@/lib/types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * The signed-in person, their profile, their carrier record (carriers) and the shipper account
 * they book for: their own, or the business that invited them (accountId).
 */
export const getSession = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: carrier }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("carriers").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("team_members").select("*").eq("member_id", user.id).maybeSingle(),
  ]);
  if (!profile) redirect("/login?error=Your%20account%20is%20not%20set%20up.%20Please%20sign%20up%20again.");
  const team = membership as TeamMember | null;
  return {
    user,
    profile: profile as Profile,
    carrier: carrier as Carrier | null,
    team,
    accountId: team?.account_id ?? user.id,
    /** Owners and team admins manage the business account, team, wallet cash-outs and credit. */
    accountAdmin: !team || team.role === "admin",
  };
});

export async function requireRole(...roles: Profile["role"][]) {
  const session = await getSession();
  if (!session.profile.onboarded && session.profile.role !== "admin") redirect("/welcome");
  if (!roles.includes(session.profile.role)) redirect("/home");
  return session;
}
