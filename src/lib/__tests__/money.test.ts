import { describe, expect, it } from "vitest";
import { carrierPayout, commissionBps, percent } from "@/lib/commission";
import { normalizeKenyanPhone, displayPhone } from "@/lib/phone";
import { csvCell, toCsv } from "@/lib/csv";
import { nextSteps, progressIndex } from "@/lib/trips";
import { eatToday, formatKes } from "@/lib/utils";

const settings = { commission_bps: 1000, founding_commission_bps: 500 };

describe("commission", () => {
  it("uses the founding rate while it lasts, then the standard rate", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    expect(commissionBps({ commission_bps: null, founding_until: "2026-12-01T00:00:00Z" }, settings, now)).toBe(500);
    expect(commissionBps({ commission_bps: null, founding_until: "2026-10-01T00:00:00Z" }, settings, now)).toBe(1000);
    expect(commissionBps({ commission_bps: 750, founding_until: "2026-12-01T00:00:00Z" }, settings, now)).toBe(750);
    expect(commissionBps(null, settings, now)).toBe(1000);
  });
  it("matches the database rounding (the 285,000 test trip)", () => {
    expect(carrierPayout(285000, 500)).toBe(270750);
    expect(carrierPayout(30000, 1000)).toBe(27000);
    expect(percent(500)).toBe("5%");
  });
});

describe("phones", () => {
  it("accepts the usual Kenyan formats", () => {
    for (const input of ["0712345678", "+254 712 345 678", "254712345678", "712345678", "0712-345-678"]) expect(normalizeKenyanPhone(input)).toBe("254712345678");
    expect(normalizeKenyanPhone("0110345678")).toBe("254110345678");
    expect(normalizeKenyanPhone("0212345678")).toBeNull();
    expect(normalizeKenyanPhone("")).toBeNull();
    expect(displayPhone("254712345678")).toBe("0712 345 678");
  });
});

describe("csv", () => {
  it("quotes and defuses spreadsheet formulas", () => {
    expect(csvCell('Otieno "Big" Transport, Ltd')).toBe('"Otieno ""Big"" Transport, Ltd"');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
    expect(toCsv([["a", 1], [null, "b"]])).toBe("a,1\r\n,b\r\n");
  });
});

describe("trip steps", () => {
  it("only offers the border step on cross-border trips", () => {
    expect(nextSteps("in_transit", false).map((s) => s.status)).toEqual(["delivered"]);
    expect(nextSteps("in_transit", true).map((s) => s.status)).toEqual(["at_border", "delivered"]);
    expect(nextSteps("awaiting_payment", true)).toEqual([]);
    expect(progressIndex("at_border")).toBe(progressIndex("in_transit"));
  });
});

describe("formatting", () => {
  it("formats shillings and Kenyan dates", () => {
    expect(formatKes(285000)).toBe("KES 285,000");
    expect(eatToday(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-26");
  });
});
