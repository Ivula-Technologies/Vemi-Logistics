import type { TruckType } from "@/lib/pricing";
import type { CargoType, LoadStatus, TripStatus } from "@/lib/trips";

export type Role = "shipper" | "carrier" | "admin";

export type Profile = {
  id: string; role: Role; full_name: string; phone: string | null; company: string | null;
  rating_avg: number | null; rating_count: number; created_at: string;
};

export type Carrier = {
  id: string; business_name: string; base_town: string | null; cross_border: boolean; countries: string[];
  rating_avg: number | null; rating_count: number;
  status: "pending" | "verified" | "rejected" | "suspended"; review_note: string | null; verified_at: string | null;
  founding_until: string | null; commission_bps: number | null; created_at: string;
};

export type CarrierPrivate = { carrier_id: string; kra_pin: string | null; id_number: string | null; payout_phone: string | null; payout_name: string | null };

export type Truck = { id: string; carrier_id: string; plate: string; truck_type: TruckType; capacity_tonnes: number; make_model: string | null; active: boolean };
export type Driver = { id: string; carrier_id: string; full_name: string; phone: string; licence_no: string | null; active: boolean };

export type PlaceRow = { id: string; name: string; country: string; lat: number; lng: number; is_border: boolean };

export type Load = {
  id: string; ref: string; shipper_id: string; origin_id: string; origin_detail: string | null; destination_id: string; destination_detail: string | null;
  pickup_date: string; cargo_type: CargoType; cargo_description: string; weight_tonnes: number; truck_type: TruckType;
  distance_km: number; border_crossings: number; guide_price: number; price: number; currency: "KES"; notes: string | null;
  status: LoadStatus; created_at: string; updated_at: string;
};

export type LoadContacts = { load_id: string; pickup_name: string | null; pickup_phone: string | null; dropoff_name: string | null; dropoff_phone: string | null };

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
};

export type TripEvent = { id: number; trip_id: string; status: string; note: string | null; actor: string; lat: number | null; lng: number | null; created_at: string };
export type TripLocation = { id: number; trip_id: string; lat: number; lng: number; accuracy_m: number | null; recorded_at: string };

export type Payment = { id: string; trip_id: string; method: "mpesa" | "bank"; amount: number; phone: string | null; receipt: string | null; status: "pending" | "paid" | "failed"; result_description: string | null; created_at: string; paid_at: string | null };
export type Payout = { id: string; trip_id: string; carrier_id: string; amount: number; phone: string | null; status: "queued" | "paid" | "held"; reference: string | null; paid_at: string | null; created_at: string };

export type PlatformSettings = { commission_bps: number; founding_commission_bps: number; founding_days: number; founding_slots: number; auto_confirm_hours: number; mpesa_max_kes: number };

export type ActionState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string[] | undefined> };
export const idleState: ActionState = { status: "idle" };
