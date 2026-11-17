import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE, ANDROID_PARTNER_PACKAGE, BUILT_IN_FINGERPRINTS, assetLinks } from "@/lib/android-app";

describe("Digital Asset Links for the Android app", () => {
  it("always lists the tester and upload keys for the Vemi package", () => {
    const [link] = assetLinks("");
    expect(link.target.package_name).toBe(ANDROID_PACKAGE);
    expect(link.target.sha256_cert_fingerprints).toEqual(BUILT_IN_FINGERPRINTS);
  });
  it("covers both the customer app and the Vemi Partner app", () => {
    expect(assetLinks("").map((l) => l.target.package_name)).toEqual([ANDROID_PACKAGE, ANDROID_PARTNER_PACKAGE]);
  });
  it("adds the Play signing key from the environment, cleaned and without duplicates", () => {
    const play = "ab:".repeat(31) + "cd";
    const [link] = assetLinks(` ${play} , ${BUILT_IN_FINGERPRINTS[0]}, not-a-key`);
    expect(link.target.sha256_cert_fingerprints).toEqual([...BUILT_IN_FINGERPRINTS, play.toUpperCase()]);
  });
});
