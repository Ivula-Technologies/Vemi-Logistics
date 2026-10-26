import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/** Web push to the installed phone app. Switched on by VAPID keys (see DEPLOY.md). Never throws. */

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:ops@vemi.co.ke", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

export async function sendPush(userId: string, title: string, body: string, path: string, tag?: string) {
  if (!pushConfigured() || !process.env.SUPABASE_SECRET_KEY) return 0;
  try {
    setup();
    const admin = createAdminClient();
    const { data: subscriptions } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    let sent = 0;
    await Promise.all((subscriptions ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: path, tag }), { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // The browser dropped the subscription (uninstalled, cleared data): forget it.
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("Push failed", status);
      }
    }));
    return sent;
  } catch (error) {
    console.error("Push failed", error);
    return 0;
  }
}
