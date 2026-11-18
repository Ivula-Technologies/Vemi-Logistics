// Pure helpers for src/lib/ops.ts, kept apart so they can be unit tested.

export type OpsEvent = { source: string; message: string; at: string };

/** Groups errors by where and what, biggest first, top 10. null when there were none. */
export function digestLines(events: OpsEvent[]) {
  if (!events.length) return null;
  const groups = new Map<string, { count: number; last: string }>();
  for (const event of events) {
    const key = `${event.source}: ${event.message}`;
    const group = groups.get(key);
    if (group) { group.count += 1; if (event.at > group.last) group.last = event.at; } else groups.set(key, { count: 1, last: event.at });
  }
  const top = [...groups.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const lines = top.map(([key, { count, last }]) => `${count}× ${key} (last ${last.slice(0, 16).replace("T", " ")} UTC)`);
  const more = groups.size - top.length;
  return { total: events.length, text: [...lines, ...(more > 0 ? [`…and ${more} other kinds of error.`] : [])].join("\n") };
}

/** The visitor's IP address for rate limits (Vercel puts it first in x-forwarded-for). */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** How stale a scheduled job is. "never" until its first run. */
export function jobHealth(lastRun: string | null | undefined, maxAgeHours: number, now = Date.now()) {
  if (!lastRun) return "never" as const;
  return now - new Date(lastRun).getTime() <= maxAgeHours * 3600_000 ? ("ok" as const) : ("late" as const);
}
