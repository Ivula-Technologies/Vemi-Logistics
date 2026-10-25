import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email (Resend) and SMS (Africa's Talking) for marketplace events. Every function here is
 * best-effort: a missing setting or a provider error is logged and never breaks the action.
 */

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(to: string, subject: string, message: string, path: string, idempotencyKey?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VEMI_FROM_EMAIL;
  if (!apiKey || !from || !to) return false;
  const url = `${site()}${path}`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      body: JSON.stringify({
        from, to, subject,
        text: `${message}\n\nOpen Vemi: ${url}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#151a24;max-width:520px"><p style="font-weight:700;color:#e8590c;margin:0 0 8px">Vemi Logistics</p><h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#e8590c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open in Vemi</a></p></div>`,
      }),
    });
    if (!response.ok) console.error("Email not sent", response.status, (await response.text()).slice(0, 200));
    return response.ok;
  } catch (error) {
    console.error("Email failed", error);
    return false;
  }
}

export function smsConfigured() {
  return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
}

/** Sends one SMS through Africa's Talking. Returns true when it was accepted. Never throws. */
export async function sendSms(to: string, message: string) {
  const username = process.env.AT_USERNAME;
  const key = process.env.AT_API_KEY;
  if (!username || !key || !to) return false;
  const host = username === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const body = new URLSearchParams({ username, to: `+${to.replace(/^\+/, "")}`, message });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
  try {
    const response = await fetch(`${host}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: key, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) console.error("SMS rejected", response.status);
    return response.ok;
  } catch (error) {
    console.error("SMS failed", error);
    return false;
  }
}

/** Looks up a person's email and phone with the service key (auth emails are not in public tables). */
async function contact(userId: string) {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  try {
    const admin = createAdminClient();
    const [{ data: auth }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    ]);
    return { email: auth.user?.email ?? null, phone: profile?.phone ?? null, name: profile?.full_name ?? "" };
  } catch (error) {
    console.error("Could not look up contact", error);
    return null;
  }
}

/** Tell one user something happened, by email and (for urgent things) SMS. */
export async function notifyUser(userId: string, subject: string, message: string, path: string, options: { sms?: boolean; key?: string } = {}) {
  const person = await contact(userId);
  if (!person) return;
  await Promise.all([
    person.email ? sendEmail(person.email, subject, message, path, options.key) : Promise.resolve(false),
    options.sms && person.phone ? sendSms(person.phone, `Vemi: ${message} ${site()}${path}`) : Promise.resolve(false),
  ]);
}

/** Emails every admin, for things the ops desk must act on (new carrier, dispute, bank transfer). */
export async function notifyOps(subject: string, message: string, path: string) {
  const to = process.env.VEMI_OPS_EMAIL;
  if (to) await sendEmail(to, subject, message, path);
}
