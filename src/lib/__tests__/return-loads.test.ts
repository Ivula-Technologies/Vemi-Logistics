import { describe, expect, it } from "vitest";
import { addDays, arrivalDate, isReturnLoad, returnLoadsFor, returnWindow } from "@/lib/return-loads";

const places = new Map([
  ["mombasa", { lat: -4.0435, lng: 39.6682 }],
  ["nairobi", { lat: -1.2921, lng: 36.8219 }],
  ["thika", { lat: -1.0333, lng: 37.0693 }],
  ["kampala", { lat: 0.3476, lng: 32.5825 }],
  ["eldoret", { lat: 0.5143, lng: 35.2698 }],
]);

const trip = { id: "t", origin_id: "mombasa", destination_id: "nairobi", pickup_date: "2026-11-10", truck_type: "trailer" as const, distance_km: 485, border_crossings: 0 };
const open = (id: string, origin_id: string, destination_id: string, pickup_date: string, weight_tonnes = 20, truck_type: "trailer" | "reefer" | "lorry_10t" = "trailer") =>
  ({ id, origin_id, destination_id, pickup_date, weight_tonnes, truck_type });

describe("return loads", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
  });

  it("estimates the unloading day from the trip length", () => {
    // Mombasa to Nairobi is about 10 hours of driving: same day.
    expect(arrivalDate(trip, places)).toBe("2026-11-10");
    // Mombasa to Kampala with one border takes a couple of days.
    expect(arrivalDate({ ...trip, destination_id: "kampala", distance_km: 1150, border_crossings: 1 }, places) > "2026-11-11").toBe(true);
    expect(returnWindow(trip, places)).toEqual({ from: "2026-11-10", to: "2026-11-13" });
  });

  it("matches loads picking up near the drop-off in the window", () => {
    const truck = { truck_type: "trailer" as const, capacity_tonnes: 28 };
    expect(isReturnLoad(trip, open("a", "thika", "mombasa", "2026-11-11"), places, truck)).toBe(true);
    expect(isReturnLoad(trip, open("b", "eldoret", "mombasa", "2026-11-11"), places, truck)).toBe(false); // too far from Nairobi
    expect(isReturnLoad(trip, open("c", "nairobi", "mombasa", "2026-11-20"), places, truck)).toBe(false); // too late
    expect(isReturnLoad(trip, open("d", "nairobi", "mombasa", "2026-11-09"), places, truck)).toBe(false); // before it arrives
    expect(isReturnLoad(trip, open("e", "nairobi", "mombasa", "2026-11-11", 30), places, truck)).toBe(false); // too heavy
    expect(isReturnLoad(trip, open("f", "nairobi", "mombasa", "2026-11-11", 10, "reefer"), places, truck)).toBe(false); // needs a reefer
    expect(isReturnLoad(trip, open("g", "nairobi", "mombasa", "2026-11-11", 8, "lorry_10t"), places, truck)).toBe(true); // a trailer can carry it
    expect(isReturnLoad(trip, open("t", "nairobi", "mombasa", "2026-11-11"), places, truck)).toBe(false); // its own load
  });

  it("puts loads heading home first", () => {
    const list = returnLoadsFor(trip, [open("west", "nairobi", "kampala", "2026-11-10"), open("home", "nairobi", "mombasa", "2026-11-12")], places, { truck_type: "trailer" });
    expect(list.map((r) => r.load.id)).toEqual(["home", "west"]);
    expect(list[0].homeKm).toBe(0);
  });
});
