# Vemi for Android (tester app)

The Android app is a Trusted Web Activity: a thin Android shell that opens https://vemi-logistics.vercel.app
full screen. Every web deploy updates the app too, so testers only reinstall when this folder changes.

- Package name: `com.ivulatechnologies.vemi`
- Settings: `twa-manifest.json` (name, colours, start page, icons)
- Builder: `build-project.mjs` (Bubblewrap, pinned in `package.json`)

## Build the tester APK

The **Build Android Tester App** workflow builds a signed `.apk` on every push that touches this folder (or
run it by hand from the Actions tab). Download the `vemi-android-apk` artifact, unzip it and send the `.apk`
to testers. They tap it on their phone and allow "install unknown apps" once.

## The tester key

`tester-key/vemi-tester.p12` (password `vemi-tester`) signs tester builds only. It is committed on purpose so
every build has the same signature and testers can install updates over the old app. It is not the Google
Play key: Play builds are signed with the Ivula upload key from the Play Store guide, and never with this one.

`public/.well-known/assetlinks.json` lists the tester key's SHA-256 so the app opens without a browser bar.
When the app goes on Google Play, add the Play app signing key's SHA-256 there as well.
