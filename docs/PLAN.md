# Vemi Logistics: product plan (v1, 2026-10-25)

Vemi is a phone-first marketplace that matches people who need goods moved (shippers) with verified truck owners and their drivers (carriers), starting in Kenya and running along the Northern Corridor (Mombasa, Nairobi, Malaba/Busia, Kampala, Kigali, Juba) and the Central Corridor (Dar es Salaam, Dodoma, Mwanza, Kigali, Bujumbura).

Think "Uber for trucks", but freight is booked hours or days ahead, not in 3 minutes, so the core is a live load board with instant guide prices and quick bids, then Uber-style trip tracking once a truck is assigned.

## 1. Who uses it

| User | What they want | What Vemi gives them |
|---|---|---|
| **Shipper** (SME trader, manufacturer, distributor, farmer co-op, importer clearing at Mombasa or Dar) | A reliable truck at a fair price, today or this week, and to know where their goods are | Post a load in a minute, see a guide price, compare bids from verified trucks, pay by M-Pesa, live trip timeline + map, delivery photo (POD) |
| **Carrier** (owner-driver with 1 truck, or a small fleet of 2 to 20 trucks) | Fewer empty return trips, and getting paid on time | Load board filtered by their truck types and routes, one-tap bid, guaranteed payout to M-Pesa after delivery, ratings that win more work |
| **Driver** (employed by the carrier) | Simple instructions, no new account | A trip link sent by SMS/WhatsApp: pickup contact, status buttons, location sharing, POD photo upload. No login. |
| **Vemi ops (admin)** | Trust and cash under control | Verify carriers and trucks (ID, KRA PIN, logbook, inspection, goods-in-transit insurance), see every load/trip, handle disputes, export M-Pesa payout files |

Beachhead: **Mombasa ⇄ Nairobi ⇄ Western Kenya/Kampala**, general cargo on 10 to 30 tonne trucks. It is the busiest freight lane in East Africa, and empty backhauls up-country to Mombasa are the carriers' biggest pain.

## 2. MVP scope (what this first build does)

1. **Sign up as shipper or carrier** (email + password; phone number captured for SMS and M-Pesa).
2. **Carrier onboarding**: business details, M-Pesa payout number, trucks (plate, type, tonnes), drivers (name, phone, licence), document uploads. Admin verifies before the carrier can bid.
3. **Post a load**: from/to (40+ East African towns and border points, plus street detail), pickup date, cargo type and description, weight, truck type needed. Vemi shows a **guide price** (distance × truck-type rate, plus a border allowance on cross-border loads). The shipper can post at the guide price or set their own.
4. **Load board for carriers**: open loads matching their truck types, sorted by pickup date; filter by origin/destination country. Bid at the shipper's price ("Accept at KES X") or a counter-offer.
5. **Book**: the shipper accepts one bid; other bids close automatically; a trip is created.
6. **Pay**: the shipper pays the trip price by **M-Pesa STK push** (Paybill/Till). Business shippers can choose **bank transfer** and Vemi ops mark it received. The truck is dispatched only after payment (or ops approval of credit).
7. **Assign and track**: the carrier picks the truck and driver; the driver gets a trip link. Status steps: Heading to pickup → Loaded → In transit → At border (cross-border only) → Delivered. The phone shares location while the trip page is open. The shipper sees a timeline and map (OpenStreetMap).
8. **Proof of delivery**: the driver uploads a POD photo (signed delivery note). The shipper confirms delivery or raises a dispute. If they do neither, delivery auto-confirms after 48 hours.
9. **Payout**: on confirmation the carrier's payout (price minus commission) is queued. Ops export a **bulk M-Pesa payment CSV** (for the M-Pesa org portal), pay, then mark payouts paid. (Automated B2C comes in phase 2, once Safaricom approves a B2C shortcode.)
10. **Ratings** both ways after delivery.
11. **Installable phone app (PWA)**: install banner, offline page, bottom tab bar. Works on cheap Android phones.
12. **Email notifications** (Resend) and optional **SMS** (Africa's Talking) for new bids, booking, payment, delivery, and the driver's trip link.
13. `/api/health` for UptimeRobot, daily cron for auto-confirm and expiring old loads.

**Not in MVP (phase 2+):** fuel advance to carriers at loading, automated M-Pesa B2C payouts, PayPal/Stripe for USD shippers, Uganda/Tanzania/Rwanda mobile money (MTN MoMo, Airtel), phone-number OTP login, customs/transit documents (KRA RECTS seal, T1, bond), multi-drop loads, part loads (LTL), backhaul suggestions, credit terms for big shippers, native Android app (Play Store TWA wrapper, same as our other apps), Swahili UI.

## 3. Money: pricing and commission

- **Shippers pay nothing to join.** They pay the agreed trip price.
- **Commission: 10% of the trip price, taken from the carrier's payout.** The carrier sees their net payout on every bid before they send it. Brokers in Kenya typically keep 10 to 20%, so 10% with guaranteed payment is a strong offer. Configurable in the app (`COMMISSION_BPS=1000`).
- **Founding carriers: 5% for their first 90 days** (first 50 verified carriers) to fill the supply side fast.
- **Payout timing promise:** within 24 hours of delivery confirmation (M-Pesa).
- **Guide price rates (KES per km, editable):** pickup 1t 60 · canter 3t 90 · 7t lorry 120 · 10t 150 · 14t 170 · trailer/flatbed 28t 220 · tipper 160 · tanker 230 · reefer 270 · low-bed 350, with a minimum charge per type, road distance estimated at 1.25× straight-line distance, and KES 15,000 per border crossing. Mombasa→Nairobi (≈550 km by this estimate, 485 km real road) on a 28t trailer comes out near KES 121,000, in line with today's market (KES 100k to 140k). Rates will be tuned from real bids after launch.
- **Later revenue:** Vemi Business subscription for factories and distributors (team logins, monthly invoice, credit terms, API) at about KES 4,900/month; fuel advance fee (2 to 3%); insurance referral commission; featured carrier listings.

**Unit economics target:** at an average trip of KES 80,000 and 10% commission, Vemi earns KES 8,000 per trip. 500 trips/month ≈ KES 4M/month (about $31k). Payment costs: M-Pesa Paybill charges are capped (about KES 108 on large amounts per transaction on the business tariff), and bulk B2C is about KES 22 to 110 per payout.

**M-Pesa limits:** one M-Pesa transaction is capped at KES 250,000 and KES 500,000 per day per customer. Loads above KES 250,000 pay by bank transfer (or split payments in phase 2).

## 4. Payments design

- One Daraja app (the same Paybill/Till as the other Ivula apps can be used, with Vemi as the account reference), STK push from the trip page, callback with a secret token, status check fallback (same proven code as ShelfKeeper).
- Money flow: shipper → Vemi Paybill → (after delivery) Vemi → carrier M-Pesa. Every shilling is recorded: `payments` (in) and `payouts` (out), with the commission on each trip.
- Cross-border shippers paying in USD: PayPal Business (phase 2), Stripe once the US LLC exists.

## 5. Regulatory and risk notes (to confirm with a Kenyan advocate before launch)

1. **Holding customer money.** Collecting a shipper's money and paying it to a carrier later can look like a payment/escrow service under the National Payment System Act (CBK). The safest MVP structure is that **Vemi is the contracting freight broker**: the shipper buys transport from Vemi, Vemi subcontracts the carrier and pays them as a supplier. That makes the money Vemi's revenue and cost, not a held deposit, but it also means Vemi carries the contract with the shipper. The terms of service in the app are written this way. **Have the advocate confirm.**
2. **Tax.** Vemi needs a KRA PIN, eTIMS invoices, and VAT registration once turnover passes KES 5M a year. Ask the accountant whether VAT applies to the full trip price (broker model) or just the commission (agent model). This choice is linked to point 1.
3. **Carrier compliance (checked at verification):** national ID or passport, KRA PIN, vehicle logbook or lease, NTSA inspection certificate (commercial vehicles are inspected yearly), **goods-in-transit (GIT) insurance**, driver licence class C/CE for heavy trucks. Cross-border carriers also need a **COMESA Yellow Card** and the permits each country asks for.
4. **Axle load limits.** The EAC Vehicle Load Control Act (2016) sets limits up to 56 t gross for the biggest combinations; overloads are fined at weighbridges. Shippers declare the weight; carriers must not accept overweight loads (in the terms).
5. **Prohibited cargo:** no hazardous goods without the right permits, no contraband, no live animals in MVP, no unaccompanied cash. In the terms and the cargo type list.
6. **Data protection.** Register Vemi (Ivula Technologies) with the **ODPC** as a data controller and processor (Data Protection Act 2019). Location is only shared while the driver's trip page is open, and the driver sees that clearly. A privacy page explains what is stored.
7. **Liability.** Damage/loss claims are first against the carrier's GIT insurance. Vemi caps its own liability in the terms. A cargo insurance partner (e.g. a Kenyan insurer's per-trip cover) is a phase 2 add-on.
8. **Transit cargo.** Goods in transit through Kenya under customs control need a KRA electronic cargo tracking seal (RECTS) and a transit bond. MVP handles domestic and cleared cargo; transit paperwork stays with the shipper's clearing agent.

## 6. Go-to-market (first 90 days)

1. **Supply first.** Sign 50 carriers on the Mombasa to Nairobi to Malaba lane: truck stops at Mlolongo, Athi River, Changamwe/Port Reitz yards, Nakuru, Eldoret. Founding 5% commission plus a guaranteed 24-hour payout is the pitch. WhatsApp trucker groups and transport SACCOs.
2. **Demand.** 30 SME shippers: hardware and FMCG distributors in Nairobi Industrial Area, maize/produce traders, clearing agents in Mombasa. Their first trip has no surprises: Vemi ops watches it end to end.
3. **Ops desk.** One phone/WhatsApp number manned by Vemi ops during business hours, watching every trip in the admin view.
4. Metrics: loads posted, % of loads booked within 24 h, time to first bid, on-time delivery %, disputes per 100 trips, carrier repeat rate.

## 7. Tech (same stack as our other apps)

- Next.js 16 (App Router, standalone server) on **cPanel Setup Node.js App**, manual zip uploads from a GitHub Action artifact.
- **Supabase**: Postgres with row-level security on every table; state changes (bid, accept, pay, status updates, confirm, payout) are database functions that check who is calling.
- Supabase Storage for documents and POD photos (private buckets).
- M-Pesa Daraja STK push; Resend email; Africa's Talking SMS (optional).
- PWA: manifest, service worker, offline page, install prompt.
- Maps: Leaflet + OpenStreetMap tiles (no Google Maps bill). Distances are estimated from town coordinates; a routing API can replace it later.
- Suggested address: `vemi.ivulatechnologies.com` until a brand domain (e.g. `vemi.co.ke`) is bought.

## 8. What needs Bius

1. Create the private repo `Ivula-Technologies/vemi`.
2. Later, to go live: a Supabase project, a Daraja Go-Live (Paybill or Till), a Resend domain, a cPanel subdomain, an advocate review of the terms (point 5.1), and ODPC registration.
