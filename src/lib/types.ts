import type { TruckType } from "@/lib/pricing";
import type { CargoType, ChargeKind, LoadStatus, PickupWindow, TripStatus } from "@/lib/trips";

export type Role = "shipper" | "carrier" | "admin";

export type Profile = {
  id: string; role: Role; full_name: string; phone: string | null; company: string | null;
  rating_avg: number | null; rating_count: number; created_at: string;
  referral_code: string | null; referred_by: string | null; onboarded: boolean;
};

export type BusinessAccount = {
  owner_id: string; legal_name: string; kra_pin: string | null; billing_email: string | null; billing_phone: string | null;
  credit_status: "none" | "requested" | "approved" | "declined" | "suspended"; credit_limit: number; terms_days: number;
  credit_note: string | null; requested_at: string | null; decided_at: string | null; created_at: string;
};
export type TeamMember = { member_id: string; account_id: string; role: "admin" | "booker"; created_at: string };

export type Carrier = {
  id: string; business_name: string; base_town: string | null; cross_border: boolean; countries: string[];
  rating_avg: number | null; rating_count: number;
  status: "pending" | "verified" | "rejected" | "suspended"; review_note: string | null; verified_at: string | null;
  founding_until: string | null; commission_bps: number | null; created_at: string; cancellations: number;
};

export type CarrierPrivate = { carrier_id: string; kra_pin: string | null; id_number: string | null; payout_phone: string | null; payout_name: string | null };

export type Truck = { id: string; carrier_id: string; plate: string; truck_type: TruckType; capacity_tonnes: number; make_model: string | null; active: boolean; photo_path: string | null };
export type Driver = { id: string; carrier_id: string; full_name: string; phone: string; licence_no: string | null; active: boolean; photo_path: string | null; language: "en" | "sw" };
export type TruckAvailability = { truck_id: string; carrier_id: string; place_id: string; lat: number | null; lng: number | null; available_from: string; heading_to: string | null; note: string | null; updated_at: string; expires_at: string };

export type PlaceRow = { id: string; name: string; country: string; lat: number; lng: number; is_border: boolean };

export type Load = {
  id: string; ref: string; shipper_id: string; origin_id: string; origin_detail: string | null; destination_id: string; destination_detail: string | null;
  pickup_date: string; cargo_type: CargoType; cargo_description: string; weight_tonnes: number; truck_type: TruckType;
  distance_km: number; border_crossings: number; guide_price: number; price: number; currency: "KES"; notes: string | null;
  status: LoadStatus; created_at: string; updated_at: string;
  instant_book: boolean; pickup_window: PickupWindow; origin_lat: number | null; origin_lng: number | null; destination_lat: number | null; destination_lng: number | null;
  favourites_until: string | null; surge_bps: number; stop_count: number; declared_value: number | null; insure: boolean; require_codes: boolean; copied_from: string | null;
};

export type StopContact = { seq: number; name: string | null; phone: string | null };
export type LoadContacts = { load_id: string; pickup_name: string | null; pickup_phone: string | null; dropoff_name: string | null; dropoff_phone: string | null; stops: StopContact[] };
export type LoadStop = { id: string; load_id: string; seq: number; kind: "drop" | "pickup"; place_id: string; detail: string | null; lat: number | null; lng: number | null; done_at: string | null };
export type SavedPlace = { id: string; account_id: string; label: string; place_id: string; detail: string | null; lat: number | null; lng: number | null; contact_name: string | null; contact_phone: string | null };

export type Bid = {
  id: string; load_id: string; carrier_id: string; amount: number; note: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn"; created_at: string; updated_at: string;
};

export type Trip = {
  id: string; ref: string; load_id: string; bid_id: string; shipper_id: string; carrier_id: string;
  price: number; commission_bps: number; commission: number; carrier_payout: number;
  truck_id: string | null; driver_id: string | null; status: TripStatus; amount_paid: number;
  paid_at: string | null; picked_up_at: string | null; delivered_at: string | null; completed_at: string | null;
  pod_path: string | null; dispute_reason: string | null; cancel_reason: string | null; created_at: string; updated_at: string;
  insurance_fee: number; discount: number; extras: number; extras_commission: number; tip: number; advance_amount: number; advance_fee: number;
  on_credit: boolean; credit_due_on: string | null; expected_delivery: string | null; arrived_pickup_at: string | null; arrived_dropoff_at: string | null;
  sos_at: string | null; sos_note: string | null; alert: "no_signal" | "stopped" | null; alert_at: string | null; claim_amount: number | null; dispute_files: string[];
  cancel_fee: number; cancelled_by: "shipper" | "carrier" | "admin" | null; total_due: number; balance: number;
};

export type TripCharge = { id: string; trip_id: string; kind: ChargeKind; amount: number; commission: number; note: string | null; status: "pending" | "approved" | "declined"; requested_by: string; created_at: string; decided_at: string | null };
export type Message = { id: number; trip_id: string; sender: "shipper" | "carrier" | "driver" | "vemi"; sender_id: string | null; body: string; to_support: boolean; created_at: string };

export type TripEvent = { id: number; trip_id: string; status: string; note: string | null; actor: string; lat: number | null; lng: number | null; created_at: string };
export type TripLocation = { id: number; trip_id: string; lat: number; lng: number; accuracy_m: number | null; recorded_at: string };

export type Payment = { id: string; trip_id: string; method: "mpesa" | "bank" | "paypal" | "wallet"; amount: number; phone: string | null; receipt: string | null; status: "pending" | "paid" | "failed"; result_description: string | null; created_at: string; paid_at: string | null; purpose: "trip" | "tip"; usd_amount: number | null };
export type PayoutKind = "trip" | "advance" | "tip" | "cancellation" | "bonus";
export type Payout = { id: string; trip_id: string; carrier_id: string; amount: number; phone: string | null; status: "queued" | "sending" | "paid" | "held"; reference: string | null; paid_at: string | null; created_at: string; kind: PayoutKind; b2c_error: string | null };
export type WalletEntry = { id: number; account_id: string; amount: number; kind: string; reason: string; trip_id: string | null; created_at: string };
export type Refund = { id: string; account_id: string; amount: number; phone: string; status: "queued" | "sending" | "paid" | "cancelled"; reference: string | null; created_at: string; paid_at: string | null };
export type PromoCode = { code: string; description: string | null; kind: "percent" | "amount"; value: number; max_discount_kes: number | null; max_uses: number | null; uses: number; first_trip_only: boolean; min_price_kes: number; expires_at: string | null; active: boolean; created_at: string };
export type CarrierScore = { carrier_id: string; completed: number; on_time_pct: number | null; cancellations: number; compliments: string[] };

export type PlatformSettings = {
  commission_bps: number; founding_commission_bps: number; founding_days: number; founding_slots: number; auto_confirm_hours: number; mpesa_max_kes: number;
  urgent_surcharge_bps: number; busy_lane_max_bps: number; stop_fee_kes: number; free_waiting_hours: number; waiting_kes_per_hour: number;
  cancel_fee_bps: number; cancel_fee_min_kes: number; insurance_bps: number; insurance_min_kes: number; fuel_advance_max_bps: number; fuel_advance_fee_bps: number;
  referral_reward_kes: number; referee_credit_kes: number; usd_rate: number;
};
export type LaneSurge = { urgent_bps: number; busy_bps: number; open_loads: number; free_trucks: number };

export type ActionState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string[] | undefined> };
export const idleState: ActionState = { status: "idle" };
