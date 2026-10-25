import "server-only";
import { createClient } from "@/lib/supabase/server";
import { placeMap } from "@/lib/places";
import { eta } from "@/lib/eta";
import { BEFORE_LOADING, PAYMENT_COLUMNS, TRIP_COLUMNS } from "@/lib/trips";
import type { BusinessAccount, CarrierScore, Driver, Load, LoadContacts, LoadStop, Message, Payment, Payout, PlaceRow, PlatformSettings, Profile, Trip, TripCharge, TripEvent, TripLocation, Truck } from "@/lib/types";

export type Viewer = "shipper" | "carrier" | "admin";

export type TripView = {
  trip: Trip; load: Load; viewer: Viewer; userId: string;
  origin: PlaceRow; destination: PlaceRow; places: Map<string, PlaceRow>;
  contacts: LoadContacts | null; stops: LoadStop[]; events: TripEvent[]; locations: TripLocation[];
  carrier: { business_name: string; rating_avg: number | null; rating_count: number } | null;
  counterpart: Pick<Profile, "full_name" | "phone" | "company"> | null;
  truck: Truck | null; driver: Driver | null; myRating: { stars: number; tags: string[]; comment: string | null } | null;
  charges: TripCharge[]; messages: Message[]; payments: Payment[]; payouts: Payout[];
  settings: PlatformSettings | null; codes: { pickup: string; delivery: string } | null; shareToken: string | null; driverToken: string | null;
  wallet: number; business: BusinessAccount | null; favourite: boolean; score: CarrierScore | null;
  fleet: { trucks: Truck[]; drivers: Driver[] };
  eta: { label: "pickup" | "delivery"; at: Date; hours: number } | null;
};

/** Everything the trip page shows, read through the viewer's own session (row-level security decides what comes back). */
export async function loadTripView(id: string, userId: string, role: Profile["role"]): Promise<TripView | null> {
  const supabase = await createClient();
  const { data: tripRow } = await supabase.from("trips").select(TRIP_COLUMNS).eq("id", id).maybeSingle();
  if (!tripRow) return null;
  const trip = tripRow as unknown as Trip;
  const viewer: Viewer = role === "admin" ? "admin" : trip.carrier_id === userId ? "carrier" : "shipper";

  const [{ data: load }, { data: contacts }, { data: stops }, { data: events }, { data: locations }, { data: carrier }, { data: counterpart }, { data: truck }, { data: driver }, { data: myRating }, { data: charges }, { data: messages }, { data: settings }, places] = await Promise.all([
    supabase.from("loads").select("*").eq("id", trip.load_id).single(),
    supabase.from("load_contacts").select("*").eq("load_id", trip.load_id).maybeSingle(),
    supabase.from("load_stops").select("*").eq("load_id", trip.load_id).order("seq"),
    supabase.from("trip_events").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
    supabase.from("trip_locations").select("lat, lng, recorded_at").eq("trip_id", id).order("recorded_at").limit(1000),
    supabase.from("carriers").select("business_name, rating_avg, rating_count").eq("id", trip.carrier_id).maybeSingle(),
    supabase.from("profiles").select("full_name, phone, company").eq("id", viewer === "carrier" ? trip.shipper_id : trip.carrier_id).maybeSingle(),
    trip.truck_id ? supabase.from("trucks").select("*").eq("id", trip.truck_id).maybeSingle() : Promise.resolve({ data: null }),
    trip.driver_id ? supabase.from("drivers").select("*").eq("id", trip.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ratings").select("stars, tags, comment").eq("trip_id", id).eq("rater_id", viewer === "carrier" ? userId : trip.shipper_id).maybeSingle(),
    supabase.from("trip_charges").select("*").eq("trip_id", id).order("created_at"),
    supabase.from("messages").select("*").eq("trip_id", id).order("created_at").limit(300),
    supabase.from("platform_settings").select("*").single(),
    placeMap(),
  ]);
  const l = load as Load;

  const view: TripView = {
    trip, load: l, viewer, userId, places, origin: places.get(l.origin_id)!, destination: places.get(l.destination_id)!,
    contacts: contacts as LoadContacts | null, stops: (stops ?? []) as LoadStop[], events: (events ?? []) as TripEvent[], locations: (locations ?? []) as TripLocation[],
    carrier, counterpart, truck: truck as Truck | null, driver: driver as Driver | null, myRating: viewer === "admin" ? null : myRating,
    charges: (charges ?? []) as TripCharge[], messages: (messages ?? []) as Message[], payments: [], payouts: [],
    settings: settings as PlatformSettings | null, codes: null, shareToken: null, driverToken: null, wallet: 0, business: null, favourite: false, score: null,
    fleet: { trucks: [], drivers: [] }, eta: null,
  };

  if (viewer === "carrier") {
    const [{ data: trucks }, { data: drivers }, { data: token }, { data: share }, { data: payouts }] = await Promise.all([
      supabase.from("trucks").select("*").eq("carrier_id", userId).eq("active", true),
      supabase.from("drivers").select("*").eq("carrier_id", userId).eq("active", true),
      supabase.rpc("trip_driver_token", { p_trip: id }),
      supabase.rpc("trip_share_token", { p_trip: id }),
      supabase.from("payouts").select("*").eq("trip_id", id),
    ]);
    view.fleet = { trucks: (trucks ?? []) as Truck[], drivers: (drivers ?? []) as Driver[] };
    view.driverToken = token as string | null;
    view.shareToken = share as string | null;
    view.payouts = (payouts ?? []) as Payout[];
  } else {
    const [{ data: payments }, { data: codes }, { data: share }, { data: wallet }, { data: business }, { data: favourite }, { data: scores }] = await Promise.all([
      supabase.from("payments").select(PAYMENT_COLUMNS).eq("trip_id", id).order("created_at", { ascending: false }),
      supabase.rpc("trip_codes", { p_trip: id }),
      supabase.rpc("trip_share_token", { p_trip: id }),
      viewer === "shipper" ? supabase.rpc("wallet_balance") : Promise.resolve({ data: 0 }),
      supabase.from("business_accounts").select("*").eq("owner_id", trip.shipper_id).maybeSingle(),
      supabase.from("favourite_carriers").select("carrier_id").eq("account_id", trip.shipper_id).eq("carrier_id", trip.carrier_id).maybeSingle(),
      supabase.rpc("carrier_scores", { p_ids: [trip.carrier_id] }),
    ]);
    view.payments = (payments ?? []) as unknown as Payment[];
    view.codes = codes as TripView["codes"];
    view.shareToken = share as string | null;
    view.wallet = (wallet as number | null) ?? 0;
    view.business = business as BusinessAccount | null;
    view.favourite = Boolean(favourite);
    view.score = ((scores ?? []) as CarrierScore[])[0] ?? null;
    if (viewer === "admin") {
      const [{ data: payouts }, { data: token }] = await Promise.all([supabase.from("payouts").select("*").eq("trip_id", id), supabase.rpc("trip_driver_token", { p_trip: id })]);
      view.payouts = (payouts ?? []) as Payout[];
      view.driverToken = token as string | null;
    }
  }
  view.eta = tripEta(view);
  return view;
}

/** ETA to pickup (before loading) or to delivery, from the truck's last position through the stops still ahead. */
export function tripEta(view: Pick<TripView, "trip" | "load" | "origin" | "destination" | "stops" | "locations" | "events" | "places">) {
  const { trip, load } = view;
  if (["awaiting_payment", "scheduled", "delivered", "completed", "disputed", "cancelled"].includes(trip.status)) return null;
  const last = view.locations.at(-1);
  if (!last) return null;
  const pin = (lat: number | null, lng: number | null, fallback: PlaceRow) => (lat !== null && lng !== null ? { lat, lng } : fallback);
  const pickup = pin(load.origin_lat, load.origin_lng, view.origin);
  const dropoff = pin(load.destination_lat, load.destination_lng, view.destination);
  if ((BEFORE_LOADING as string[]).includes(trip.status)) {
    return { label: "pickup" as const, ...eta(last, [pickup], 0) };
  }
  const ahead = view.stops.filter((s) => !s.done_at).map((s) => pin(s.lat, s.lng, view.places.get(s.place_id)!));
  const crossed = view.events.filter((e) => e.status === "at_border").length;
  return { label: "delivery" as const, ...eta(last, [...ahead, dropoff], Math.max(0, load.border_crossings - crossed)) };
}
