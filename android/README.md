# Vemi for Android (tester app)

The Android app is a Trusted Web Activity: a thin Android shell that opens https://vemi-logistics.vercel.app
full screen. Every web deploy updates the app too, so testers only reinstall when this folder changes.

- Package name: `com.ivulatechnologies.vemi`
- Settings: `twa-manifest.json` (name, colours, start page, icons)
- Builder: `build-project.mjs` (Bubblewrap, pinned in `package.json`)

## Build the tester APK

The **Build Android Tester App** workflow builds a signed `.apk` on every push that touches this folder (or
run it by hand from the Actions tab). It commits the APK to `public/download/vemi-tester.apk`, so once deployed
testers download it from https://vemi-logistics.vercel.app/download/vemi-tester.apk. The `vemi-android-apk`
artifact on the run has the same file. Testers tap it on their phone and allow "install unknown apps" once.

## The tester key

`tester-key/vemi-tester.p12` (password `vemi-tester`) signs tester builds only. It is committed on purpose so
every build has the same signature and testers can install updates over the old app. It is not the Google
Play key: Play builds are signed with the Ivula upload key from the Play Store guide, and never with this one.

`/.well-known/assetlinks.json` (served by `src/app/.well-known/assetlinks.json/route.ts`) lists the tester key and
the Ivula upload key, so the app opens without a browser bar.

## The Google Play app

The same app goes on Google Play, signed with the Ivula upload key (one key for every Ivula app, kept in
`/mnt/project-files/android/upload-key/`, never committed).

1. Add two repository secrets once (Settings → Secrets and variables → Actions):
   - `ANDROID_UPLOAD_KEYSTORE`: the contents of `ivula-upload.jks.base64.txt`
   - `ANDROID_UPLOAD_KEYSTORE_PASSWORD`: the contents of `password.txt`
2. Actions → **Build Android App** → Run workflow on `main`.
3. Download the `android-app` artifact and upload the `.aab` in Play Console.

The version code is the workflow run number, so every run can be uploaded. Pull requests that touch this folder
build an unsigned bundle to catch breakage.

After the first Play upload, copy the **App signing key certificate SHA-256** from Play Console (Test and release →
App integrity) into the `ANDROID_SHA256_FINGERPRINTS` environment variable on Vercel (comma-separate several), then
redeploy. No new app build is needed.

Payments: Vemi sells a real-world service (moving goods), which Google Play allows people to pay for outside Play
billing, so nothing is hidden inside the app.
