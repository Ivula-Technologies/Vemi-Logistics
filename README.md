# Vemi Logistics

Phone-first freight marketplace for Kenya and East Africa: shippers post loads, verified truck owners bid, the shipper books and pays by M-Pesa, the driver updates the trip from a link, and the carrier is paid after delivery.

- Product plan, pricing and regulatory notes: `docs/PLAN.md`
- Deploying on cPanel + Supabase: `DEPLOY.md`
- Every Uber / Uber Freight feature and how Vemi does it: `docs/UBER-FEATURES.md`

## Stack

Next.js 16 (App Router, standalone output) · Supabase (Postgres with row-level security, Auth, Storage) · M-Pesa Daraja STK Push · Resend email · Africa's Talking SMS (optional) · Leaflet + OpenStreetMap · installable phone app (PWA).

## How it fits together

| Who | Where | What |
|---|---|---|
| Shipper | `/loads/new`, `/loads/[id]`, `/trips/[id]`, `/wallet`, `/business`, `/reports` | Post a load (stops, pins, instant booking, codes, cargo cover, favourites first), compare bids, book, pay (M-Pesa in parts, card, wallet, on account, bank), chat, track with ETA, share a tracking link, confirm or claim, rate, tip, book again; team logins and monthly reports |
| Carrier | `/profile`, `/fleet`, `/board`, `/trips/[id]`, `/earnings` | Get verified, add trucks and drivers (photos, language), mark trucks free, bid or book now, assign, update with codes, ask for extras or a fuel advance, see payouts |
| Driver | `/d/[token]` | No account: a secret link per trip in Kiswahili or English, directions, stops, codes, chat, call through Vemi, SOS, location sharing and the delivery photo |
| Receiver | `/t/[token]` | Live tracking link: map, status and ETA, no prices or phone numbers |
| Vemi ops | `/admin` | Live map with SOS and truck alerts, verify carriers, payments, disputes with photo claims, payouts and cash-outs (CSV or M-Pesa B2C), promo codes, business credit, prices and fees |

Every state change (bid, book, pay, move, confirm, dispute, payout) is a database function in `supabase/migrations/` that checks who is calling. The app hides buttons but never relies on that for security. Contact details stay hidden until a trip is paid, so deals can't be taken off the platform before then.

Commission: 10% of the trip price from the carrier's payout (5% for the first 50 verified carriers for 90 days), set in `platform_settings`.

## Develop

```bash
npm ci
cp .env.example .env.local   # fill in Supabase values
npm run dev
npm run typecheck && npm run lint && npm test
npm run test:db              # needs a local Postgres 15+ (PGHOST/PGUSER/...)
```
