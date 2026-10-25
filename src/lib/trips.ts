/** Labels and the order of steps for trips and loads, shared by every screen. */

export const TRIP_STATUS = {
  awaiting_payment: { label: "Waiting for payment", tone: "warning" },
  scheduled: { label: "Paid, truck scheduled", tone: "info" },
  to_pickup: { label: "Heading to pickup", tone: "info" },
  at_pickup: { label: "At pickup, loading", tone: "info" },
  loaded: { label: "Loaded", tone: "info" },
  in_transit: { label: "On the road", tone: "info" },
  at_border: { label: "At the border", tone: "warning" },
  at_dropoff: { label: "At drop-off, offloading", tone: "info" },
  delivered: { label: "Delivered, awaiting confirmation", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  disputed: { label: "In dispute", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
} as const;
export type TripStatus = keyof typeof TRIP_STATUS;

export const LOAD_STATUS = {
  open: { label: "Open for bids", tone: "info" },
  booked: { label: "Booked", tone: "success" },
  cancelled: { label: "Cancelled", tone: "muted" },
  expired: { label: "Expired", tone: "muted" },
} as const;
export type LoadStatus = keyof typeof LOAD_STATUS;

export type Tone = "info" | "success" | "warning" | "danger" | "muted";

export type Step = { status: TripStatus; label: string; needsCode?: "pickup" | "delivery" };

/** The next steps the carrier or driver can take from here. Mirrors private.advance_trip(). */
export function nextSteps(status: string, crossBorder: boolean): Step[] {
  const deliver: Step = { status: "delivered", label: "Delivered", needsCode: "delivery" };
  switch (status) {
    case "scheduled": return [{ status: "to_pickup", label: "Start: heading to pickup" }];
    case "to_pickup": return [{ status: "at_pickup", label: "Arrived at pickup" }, { status: "loaded", label: "Goods are loaded", needsCode: "pickup" }];
    case "at_pickup": return [{ status: "loaded", label: "Goods are loaded", needsCode: "pickup" }];
    case "loaded": return [{ status: "in_transit", label: "Leaving with the goods" }];
    case "in_transit": return crossBorder
      ? [{ status: "at_border", label: "Arrived at a border" }, { status: "at_dropoff", label: "Arrived at drop-off" }, deliver]
      : [{ status: "at_dropoff", label: "Arrived at drop-off" }, deliver];
    case "at_border": return [{ status: "in_transit", label: "Cleared the border" }, { status: "at_dropoff", label: "Arrived at drop-off" }, deliver];
    case "at_dropoff": return [deliver];
    default: return [];
  }
}

/** Steps shown on the progress bar, in order. */
export const PROGRESS: TripStatus[] = ["awaiting_payment", "scheduled", "to_pickup", "loaded", "in_transit", "delivered", "completed"];

export function progressIndex(status: string) {
  if (status === "at_pickup") return PROGRESS.indexOf("to_pickup");
  if (status === "at_border" || status === "at_dropoff") return PROGRESS.indexOf("in_transit");
  if (status === "disputed") return PROGRESS.indexOf("delivered");
  return PROGRESS.indexOf(status as TripStatus);
}

export const LIVE_STATUSES: TripStatus[] = ["to_pickup", "at_pickup", "loaded", "in_transit", "at_border", "at_dropoff"];
/** Before loading: the trip can still be cancelled by the shipper or carrier. */
export const BEFORE_LOADING: TripStatus[] = ["awaiting_payment", "scheduled", "to_pickup", "at_pickup"];
/** Goods on the truck. */
export const ON_THE_ROAD: TripStatus[] = ["loaded", "in_transit", "at_border", "at_dropoff"];

export const CARGO_TYPES = {
  general: "General goods",
  fmcg: "FMCG / retail stock",
  construction: "Construction materials",
  agricultural: "Agricultural produce",
  container: "Container (20 ft / 40 ft)",
  machinery: "Machinery and equipment",
  furniture: "Furniture and household",
  fuel_liquid: "Liquids (licensed tanker only)",
  cold_chain: "Cold chain (chilled / frozen)",
  livestock_feed: "Animal feed",
  other: "Other",
} as const;
export type CargoType = keyof typeof CARGO_TYPES;

export const DOCUMENT_KINDS = {
  national_id: "National ID or passport",
  kra_pin: "KRA PIN certificate",
  logbook: "Vehicle logbook (or lease)",
  inspection: "NTSA inspection certificate",
  git_insurance: "Goods-in-transit insurance",
  driving_licence: "Driving licence (class C/CE)",
  yellow_card: "COMESA Yellow Card (cross-border)",
  good_conduct: "Police certificate of good conduct",
  other: "Other",
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;
/** Needed before Vemi verifies a carrier. */
export const REQUIRED_DOCUMENTS: DocumentKind[] = ["national_id", "kra_pin", "logbook", "inspection", "git_insurance"];

/** Trips have a secret column (the driver link token), so never select("*") on them through the user's session. */
export const TRIP_COLUMNS = "id, ref, load_id, bid_id, shipper_id, carrier_id, price, commission_bps, commission, carrier_payout, truck_id, driver_id, status, amount_paid, paid_at, picked_up_at, delivered_at, completed_at, pod_path, dispute_reason, cancel_reason, created_at, updated_at, insurance_fee, discount, extras, extras_commission, tip, advance_amount, advance_fee, on_credit, credit_due_on, expected_delivery, arrived_pickup_at, arrived_dropoff_at, sos_at, sos_note, alert, alert_at, claim_amount, dispute_files, cancel_fee, cancelled_by, total_due, balance";
export const PAYMENT_COLUMNS = "id, trip_id, method, amount, phone, receipt, status, result_description, created_at, paid_at, purpose, usd_amount";

export const PICKUP_WINDOWS = { anytime: "Any time", morning: "Morning (6am to 12pm)", afternoon: "Afternoon (12pm to 5pm)", evening: "Evening (5pm to 9pm)" } as const;
export type PickupWindow = keyof typeof PICKUP_WINDOWS;

export const CHARGE_KINDS = { waiting: "Waiting time", extra_stop: "Extra stop", loading: "Loading or offloading help", other: "Other" } as const;
export type ChargeKind = keyof typeof CHARGE_KINDS;

/** Compliments a shipper can give a carrier, and a carrier a shipper. Mirrors the ratings.tags check. */
export const COMPLIMENTS = {
  carrier: { on_time: "On time", careful: "Careful with goods", communication: "Kept me updated", professional: "Professional driver", clean_truck: "Clean truck" },
  shipper: { ready_on_time: "Goods ready on time", fast_loading: "Fast loading", clear_directions: "Clear directions", pays_fast: "Pays fast" },
} as const;
export const COMPLIMENT_LABELS: Record<string, string> = { ...COMPLIMENTS.carrier, ...COMPLIMENTS.shipper };

export const ALERTS = { no_signal: "No signal from the truck for 3 hours", stopped: "Truck stopped for 2 hours" } as const;
