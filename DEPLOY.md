# Deploying Vemi Logistics on cPanel

Vemi runs as a Node.js app (Next.js standalone server) under cPanel's **Setup Node.js App**, with Supabase for the database, logins and file storage.

## 1. Supabase (once)

1. Create a Supabase project (region: closest to Kenya, e.g. Frankfurt or Mumbai).
2. **SQL Editor**: paste all of `database/20261025090000_vemi_core.sql` (in the package, or `supabase/migrations/` in the repo) and click **Run**. Then do the same with `database/20261025120000_uber_features.sql`. Together they create every table, access rule, function, the private storage buckets and the list of towns and border posts. Always run them in date order.
3. **Authentication > URL Configuration**: Site URL `https://vemi.ivulatechnologies.com`; add `https://vemi.ivulatechnologies.com/auth/callback` to Redirect URLs.
4. **Authentication > Emails**: optional but recommended, use Resend SMTP so confirmation emails come from your domain.
5. **Project Settings > API**: copy the Project URL, the publishable key and the secret key.
6. Make yourself an admin: sign up in the app first, then in the SQL Editor run
   `update public.profiles set role = 'admin', onboarded = true where id = (select id from auth.users where email = 'you@example.com');`
7. Optional, **Authentication > Providers > Google**: switch it on (Google Cloud OAuth client, redirect URL as Supabase shows), then set `NEXT_PUBLIC_GOOGLE_SIGNIN=on`.

## 2. GitHub (once)

Repository **Settings > Secrets and variables > Actions > Variables**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`. They are public values baked into the browser bundle. Never put the secret key in GitHub.

## 3. M-Pesa (Daraja)

1. On developer.safaricom.co.ke create an app with **M-Pesa Express (STK Push)**. Test with the sandbox shortcode `174379` and its passkey first.
2. Apply for **Go Live** with the Paybill (or Till) that should receive shipper payments. Then set `MPESA_ENV=production` and the live key, secret, shortcode and passkey.
3. `MPESA_CALLBACK_SECRET` is any long random string; the app adds it to the callback URL so nobody else can fake a payment.
4. M-Pesa takes at most KES 250,000 per transaction. Bigger trips are paid by bank transfer, and ops record them in the app.

## 4. Build and upload

1. Download the **vemi-cpanel** artifact from the latest **Build cPanel Package** run on GitHub Actions (built on every push to main).
2. In cPanel **File Manager**, upload the zip into a folder outside `public_html`, e.g. `~/vemi`, and **Extract** it (overwrite on updates).
3. **Setup Node.js App > Create application**: Node.js 20 or newer, mode Production, application root `vemi`, application URL `vemi.ivulatechnologies.com`, startup file `server.js`.
4. Add every variable from `.env.example` under **Environment variables**, then **Restart**. Settings stay when you upload new versions; you never need **Run NPM Install**.
5. Make sure AutoSSL covers the subdomain.

## 5. Daily job and monitoring

- **Cron Jobs**: once a day (e.g. 06:00) run
  `curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://vemi.ivulatechnologies.com/api/cron/daily > /dev/null`
  It confirms deliveries the shipper did not answer within 48 hours (queuing the payout) and expires stale loads.
- **Cron Jobs**: every 15 minutes run
  `curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://vemi.ivulatechnologies.com/api/cron/frequent > /dev/null`
  It opens favourites-first loads to everyone when their window ends, adds waiting-time charges and flags trucks that have gone quiet or stopped (truck watch).
- The daily job also sends pickup reminders (carrier and driver, in the driver's language), document expiry reminders and overdue invoice reminders.
- **UptimeRobot**: monitor `https://vemi.ivulatechnologies.com/api/health`. It returns 503 and the names of missing settings when something is not configured.

## 6. Optional switches (each turns on by itself once its settings are in)

| Feature | What to set up | Settings |
|---|---|---|
| Phone sign-in by SMS code | Africa's Talking SMS (already used for alerts) | `AT_*`, `LOGIN_CODE_SECRET` |
| Push notifications | Run `npx web-push generate-vapid-keys` once | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (also as a GitHub variable), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Calls through Vemi (private numbers) | Africa's Talking voice number; set its callback URL to `https://vemi.ivulatechnologies.com/api/voice/callback?secret=YOUR_AT_VOICE_CALLBACK_SECRET` | `AT_VOICE_NUMBER`, `AT_VOICE_CALLBACK_SECRET` |
| Card payments | PayPal Business account, live REST app | `PAYPAL_ENV=live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| One-tap M-Pesa payouts | Safaricom B2C shortcode and initiator (Daraja Go Live) | `MPESA_B2C_*` |
| SOS and alert SMS to the duty phone | | `VEMI_OPS_PHONE` |
| Help page contacts, receipt details | | `NEXT_PUBLIC_SUPPORT_*`, `VEMI_LEGAL_NAME`, `VEMI_KRA_PIN`, `VEMI_ADDRESS` |

Prices and fees (commission, surge, stop fee, waiting time, cancellation fee, cargo cover, fuel advance, referral amounts, dollar rate) are edited in the app under **Admin > Settings**. Promo codes are made under **Admin > Promo codes**.

## 7. Smoke test

1. Sign up as a carrier, add a truck, a driver and the documents. In the admin account, open Carriers and verify them.
2. In another browser, sign up as a shipper and post a load that matches the truck type. The carrier gets an email and sees it on Find loads.
3. Bid as the carrier, book the bid as the shipper, pay with M-Pesa (sandbox) or record a bank payment as admin.
4. As the carrier, assign the truck and driver, then open the driver link on a phone and tap through to Delivered with a photo.
5. Confirm delivery as the shipper. Admin > Payouts shows the payout; download the bulk CSV, then mark it paid.

## Hosting on Vercel instead of cPanel

The same code runs on Vercel with no changes. Steps 1 (Supabase), 3 (M-Pesa) and 6 (optional switches) stay the same; Vercel replaces steps 2, 4 and most of 5.

1. The Vercel project `vemi-logistics` is already linked to this repository, and every push to `main` deploys to production.
2. **Project > Settings > Environment Variables**: add every variable from `.env.example` for **Production** (and Preview if you want previews to work). `NEXT_PUBLIC_SITE_URL` is the address people use, for example `https://vemi-logistics.vercel.app` until a domain is added. Then **Redeploy** so the `NEXT_PUBLIC_*` values are built in.
3. In Supabase **Authentication > URL Configuration**, use the Vercel address as the Site URL and add `<address>/auth/callback` to the Redirect URLs.
4. **Daily job**: `vercel.json` runs `/api/cron/daily` every day at 06:00 Kenya time. Vercel sends `CRON_SECRET` by itself, so just set that variable.
5. **Every-15-minutes job**: Vercel's free (Hobby) plan only runs crons once a day. Use a free scheduler such as cron-job.org: URL `<address>/api/cron/frequent`, every 15 minutes, request header `Authorization: Bearer YOUR_CRON_SECRET`. On Vercel Pro you can add it to `vercel.json` instead with schedule `*/15 * * * *`.
6. **Custom domain** (optional): Project > Settings > Domains, add `vemi.ivulatechnologies.com`, then add the CNAME record Vercel shows in cPanel **Zone Editor**. Update `NEXT_PUBLIC_SITE_URL`, the Supabase URLs and the M-Pesa callback, then redeploy.
7. **Uploads**: Vercel accepts at most 4.5 MB per request, so the app shrinks phone photos in the browser and limits PDFs to 4 MB when it runs on Vercel.
8. `vercel.json` pins the functions to Frankfurt (`fra1`). If your Supabase project is in another region, change it to the nearest Vercel region so pages stay fast.

Vercel's Hobby plan is meant for personal, non-commercial projects. It is fine while you test and onboard the first carriers; move to Pro ($20 a month) once Vemi takes real payments.

## Updating

cPanel: upload the new zip, Extract over the old files, Restart the app. Vercel: merging to `main` deploys by itself. If a release adds a file under `database/`, run it in the Supabase SQL Editor first.
