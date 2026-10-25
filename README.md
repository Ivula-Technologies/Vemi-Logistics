# Vemi Logistics

Phone-first freight marketplace for Kenya and East Africa: shippers post loads, verified truck owners bid, the shipper books and pays by M-Pesa, the driver updates the trip from a link, and the carrier is paid after delivery.

- Product plan, pricing and regulatory notes: `docs/PLAN.md`
- Deploying on cPanel + Supabase: `DEPLOY.md`

## Stack

Next.js 16 (App Router, standalone output) · Supabase (Postgres with row-level security, Auth, Storage) · M-Pesa Daraja STK Push · Resend email · Africa's Talking SMS (optional) · Leaflet + OpenStreetMap · installable phone app (PWA).

## How it fits together

| Who | Where | What |
|---|---|---|
| Shipper | `/loads/new`, `/loads/[id]`, `/trips/[id]` | Post a load with a guide price, compare bids, book, pay, follow the trip, confirm or dispute, rate |
| Carrier | `/profile`, `/fleet`, `/board`, `/trips/[id]`, `/earnings` | Get verified, add trucks and drivers, bid, assign, update the trip, upload proof of delivery, see payouts |
| Driver | `/d/[token]` | No account: a secret link per trip with pickup contacts, big step buttons, location sharing and the delivery photo |
| Vemi ops | `/admin` | Verify carriers, record bank payments, settle disputes, cancel trips, export the M-Pesa bulk payout CSV and mark payouts paid |

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
