import { describe, expect, it } from "vitest";
import { clientIp, digestLines, jobHealth } from "@/lib/ops-core";

describe("operations helpers", () => {
  it("groups errors for the daily digest, biggest first", () => {
    expect(digestLines([])).toBeNull();
    const digest = digestLines([
      { source: "mpesa", message: "timeout", at: "2026-11-18T08:00:00Z" },
      { source: "cron", message: "boom", at: "2026-11-18T07:00:00Z" },
      { source: "mpesa", message: "timeout", at: "2026-11-18T09:30:00Z" },
    ])!;
    expect(digest.total).toBe(3);
    expect(digest.text.split("\n")[0]).toBe("2× mpesa: timeout (last 2026-11-18 09:30 UTC)");
  });
  it("reads the visitor IP from Vercel's headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "41.90.1.2, 10.0.0.1" }))).toBe("41.90.1.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("says when a scheduled job is late", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    expect(jobHealth(null, 26, now)).toBe("never");
    expect(jobHealth("2026-11-17T12:00:00Z", 26, now)).toBe("ok");
    expect(jobHealth("2026-11-17T08:00:00Z", 26, now)).toBe("late");
  });
});
