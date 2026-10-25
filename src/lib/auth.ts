import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, Profile } from "@/lib/types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

/** The signed-in person, their profile and (for carriers) their carrier record. */
export const getSession = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: carrier }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("carriers").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (!profile) redirect("/login?error=Your%20account%20is%20not%20set%20up.%20Please%20sign%20up%20again.");
  return { user, profile: profile as Profile, carrier: carrier as Carrier | null };
});

export async function requireRole(...roles: Profile["role"][]) {
  const session = await getSession();
  if (!roles.includes(session.profile.role)) redirect("/home");
  return session;
}
