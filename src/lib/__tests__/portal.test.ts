import { describe, expect, it } from "vitest";
import { partnerSignupUrl, portalForPath, portalForRole, portalFromCookie } from "@/lib/portal";

describe("customer and partner portals", () => {
  it("sends truck owners to the partner portal and everyone else to the customer portal", () => {
    expect(portalForRole("carrier")).toBe("partner");
    expect(portalForRole("shipper")).toBe("customer");
    expect(portalForRole("admin")).toBe("customer");
    expect(portalForRole(undefined)).toBe("customer");
  });
  it("reads the portal from the path and the cookie", () => {
    expect(portalForPath("/partners")).toBe("partner");
    expect(portalForPath("/partners/login")).toBe("partner");
    expect(portalForPath("/partnership")).toBeNull();
    expect(portalForPath("/login")).toBe("customer");
    expect(portalForPath("/home")).toBeNull();
    expect(portalForPath("/")).toBeNull();
    expect(portalFromCookie("partner")).toBe("partner");
    expect(portalFromCookie("anything")).toBe("customer");
  });
  it("keeps the referral code and return path when moving carrier sign-ups to the partner portal", () => {
    expect(partnerSignupUrl({})).toBe("/partners/signup");
    expect(partnerSignupUrl({ ref: "AB12CD3", next: "/join/x" })).toBe("/partners/signup?ref=AB12CD3&next=%2Fjoin%2Fx");
  });
});
