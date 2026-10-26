# Uber features in Vemi (2026-10-25)

The question: what does Uber (rides) and Uber Freight (trucks) do that the first Vemi build did not?
This is the full list, what Vemi now does for each, and what each one needs to switch on.

"Built in" means it works as soon as the app is deployed. "Needs a key" means the code is in and
switches itself on when the setting is added in cPanel (see DEPLOY.md).

## Booking and matching

| Uber feature | Vemi before | Vemi now |
|---|---|---|
| Instant booking at an upfront price (Uber Freight "Book now") | Bids only | **Instant book**: the shipper's price is a fixed fare. The first verified carrier to tap "Book now" gets the load. Bids and counter-offers still work. Built in. |
| Drivers go online and get matched with nearby requests | No idea where trucks are | **Go online**: carriers mark each truck available at a town, from a date, optionally heading somewhere. New loads alert the nearest free trucks first by SMS. Shippers see "5 trucks free near Mombasa". Built in. |
| Surge pricing | Flat guide price | **Busy-lane pricing**: the guide price adds up to 20% when many loads wait on a lane and few trucks are free, and 15% for same-day or next-day pickup. The shipper sees why. Built in. |
| Multiple stops | One pickup, one drop | **Multi-stop loads**: up to 5 extra drop-offs or pickups, each with its own contact. Priced by the extra distance plus KES 2,000 a stop. The driver ticks each stop. Built in. |
| Saved places (Home, Work) | Typed every time | **Saved places**: warehouses, yards and customers saved with contact and map pin, picked in one tap. Built in. |
| Schedule a ride for later | Pickup date | **Pickup date + time window** (morning, afternoon, evening) and a day-before reminder to the carrier and driver. Built in. |
| Pin drop on the map | Town list + typed landmark | **Map pins** for the exact gate, plus "use my location". Distance and navigation use the pin. Built in. |
| Ride again / favourites | Nothing | **Book again** (copies a past load) and **favourite carriers**: offer a load to your favourites first for 1 to 12 hours before everyone else sees it. Built in. |
| Upfront fare estimate before sign-up | Calculator on the home page | Kept, plus a public **quote API** (`/api/v1/quote`) for partners. Built in. |

## Money

| Uber feature | Vemi before | Vemi now |
|---|---|---|
| Promo codes | Nothing | **Promo codes** (percent or amount off, limits, expiry, first trip only) made by Vemi ops. Vemi pays the discount; the carrier still gets the full price. Built in. |
| Refer a friend | Nothing | **Referral codes**: a new shipper gets KES 1,000 off their first trip; whoever referred them gets KES 1,000 when that trip completes (wallet credit for shippers, a bonus payout for carriers). Built in. |
| Uber Cash / wallet | Nothing | **Vemi wallet**: credit from referrals, refunds and cancellations, used at checkout, or cashed out to M-Pesa. Built in. |
| Tips | Nothing | **Tip the driver** after delivery by M-Pesa. 100% goes to the carrier, no commission. Built in. |
| Cancellation fees | Shipper could only cancel before paying | **Fair cancellations**: free until the truck sets off; after that a 10% fee (minimum KES 2,000) goes to the carrier for their trouble, and the rest goes back to the shipper's wallet. Carriers can cancel before loading, which counts against their reliability score. Built in. |
| Wait-time charges (Uber Freight detention pay) | Nothing | **Waiting time**: drivers tap "Arrived" at pickup and drop-off. After 3 free hours, KES 1,500 an hour is added automatically. Carriers can also ask for other extra charges, which the shipper approves or declines. Built in. |
| Quick pay / fuel advance (Uber Freight) | Payout after delivery only | **Fuel advance**: once loaded, a carrier can take up to 30% of the payout early for a 3% fee. Built in (ops send it with the other payouts). |
| Cargo insurance (Uber Freight) | Nothing | **Cargo cover add-on**: the shipper declares the value and adds cover at 0.3% (minimum KES 500). Ops buy the cover from Vemi's insurance partner. Built in; needs an insurer agreement. |
| Cards and other wallets | M-Pesa + bank | **PayPal and cards** (through PayPal) for cross-border and diaspora shippers, priced in USD at the day's rate. Needs a PayPal Business live app. |
| Pay in parts | Over KES 250,000 had to be bank | **Pay in parts**: big trips can be paid in several M-Pesa payments. Built in. |
| Receipts | Nothing | **Receipts** for every trip (printable / save as PDF), emailed when paid, and a carrier statement. Built in. |
| Automatic driver payouts (Uber Instant Pay) | CSV for the M-Pesa portal | **M-Pesa B2C payouts** with one tap per batch, with the CSV kept as a fallback. Needs Safaricom to approve a B2C shortcode. |
| Uber for Business: company accounts, monthly invoice | Nothing | **Business accounts**: team logins for staff, credit terms (pay on invoice, 30 days) approved by Vemi, monthly statements. Built in. |

## Tracking and safety

| Uber feature | Vemi before | Vemi now |
|---|---|---|
| ETA | Map only | **ETA** to pickup and to delivery from the truck's last position, average truck speed, driving hours and border time. Built in. |
| Share my trip | Nothing | **Tracking link** for the receiver: live map, status and ETA, no phone numbers. Texted to the drop-off contact when the truck leaves. Built in (SMS needs Africa's Talking). |
| PIN verification | Nothing | **Pickup and delivery codes**: the driver enters the pickup code to start loading and the receiver's code to finish. Without the delivery code, the driver must upload a delivery photo. Built in. |
| Emergency button | Nothing | **SOS** for driver, shipper and carrier: alerts Vemi ops (email and SMS) with the last location, and shows 999 / 112. Built in. |
| RideCheck (stopped or off-route) | Nothing | **Truck watch**: every 15 minutes Vemi checks live trips; a truck with no signal for 3 hours or stopped for 2 hours away from a border is flagged to ops and the carrier. Built in (needs the 15-minute cron). |
| Driver photo and car details | Plate and name | **Driver photo and truck photo** shown to the shipper once paid. Built in. |
| Background checks | Carrier documents | Adds the **police certificate of good conduct** and per-driver licence documents, and **expiry reminders** 14 days before insurance or inspection runs out. Built in. |

## Talking to each other

| Uber feature | Vemi before | Vemi now |
|---|---|---|
| In-app chat | Phone numbers after payment | **Trip chat** between shipper, carrier, driver and Vemi support. Built in. |
| Masked calling | Real numbers shown | **Call through Vemi**: both sides see a Vemi number, not each other's. Needs an Africa's Talking voice number. Real numbers stay as a fallback until then. |
| Push notifications | Email and SMS | **Push notifications** on the installed phone app for bids, bookings, payments, status, chat. Needs VAPID keys (one command, in DEPLOY.md). |
| Help centre | Nothing | **Help page** (FAQs for shippers, carriers, drivers) and **Get help** on each trip, which opens a chat with Vemi support. Built in. |

## Accounts

| Uber feature | Vemi before | Vemi now |
|---|---|---|
| Sign in with phone number | Email + password | **Phone sign-in with an SMS code**. Needs Africa's Talking. |
| Sign in with Google | Nothing | **Google sign-in**, with a first-time "shipper or carrier?" step. Needs Google switched on in Supabase. |
| Ratings with compliments | Stars + comment | Stars plus **compliments** ("On time", "Careful with goods", ...), shown on carrier profiles and bids. Built in. |
| Driver and carrier scores | Rating only | **Reliability score**: on-time %, completed trips, cancellations, shown with every bid. Built in. |
| Languages | English | **Kiswahili** for the driver page and driver texts (chosen per driver). Built in. |
| Lost items / damage | Free-text dispute | **Damage claims**: claim amount and photos; ops can pay the carrier, hold, or split (part of the payout goes to the shipper's wallet). Built in. |

## Ops (Uber's internal tools)

- **Live map** of every truck on the road, with alerts first.
- **Shipper reports**: spend by month, on-time %, top lanes, CSV export.
- **Busy lanes** for carriers: where loads are waiting and what they pay per km.
- **Return loads**: carriers see loads leaving the town their truck is heading to.
- Ops screens for promo codes, business credit, refunds and wallet cash-outs, insured trips and SOS alerts.

## Not copied on purpose

- **Pay-per-minute fares**: freight is priced per trip; waiting time covers the delays.
- **Uber's own driver background-check vendor**: Kenya has no API for police records yet, so ops check the certificate by hand.
- **A native Android app**: the installable phone app does the same; a Play Store wrapper follows the guide used for the other Ivula apps.
