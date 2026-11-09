// The Android app (android/) is this website in a Trusted Web Activity. Digital Asset Links
// (/.well-known/assetlinks.json) prove the site and the app belong together, so the app opens
// full screen without a browser bar. Vemi sells a real-world service (moving goods), so Google
// Play allows paying for trips outside Play billing: nothing is hidden inside the app.

export const ANDROID_PACKAGE = "com.ivulatechnologies.vemi";

/** Tester key (android/tester-key, sideloaded APK) and the Ivula upload key (Google Play uploads). */
export const BUILT_IN_FINGERPRINTS = [
  "0F:0A:3E:5C:D0:67:EA:CF:D4:82:53:DB:5F:03:DC:22:5C:33:B6:7A:88:77:BC:85:14:BA:1D:B6:D7:5C:8D:00",
  "DA:4A:C3:F4:37:3B:61:82:10:D1:9F:12:33:06:22:9B:1B:27:1D:F1:83:34:C5:37:AE:2D:7A:03:85:F5:DC:CB",
];

/**
 * Google Play re-signs the app with its own key. Its SHA-256 (Play Console > Test and release >
 * App integrity) goes in the ANDROID_SHA256_FINGERPRINTS environment variable on Vercel,
 * comma-separated. A redeploy picks it up; no new app build is needed.
 */
export function assetLinks(extra = process.env.ANDROID_SHA256_FINGERPRINTS ?? "") {
  const fingerprints = [...BUILT_IN_FINGERPRINTS, ...extra.split(",")]
    .map((f) => f.trim().toUpperCase())
    .filter((f, i, all) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f) && all.indexOf(f) === i);
  return [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
  }];
}
