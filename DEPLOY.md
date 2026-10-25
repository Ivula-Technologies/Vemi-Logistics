# Deploying Vemi Logistics on cPanel

Vemi runs as a Node.js app (Next.js standalone server) under cPanel's **Setup Node.js App**, with Supabase for the database, logins and file storage.

## 1. Supabase (once)

1. Create a Supabase project (region: closest to Kenya, e.g. Frankfurt or Mumbai).
2. **SQL Editor**: paste all of `database/20261025090000_vemi_core.sql` (in the package, or `supabase/migrations/` in the repo) and click **Run**. It creates every table, access rule, function, the two private storage buckets and the list of towns and border posts.
3. **Authentication > URL Configuration**: Site URL `https://vemi.ivulatechnologies.com`; add `https://vemi.ivulatechnologies.com/auth/callback` to Redirect URLs.
4. **Authentication > Emails**: optional but recommended, use Resend SMTP so confirmation emails come from your domain.
5. **Project Settings > API**: copy the Project URL, the publishable key and the secret key.
6. Make yourself an admin: sign up in the app first, then in the SQL Editor run
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

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
- **UptimeRobot**: monitor `https://vemi.ivulatechnologies.com/api/health`. It returns 503 and the names of missing settings when something is not configured.

## 6. Smoke test

1. Sign up as a carrier, add a truck, a driver and the documents. In the admin account, open Carriers and verify them.
2. In another browser, sign up as a shipper and post a load that matches the truck type. The carrier gets an email and sees it on Find loads.
3. Bid as the carrier, book the bid as the shipper, pay with M-Pesa (sandbox) or record a bank payment as admin.
4. As the carrier, assign the truck and driver, then open the driver link on a phone and tap through to Delivered with a photo.
5. Confirm delivery as the shipper. Admin > Payouts shows the payout; download the bulk CSV, then mark it paid.

## Updating

Upload the new zip, Extract over the old files, Restart the app. If a release adds a file under `database/`, run it in the Supabase SQL Editor first.
