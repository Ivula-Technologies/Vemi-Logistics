import { describe, expect, it } from "vitest";
import { eta, formatDuration, travelHours } from "@/lib/eta";
import { quoteRoute, withSurcharge, type Place } from "@/lib/pricing";
import { driverText, stepLabel } from "@/lib/driver-i18n";
import { nextSteps } from "@/lib/trips";

const mombasa: Place = { id: "mombasa", name: "Mombasa", country: "KE", lat: -4.0435, lng: 39.6682 };
const nairobi: Place = { id: "nairobi", name: "Nairobi", country: "KE", lat: -1.2921, lng: 36.8219 };
const nakuru: Place = { id: "nakuru", name: "Nakuru", country: "KE", lat: -0.3031, lng: 36.08 };
const kampala: Place = { id: "kampala", name: "Kampala", country: "UG", lat: 0.3476, lng: 32.5825 };

describe("arrival estimates", () => {
  it("adds a night's rest for every 11 hours of driving and time at each border", () => {
    expect(travelHours(500)).toBeCloseTo(10);
    expect(travelHours(600)).toBeCloseTo(12 + 13);
    expect(travelHours(100, 1)).toBeCloseTo(2 + 8);
  });
  it("routes through the stops still ahead", () => {
    const direct = eta(nairobi, [kampala], 1);
    const viaNakuru = eta(nairobi, [nakuru, kampala], 1);
    expect(viaNakuru.km).toBeGreaterThanOrEqual(direct.km);
    expect(viaNakuru.at.getTime()).toBeGreaterThan(Date.now());
  });
  it("says the truck is there when it is a few km away", () => {
    expect(eta({ lat: -1.29, lng: 36.82 }, [nairobi], 0).hours).toBe(0);
    expect(formatDuration(0)).toBe("under an hour");
    expect(formatDuration(30)).toBe("about 1 day 6 h");
  });
});

describe("route pricing", () => {
  it("charges per extra stop and counts borders along the way", () => {
    const direct = quoteRoute([mombasa, kampala], "trailer", 3000);
    const withStop = quoteRoute([mombasa, nairobi, kampala], "trailer", 3000);
    expect(direct.crossings).toBe(1);
    expect(withStop.crossings).toBe(1);
    expect(withStop.price).toBeGreaterThan(direct.price);
  });
  it("rounds surcharged prices to the nearest 500", () => {
    expect(withSurcharge(100_000, 0)).toBe(100_000);
    expect(withSurcharge(100_000, 1500)).toBe(115_000);
    expect(withSurcharge(81_300, 1000) % 500).toBe(0);
  });
});

describe("driver page", () => {
  it("defaults to Kiswahili and names the border step", () => {
    expect(driverText(null).pickup).toBe(driverText("sw").pickup);
    expect(driverText("en").pickup).toBe("Pickup");
    expect(stepLabel("sw", "in_transit", "at_border")).toBe(driverText("sw").steps.cleared);
    expect(stepLabel("en", "in_transit", "loaded")).toBe("Leaving with the goods");
  });
  it("asks for the pickup code when loading and the delivery code at drop-off", () => {
    expect(nextSteps("at_pickup", false)[0].needsCode).toBe("pickup");
    expect(nextSteps("at_dropoff", false)[0].needsCode).toBe("delivery");
    expect(nextSteps("loaded", false)[0].needsCode).toBeUndefined();
  });
});
