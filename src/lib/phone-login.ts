import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, smsConfigured } from "@/lib/notify";

/**
 * Sign in with a phone number and a 6-digit SMS code (sent through Africa's Talking).
 * The code is checked here, then Supabase is asked for a one-time sign-in token for that account,
 * so phone sign-in works for every existing account without a separate phone provider in Supabase.
 */

const CODE_MINUTES = 10;
const MAX_CODES_PER_15_MIN = 3;
const MAX_ATTEMPTS = 5;

export function phoneLoginConfigured() {
  return smsConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY);
}

function hash(phone: string, code: string) {
  const pepper = process.env.LOGIN_CODE_SECRET || process.env.SUPABASE_SECRET_KEY || "";
  return createHash("sha256").update(`${pepper}:${phone}:${code}`).digest("hex");
}

/** Sends a code if exactly one non-admin account has this phone. Answers the same either way. */
export async function sendLoginCode(phone: string) {
  const admin = createAdminClient();
  const { data: people } = await admin.from("profiles").select("id, role").in("phone", [phone, `+${phone}`]).limit(2);
  if (!people || people.length !== 1 || people[0].role === "admin") return;
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await admin.from("login_codes").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", since);
  if ((count ?? 0) >= MAX_CODES_PER_15_MIN) throw new Error("Too many codes. Wait 15 minutes and try again.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("login_codes").insert({ phone, user_id: people[0].id, code_hash: hash(phone, code), expires_at: new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString() });
  if (error) throw new Error("Could not send a code. Try again.");
  await sendSms(phone, `Your Vemi sign-in code is ${code}. It expires in ${CODE_MINUTES} minutes. Never share it, not even with Vemi staff.`);
}

/** Returns the account's email when the code is right; the caller then finishes the sign-in. */
export async function checkLoginCode(phone: string, code: string) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("login_codes").select("id, user_id, code_hash, attempts, expires_at, used_at")
    .eq("phone", phone).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date()) return { error: "That code has expired. Ask for a new one." } as const;
  if (row.attempts >= MAX_ATTEMPTS) return { error: "Too many wrong codes. Ask for a new one." } as const;
  const given = Buffer.from(hash(phone, code.trim()));
  const expected = Buffer.from(row.code_hash);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await admin.from("login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return { error: "That code is wrong. Check the SMS and try again." } as const;
  }
  await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  const { data: user } = await admin.auth.admin.getUserById(row.user_id);
  if (!user.user?.email) return { error: "This account has no email. Sign in with your password." } as const;
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
  if (error || !link.properties?.hashed_token) return { error: "Could not sign you in. Try again." } as const;
  return { tokenHash: link.properties.hashed_token } as const;
}
