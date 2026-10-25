import { describe, expect, it } from "vitest";
import { borderCrossings, guidePrice, quote, roadDistanceKm, suggestTruckType, type Place } from "@/lib/pricing";

const mombasa: Place = { id: "mombasa", name: "Mombasa", country: "KE", lat: -4.0435, lng: 39.6682 };
const nairobi: Place = { id: "nairobi", name: "Nairobi", country: "KE", lat: -1.2921, lng: 36.8219 };
const kampala: Place = { id: "kampala", name: "Kampala", country: "UG", lat: 0.3476, lng: 32.5825 };
const kigali: Place = { id: "kigali", name: "Kigali", country: "RW", lat: -1.9441, lng: 30.0619 };

describe("distance", () => {
  it("estimates Mombasa to Nairobi close to the real road (485 km)", () => {
    const km = roadDistanceKm(mombasa, nairobi);
    expect(km).toBeGreaterThan(480);
    expect(km).toBeLessThan(600);
  });
});

describe("border crossings", () => {
  it("counts the fewest road borders", () => {
    expect(borderCrossings("KE", "KE")).toBe(0);
    expect(borderCrossings("KE", "UG")).toBe(1);
    expect(borderCrossings("KE", "RW")).toBe(2);
    expect(borderCrossings("KE", "BI")).toBe(2);
    expect(borderCrossings("ET", "ZM")).toBe(3);
  });
});

describe("guide price", () => {
  it("never goes below the truck type's minimum", () => {
    expect(guidePrice(5, "canter")).toBe(5000);
  });
  it("adds the border allowance and rounds to KES 500", () => {
    expect(guidePrice(1000, "trailer", 2)).toBe(250000);
    expect(guidePrice(101, "lorry_7t") % 500).toBe(0);
  });
  it("prices Mombasa to Nairobi on a trailer in the KES 100k to 140k market range", () => {
    const { price, crossings } = quote(mombasa, nairobi, "trailer");
    expect(crossings).toBe(0);
    expect(price).toBeGreaterThanOrEqual(100000);
    expect(price).toBeLessThanOrEqual(140000);
  });
  it("adds two borders from Nairobi to Kigali", () => {
    expect(quote(nairobi, kigali, "trailer").crossings).toBe(2);
    expect(quote(nairobi, kampala, "trailer").crossings).toBe(1);
  });
});

describe("truck suggestion", () => {
  it("picks the smallest truck that carries the weight", () => {
    expect(suggestTruckType(0.8)).toBe("pickup");
    expect(suggestTruckType(3)).toBe("canter");
    expect(suggestTruckType(9)).toBe("lorry_10t");
    expect(suggestTruckType(26)).toBe("trailer");
    expect(suggestTruckType(45)).toBe("trailer");
  });
});
