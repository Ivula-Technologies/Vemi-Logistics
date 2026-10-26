import "server-only";
import { timingSafeEqual } from "node:crypto";

/** cPanel cron calls the job URLs with "Authorization: Bearer CRON_SECRET". */
export function cronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
