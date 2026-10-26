-- Vemi Logistics: the whole marketplace schema.
-- Shippers post loads, verified carriers bid, the shipper books one bid, which creates a trip.
-- The trip is paid (M-Pesa or bank), dispatched, tracked, delivered and confirmed, and the carrier's
-- payout is queued. Every table has row-level security; every state change is a function below that
-- checks who is calling. Safe to run once on a fresh Supabase project.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
-- Signed-in users need the schema for the helper functions the access rules call; the API does not expose it.
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'shipper' check (role in ('shipper', 'carrier', 'admin')),
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  company text check (char_length(company) <= 160),
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_bps integer not null default 1000 check (commission_bps between 0 and 5000),
  founding_commission_bps integer not null default 500 check (founding_commission_bps between 0 and 5000),
  founding_days integer not null default 90 check (founding_days >= 0),
  founding_slots integer not null default 50 check (founding_slots >= 0),
  auto_confirm_hours integer not null default 48 check (auto_confirm_hours between 1 and 720),
  mpesa_max_kes integer not null default 250000 check (mpesa_max_kes > 0)
);
insert into public.platform_settings default values;

create table public.carriers (
  id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  base_town text check (char_length(base_town) <= 80),
  cross_border boolean not null default false,
  countries text[] not null default '{KE}',
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  review_note text,
  verified_at timestamptz,
  founding_until timestamptz,
  commission_bps integer check (commission_bps between 0 and 5000),
  created_at timestamptz not null default now()
);

-- Kept apart from carriers so other people never see them, whatever they can see of the carrier.
create table public.carrier_private (
  carrier_id uuid primary key references public.carriers (id) on delete cascade,
  kra_pin text check (kra_pin is null or kra_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  id_number text check (char_length(id_number) <= 20),
  payout_phone text check (payout_phone is null or payout_phone ~ '^254[17][0-9]{8}$'),
  payout_name text check (char_length(payout_name) <= 120),
  updated_at timestamptz not null default now()
);

create table public.carrier_documents (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  kind text not null check (kind in ('national_id', 'kra_pin', 'logbook', 'inspection', 'git_insurance', 'driving_licence', 'yellow_card', 'other')),
  path text not null unique,
  file_name text not null,
  expires_on date,
  created_at timestamptz not null default now()
);
create index carrier_documents_carrier on public.carrier_documents (carrier_id);

create table public.trucks (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z0-9 ]{4,12}$'),
  truck_type text not null check (truck_type in ('pickup', 'canter', 'lorry_7t', 'lorry_10t', 'lorry_14t', 'trailer', 'tipper', 'tanker', 'reefer', 'lowbed')),
  capacity_tonnes numeric(5, 1) not null check (capacity_tonnes > 0 and capacity_tonnes <= 80),
  make_model text check (char_length(make_model) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index trucks_plate on public.trucks (upper(replace(plate, ' ', '')));
create index trucks_carrier on public.trucks (carrier_id);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^254[17][0-9]{8}$'),
  licence_no text check (char_length(licence_no) <= 30),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index drivers_carrier on public.drivers (carrier_id);

-- ---------------------------------------------------------------------------------------------
-- Places, loads and bids
-- ---------------------------------------------------------------------------------------------

create table public.places (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  lat double precision not null,
  lng double precision not null,
  is_border boolean not null default false
);

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('VM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  shipper_id uuid not null references public.profiles (id) on delete cascade,
  origin_id text not null references public.places (id),
  origin_detail text check (char_length(origin_detail) <= 200),
  destination_id text not null references public.places (id),
  destination_detail text check (char_length(destination_detail) <= 200),
  pickup_date date not null,
  cargo_type text not null check (cargo_type in ('general', 'fmcg', 'construction', 'agricultural', 'container', 'machinery', 'furniture', 'fuel_liquid', 'cold_chain', 'livestock_feed', 'other')),
  cargo_description text not null check (char_length(cargo_description) between 3 and 500),
  weight_tonnes numeric(6, 2) not null check (weight_tonnes > 0 and weight_tonnes <= 60),
  truck_type text not null check (truck_type in ('pickup', 'canter', 'lorry_7t', 'lorry_10t', 'lorry_14t', 'trailer', 'tipper', 'tanker', 'reefer', 'lowbed')),
  distance_km integer not null check (distance_km > 0),
  border_crossings integer not null default 0 check (border_crossings between 0 and 6),
  guide_price integer not null check (guide_price > 0),
  price integer not null check (price >= 1000 and price <= 20000000),
  currency text not null default 'KES' check (currency = 'KES'),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'booked', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_id <> destination_id)
);
create index loads_board on public.loads (status, pickup_date);
create index loads_shipper on public.loads (shipper_id, created_at desc);

-- Phone numbers at pickup and drop-off are only for the shipper and the booked carrier.
create table public.load_contacts (
  load_id uuid primary key references public.loads (id) on delete cascade,
  pickup_name text check (char_length(pickup_name) <= 120),
  pickup_phone text check (pickup_phone is null or pickup_phone ~ '^254[17][0-9]{8}$'),
  dropoff_name text check (char_length(dropoff_name) <= 120),
  dropoff_phone text check (dropoff_phone is null or dropoff_phone ~ '^254[17][0-9]{8}$')
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  amount integer not null check (amount >= 1000 and amount <= 20000000),
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  closed_by_trip uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (load_id, carrier_id)
);
create index bids_carrier on public.bids (carrier_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Trips, tracking, money
-- ---------------------------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  load_id uuid not null references public.loads (id) on delete cascade,
  bid_id uuid not null references public.bids (id),
  shipper_id uuid not null references public.profiles (id),
  carrier_id uuid not null references public.carriers (id),
  price integer not null check (price > 0),
  commission_bps integer not null,
  commission integer not null check (commission >= 0),
  carrier_payout integer not null check (carrier_payout >= 0),
  truck_id uuid references public.trucks (id),
  driver_id uuid references public.drivers (id),
  driver_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'scheduled', 'to_pickup', 'loaded', 'in_transit', 'at_border', 'delivered', 'completed', 'disputed', 'cancelled')),
  amount_paid integer not null default 0,
  paid_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  pod_path text,
  dispute_reason text check (char_length(dispute_reason) <= 1000),
  cancel_reason text check (char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission + carrier_payout = price)
);
-- One live trip per load; a cancelled booking lets the load be booked again.
create unique index trips_one_live_per_load on public.trips (load_id) where status <> 'cancelled';
create index trips_shipper on public.trips (shipper_id, created_at desc);
create index trips_carrier on public.trips (carrier_id, created_at desc);
create index trips_status on public.trips (status);

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  status text not null,
  note text check (char_length(note) <= 500),
  actor text not null check (actor in ('shipper', 'carrier', 'driver', 'admin', 'system')),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index trip_events_trip on public.trip_events (trip_id, created_at);

create table public.trip_locations (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m integer,
  recorded_at timestamptz not null default now()
);
create index trip_locations_trip on public.trip_locations (trip_id, recorded_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  shipper_id uuid not null references public.profiles (id),
  method text not null check (method in ('mpesa', 'bank')),
  amount integer not null check (amount > 0),
  phone text,
  checkout_request_id text unique,
  merchant_request_id text,
  receipt text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  result_description text,
  raw jsonb,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_trip on public.payments (trip_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  carrier_id uuid not null references public.carriers (id),
  amount integer not null check (amount >= 0),
  phone text,
  status text not null default 'queued' check (status in ('queued', 'paid', 'held')),
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payouts_carrier on public.payouts (carrier_id, created_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  stars integer not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (trip_id, rater_id)
);

-- ---------------------------------------------------------------------------------------------
-- Helpers (private schema: not reachable through the API)
-- ---------------------------------------------------------------------------------------------

create function private.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create function private.is_verified_carrier() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.carriers where id = auth.uid() and status = 'verified')
$$;

create function private.trip_party(p_trip uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip and (t.shipper_id = auth.uid() or t.carrier_id = auth.uid()))
$$;

create function private.load_visible(p_load uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.loads l
    where l.id = p_load and (
      l.shipper_id = auth.uid()
      or (l.status = 'open' and exists (select 1 from public.carriers c where c.id = auth.uid() and c.status = 'verified'))
      or exists (select 1 from public.bids b where b.load_id = l.id and b.carrier_id = auth.uid())
    )
  )
$$;

-- The two sides of a paid trip can see each other's name and phone. Before that, a shipper sees only the
-- carrier's business name and rating, so nobody can take the deal off Vemi before it is paid.
create function private.counterparty(p_other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t
    where t.status not in ('awaiting_payment', 'cancelled')
      and ((t.shipper_id = auth.uid() and t.carrier_id = p_other) or (t.carrier_id = auth.uid() and t.shipper_id = p_other)))
$$;

create function private.commission_bps_for(p_carrier uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    c.commission_bps,
    case when c.founding_until > now() then s.founding_commission_bps else s.commission_bps end
  )
  from public.carriers c cross join public.platform_settings s where c.id = p_carrier
$$;

create function private.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger loads_touch before update on public.loads for each row execute function private.touch_updated_at();
create trigger bids_touch before update on public.bids for each row execute function private.touch_updated_at();
create trigger trips_touch before update on public.trips for each row execute function private.touch_updated_at();
create trigger carrier_private_touch before update on public.carrier_private for each row execute function private.touch_updated_at();

-- A new account gets a profile. Only "shipper" or "carrier" can be chosen at sign-up; admins are made by hand.
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, phone, company)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'carrier' then 'carrier' else 'shipper' end,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when coalesce(new.raw_user_meta_data ->> 'phone', '') ~ '^\+?[0-9]{9,15}$' then new.raw_user_meta_data ->> 'phone' end,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'company', ''), 160), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create function private.log_event(p_trip uuid, p_status text, p_actor text, p_note text default null, p_lat double precision default null, p_lng double precision default null)
returns void language sql security definer set search_path = public as $$
  insert into public.trip_events (trip_id, status, actor, note, lat, lng) values (p_trip, p_status, p_actor, nullif(trim(p_note), ''), p_lat, p_lng)
$$;

-- Moves a trip forward one step. Shared by the carrier, the driver link and admins.
create function private.advance_trip(p_trip uuid, p_status text, p_actor text, p_note text, p_lat double precision, p_lng double precision)
returns public.trips language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_allowed text[];
begin
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found.'; end if;
  v_allowed := case t.status
    when 'scheduled' then array['to_pickup']
    when 'to_pickup' then array['loaded']
    when 'loaded' then array['in_transit']
    when 'in_transit' then array['at_border', 'delivered']
    when 'at_border' then array['in_transit', 'delivered']
    else array[]::text[]
  end;
  if t.status = 'awaiting_payment' then raise exception 'This trip is not paid yet. Wait for the shipper''s payment before moving.'; end if;
  if not (p_status = any (v_allowed)) then raise exception 'A trip that is % cannot move to %.', t.status, p_status; end if;
  if p_status = 'to_pickup' and (t.truck_id is null or t.driver_id is null) then raise exception 'Assign a truck and a driver first.'; end if;
  update public.trips set
    status = p_status,
    picked_up_at = case when p_status = 'loaded' then now() else picked_up_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_trip returning * into t;
  perform private.log_event(p_trip, p_status, p_actor, p_note, p_lat, p_lng);
  if p_lat is not null and p_lng is not null then
    insert into public.trip_locations (trip_id, lat, lng) values (p_trip, p_lat, p_lng);
  end if;
  return t;
end $$;

-- Delivery accepted (by the shipper, an admin, or the clock): the carrier's payout is queued.
create function private.complete_trip(p_trip uuid, p_actor text, p_note text) returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips set status = 'completed', completed_at = now() where id = p_trip and status in ('delivered', 'disputed') returning * into t;
  if not found then raise exception 'Only a delivered trip can be confirmed.'; end if;
  insert into public.payouts (trip_id, carrier_id, amount, phone)
  values (t.id, t.carrier_id, t.carrier_payout, (select payout_phone from public.carrier_private where carrier_id = t.carrier_id))
  on conflict (trip_id) do update set status = case when public.payouts.status = 'held' then 'queued' else public.payouts.status end;
  perform private.log_event(p_trip, 'completed', p_actor, p_note);
  return t;
end $$;

-- ---------------------------------------------------------------------------------------------
-- API functions (each checks who is calling)
-- ---------------------------------------------------------------------------------------------

-- Carrier: send or change a bid on an open load.
create function public.place_bid(p_load uuid, p_amount integer, p_note text default null) returns public.bids
language plpgsql security definer set search_path = public as $$
declare
  l public.loads;
  b public.bids;
begin
  if not private.is_verified_carrier() then raise exception 'Only verified carriers can bid. Finish your carrier profile and wait for Vemi to verify it.'; end if;
  select * into l from public.loads where id = p_load for update;
  if not found or l.status <> 'open' then raise exception 'This load is no longer open for bids.'; end if;
  if l.shipper_id = auth.uid() then raise exception 'You cannot bid on your own load.'; end if;
  if p_amount is null or p_amount < 1000 then raise exception 'Enter a bid of at least KES 1,000.'; end if;
  insert into public.bids (load_id, carrier_id, amount, note)
  values (p_load, auth.uid(), p_amount, nullif(trim(p_note), ''))
  on conflict (load_id, carrier_id) do update set amount = excluded.amount, note = excluded.note, status = 'pending', closed_by_trip = null
  where public.bids.status in ('pending', 'withdrawn', 'declined')
  returning * into b;
  if b.id is null then raise exception 'Your bid on this load can no longer be changed.'; end if;
  return b;
end $$;

create function public.withdraw_bid(p_bid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bids set status = 'withdrawn' where id = p_bid and carrier_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Only a pending bid of yours can be withdrawn.'; end if;
end $$;

-- Shipper: book one bid. Other bids close, the load is booked and a trip waits for payment.
create function public.accept_bid(p_bid uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.bids;
  l public.loads;
  t public.trips;
  v_bps integer;
  v_commission integer;
begin
  select * into b from public.bids where id = p_bid for update;
  if not found then raise exception 'Bid not found.'; end if;
  select * into l from public.loads where id = b.load_id for update;
  if l.shipper_id is distinct from auth.uid() then raise exception 'Only the shipper who posted this load can book it.'; end if;
  if l.status <> 'open' then raise exception 'This load is already booked or closed.'; end if;
  if b.status <> 'pending' then raise exception 'This bid is no longer available.'; end if;
  if not exists (select 1 from public.carriers where id = b.carrier_id and status = 'verified') then raise exception 'This carrier is not verified any more. Choose another bid.'; end if;

  v_bps := private.commission_bps_for(b.carrier_id);
  v_commission := round(b.amount * v_bps / 10000.0)::integer;
  insert into public.trips (ref, load_id, bid_id, shipper_id, carrier_id, price, commission_bps, commission, carrier_payout)
  values (
    l.ref || case when exists (select 1 from public.trips where load_id = l.id) then '-' || (select count(*) + 1 from public.trips where load_id = l.id) else '' end,
    l.id, b.id, l.shipper_id, b.carrier_id, b.amount, v_bps, v_commission, b.amount - v_commission
  ) returning * into t;
  update public.bids set status = 'accepted', closed_by_trip = t.id where id = b.id;
  update public.bids set status = 'declined', closed_by_trip = t.id where load_id = l.id and id <> b.id and status = 'pending';
  update public.loads set status = 'booked' where id = l.id;
  perform private.log_event(t.id, 'awaiting_payment', 'shipper', 'Booked at KES ' || to_char(b.amount, 'FM999,999,999'));
  return t.id;
end $$;

-- Shipper: cancel a booking that is not paid yet. The load opens again and the other bids come back.
create function public.cancel_booking(p_trip uuid, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.shipper_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status <> 'awaiting_payment' or t.amount_paid > 0 then raise exception 'A paid trip can only be cancelled by Vemi support. Call or WhatsApp us.'; end if;
  update public.trips set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = p_trip;
  update public.bids set status = 'declined' where id = t.bid_id;
  update public.bids set status = 'pending', closed_by_trip = null where load_id = t.load_id and closed_by_trip = t.id and id <> t.bid_id;
  update public.loads set status = 'open' where id = t.load_id;
  perform private.log_event(p_trip, 'cancelled', 'shipper', p_reason);
end $$;

-- Shipper: take a load off the board.
create function public.cancel_load(p_load uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.loads set status = 'cancelled' where id = p_load and shipper_id = auth.uid() and status = 'open';
  if not found then raise exception 'Only an open load of yours can be cancelled.'; end if;
  update public.bids set status = 'declined' where load_id = p_load and status = 'pending';
end $$;

-- Carrier: choose the truck and driver for a trip (also used to swap them before pickup).
create function public.assign_trip(p_trip uuid, p_truck uuid, p_driver uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status not in ('awaiting_payment', 'scheduled', 'to_pickup') then raise exception 'The truck and driver cannot be changed after loading.'; end if;
  if not exists (select 1 from public.trucks where id = p_truck and carrier_id = auth.uid() and active) then raise exception 'Choose one of your active trucks.'; end if;
  if not exists (select 1 from public.drivers where id = p_driver and carrier_id = auth.uid() and active) then raise exception 'Choose one of your active drivers.'; end if;
  update public.trips set truck_id = p_truck, driver_id = p_driver where id = p_trip returning * into t;
  perform private.log_event(p_trip, t.status, 'carrier', 'Truck and driver assigned');
end $$;

-- Carrier: move the trip forward (the driver does the same through their link).
create function public.carrier_update_trip(p_trip uuid, p_status text, p_note text default null, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and carrier_id = auth.uid()) then raise exception 'Trip not found.'; end if;
  perform private.advance_trip(p_trip, p_status, 'carrier', p_note, p_lat, p_lng);
end $$;

-- Carrier: the secret part of the driver's trip link.
create function public.trip_driver_token(p_trip uuid) returns text language sql stable security definer set search_path = public as $$
  select driver_token from public.trips where id = p_trip and (carrier_id = auth.uid() or private.is_admin())
$$;

-- Shipper: accept the delivery.
create function public.confirm_delivery(p_trip uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and shipper_id = auth.uid() and status = 'delivered') then raise exception 'Only a delivered trip of yours can be confirmed.'; end if;
  perform private.complete_trip(p_trip, 'shipper', 'Delivery confirmed by the shipper');
end $$;

-- Shipper: something is wrong with the delivery. The payout is held until Vemi resolves it.
create function public.raise_dispute(p_trip uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Tell us what went wrong (at least 10 characters).'; end if;
  update public.trips set status = 'disputed', dispute_reason = trim(p_reason) where id = p_trip and shipper_id = auth.uid() and status = 'delivered';
  if not found then raise exception 'Only a delivered trip of yours can be disputed, before it is confirmed.'; end if;
  perform private.log_event(p_trip, 'disputed', 'shipper', p_reason);
end $$;

-- Either side: rate the other after a completed trip.
create function public.rate_trip(p_trip uuid, p_stars integer, p_comment text default null) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_ratee uuid;
begin
  select * into t from public.trips where id = p_trip;
  if not found or auth.uid() not in (t.shipper_id, t.carrier_id) then raise exception 'Trip not found.'; end if;
  if t.status <> 'completed' then raise exception 'You can rate a trip once it is completed.'; end if;
  v_ratee := case when auth.uid() = t.shipper_id then t.carrier_id else t.shipper_id end;
  insert into public.ratings (trip_id, rater_id, ratee_id, stars, comment) values (p_trip, auth.uid(), v_ratee, p_stars, nullif(trim(p_comment), ''))
  on conflict (trip_id, rater_id) do update set stars = excluded.stars, comment = excluded.comment;
  update public.profiles p set rating_avg = r.avg, rating_count = r.n
  from (select round(avg(stars)::numeric, 2) as avg, count(*)::integer as n from public.ratings where ratee_id = v_ratee) r
  where p.id = v_ratee;
  update public.carriers c set rating_avg = p.rating_avg, rating_count = p.rating_count from public.profiles p where c.id = v_ratee and p.id = v_ratee;
end $$;

-- Service role (payment callback): record an M-Pesa payment and release the trip once fully paid.
create function public.apply_mpesa_payment(p_checkout_request_id text, p_receipt text, p_amount integer, p_raw jsonb)
returns public.trips language plpgsql security definer set search_path = public as $$
declare
  p public.payments;
  t public.trips;
begin
  update public.payments set status = 'paid', receipt = coalesce(p_receipt, receipt), raw = coalesce(p_raw, raw), paid_at = now(), amount = coalesce(nullif(p_amount, 0), amount)
  where checkout_request_id = p_checkout_request_id and status = 'pending' returning * into p;
  if not found then
    select t2.* into t from public.trips t2 join public.payments p2 on p2.trip_id = t2.id where p2.checkout_request_id = p_checkout_request_id;
    return t;
  end if;
  return private.apply_payment(p.trip_id, p.amount, 'M-Pesa ' || coalesce(p_receipt, ''));
end $$;

create function private.apply_payment(p_trip uuid, p_amount integer, p_note text) returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips set amount_paid = amount_paid + p_amount where id = p_trip returning * into t;
  perform private.log_event(p_trip, t.status, 'system', 'Payment received: KES ' || to_char(p_amount, 'FM999,999,999') || ' (' || p_note || ')');
  if t.status = 'awaiting_payment' and t.amount_paid >= t.price then
    update public.trips set status = 'scheduled', paid_at = now() where id = p_trip returning * into t;
    perform private.log_event(p_trip, 'scheduled', 'system', 'Paid in full. The carrier can dispatch.');
  end if;
  return t;
end $$;

-- Service role (status check): mark a pending M-Pesa prompt as failed.
create function public.fail_mpesa_payment(p_checkout_request_id text, p_description text, p_raw jsonb) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'failed', result_description = left(p_description, 300), raw = coalesce(p_raw, raw)
  where checkout_request_id = p_checkout_request_id and status = 'pending'
$$;

-- Service role (driver link): status updates, location pings, proof of delivery.
create function public.driver_update_trip(p_token text, p_status text, p_note text default null, p_lat double precision default null, p_lng double precision default null)
returns public.trips language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select id into v_trip from public.trips where driver_token = p_token;
  if v_trip is null then raise exception 'This trip link is not valid.'; end if;
  return private.advance_trip(v_trip, p_status, 'driver', p_note, p_lat, p_lng);
end $$;

create function public.driver_ping(p_token text, p_lat double precision, p_lng double precision, p_accuracy integer default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select id into v_trip from public.trips where driver_token = p_token and status in ('to_pickup', 'loaded', 'in_transit', 'at_border');
  if v_trip is null then return false; end if;
  -- At most one point a minute per trip keeps the table small on long journeys.
  if exists (select 1 from public.trip_locations where trip_id = v_trip and recorded_at > now() - interval '55 seconds') then return false; end if;
  insert into public.trip_locations (trip_id, lat, lng, accuracy_m) values (v_trip, p_lat, p_lng, p_accuracy);
  return true;
end $$;

create function public.driver_attach_pod(p_token text, p_path text) returns void language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  update public.trips set pod_path = p_path where driver_token = p_token and status in ('in_transit', 'at_border', 'delivered') returning id into v_trip;
  if v_trip is null then raise exception 'A delivery photo can be added once the goods are on the road.'; end if;
  perform private.log_event(v_trip, (select status from public.trips where id = v_trip), 'driver', 'Proof of delivery photo uploaded');
end $$;

-- Admin: verification, bank payments, disputes, cancellations, payouts.
create function public.admin_review_carrier(p_carrier uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s public.platform_settings;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('verified', 'rejected', 'suspended', 'pending') then raise exception 'Unknown status.'; end if;
  select * into s from public.platform_settings;
  update public.carriers set
    status = p_status,
    review_note = nullif(trim(p_note), ''),
    verified_at = case when p_status = 'verified' then coalesce(verified_at, now()) else verified_at end,
    -- The first carriers to be verified get the founding commission for a while.
    founding_until = case
      when p_status = 'verified' and founding_until is null and verified_at is null
        and (select count(*) from public.carriers where founding_until is not null) < s.founding_slots
      then now() + make_interval(days => s.founding_days)
      else founding_until end
  where id = p_carrier;
  if not found then raise exception 'Carrier not found.'; end if;
end $$;

create function public.admin_record_bank_payment(p_trip uuid, p_amount integer, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  select * into t from public.trips where id = p_trip;
  if not found or t.status = 'cancelled' then raise exception 'Trip not found.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter the amount received.'; end if;
  insert into public.payments (trip_id, shipper_id, method, amount, receipt, status, recorded_by, paid_at)
  values (p_trip, t.shipper_id, 'bank', p_amount, nullif(trim(p_reference), ''), 'paid', auth.uid(), now());
  perform private.apply_payment(p_trip, p_amount, 'bank ' || coalesce(p_reference, ''));
end $$;

create function public.admin_resolve_dispute(p_trip uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if not exists (select 1 from public.trips where id = p_trip and status = 'disputed') then raise exception 'This trip is not in dispute.'; end if;
  if p_outcome = 'pay_carrier' then
    perform private.complete_trip(p_trip, 'admin', coalesce(p_note, 'Dispute resolved: carrier paid'));
  elsif p_outcome = 'hold' then
    insert into public.payouts (trip_id, carrier_id, amount, phone, status)
    select t.id, t.carrier_id, t.carrier_payout, cp.payout_phone, 'held' from public.trips t left join public.carrier_private cp on cp.carrier_id = t.carrier_id where t.id = p_trip
    on conflict (trip_id) do update set status = 'held';
    perform private.log_event(p_trip, 'disputed', 'admin', coalesce(p_note, 'Payout held while Vemi investigates'));
  else
    raise exception 'Unknown outcome.';
  end if;
end $$;

create function public.admin_cancel_trip(p_trip uuid, p_reason text, p_reopen_load boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  update public.trips set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = p_trip and status not in ('completed', 'cancelled') returning * into t;
  if not found then raise exception 'Only an open trip can be cancelled.'; end if;
  update public.bids set status = 'declined' where id = t.bid_id;
  if p_reopen_load then
    update public.loads set status = 'open' where id = t.load_id and pickup_date >= current_date;
    update public.bids set status = 'pending', closed_by_trip = null where load_id = t.load_id and closed_by_trip = t.id and id <> t.bid_id;
  end if;
  perform private.log_event(p_trip, 'cancelled', 'admin', p_reason);
end $$;

create function public.admin_mark_payouts_paid(p_ids uuid[], p_reference text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'Enter the M-Pesa or bank reference for this batch.'; end if;
  update public.payouts set status = 'paid', reference = trim(p_reference), paid_at = now() where id = any (p_ids) and status = 'queued';
  get diagnostics v = row_count;
  return v;
end $$;

-- Daily job (service role): accept deliveries nobody confirmed, expire stale loads.
create function public.run_daily_jobs() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hours integer;
  v_completed integer := 0;
  v_expired integer;
  r record;
begin
  select auto_confirm_hours into v_hours from public.platform_settings;
  for r in select id from public.trips where status = 'delivered' and delivered_at < now() - make_interval(hours => v_hours) loop
    perform private.complete_trip(r.id, 'system', 'Confirmed automatically: no reply from the shipper within ' || v_hours || ' hours');
    v_completed := v_completed + 1;
  end loop;
  update public.loads set status = 'expired' where status = 'open' and pickup_date < current_date - 3;
  get diagnostics v_expired = row_count;
  update public.bids b set status = 'declined' from public.loads l where l.id = b.load_id and l.status = 'expired' and b.status = 'pending';
  return jsonb_build_object('auto_confirmed', v_completed, 'expired_loads', v_expired);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.carriers enable row level security;
alter table public.carrier_private enable row level security;
alter table public.carrier_documents enable row level security;
alter table public.trucks enable row level security;
alter table public.drivers enable row level security;
alter table public.places enable row level security;
alter table public.loads enable row level security;
alter table public.load_contacts enable row level security;
alter table public.bids enable row level security;
alter table public.trips enable row level security;
alter table public.trip_events enable row level security;
alter table public.trip_locations enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.ratings enable row level security;

-- Start from nothing, then grant only what the app uses.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(), private.is_verified_carrier(), private.trip_party(uuid), private.load_visible(uuid), private.counterparty(uuid) to authenticated;

grant select on public.places to anon, authenticated;
create policy places_read on public.places for select using (true);

grant select on public.platform_settings to authenticated;
create policy settings_read on public.platform_settings for select to authenticated using (true);

grant select on public.profiles to authenticated;
grant update (full_name, phone, company) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin() or private.counterparty(id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on public.carriers to authenticated;
grant insert (id, business_name, base_town, cross_border, countries) on public.carriers to authenticated;
grant update (business_name, base_town, cross_border, countries) on public.carriers to authenticated;
create policy carriers_read on public.carriers for select to authenticated using (id = auth.uid() or status = 'verified' or private.is_admin());
create policy carriers_insert on public.carriers for insert to authenticated with check (
  id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'carrier'));
create policy carriers_update on public.carriers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.carrier_private to authenticated;
create policy carrier_private_own on public.carrier_private for all to authenticated
  using (carrier_id = auth.uid() or private.is_admin()) with check (carrier_id = auth.uid());

grant select, delete on public.carrier_documents to authenticated;
create policy carrier_documents_read on public.carrier_documents for select to authenticated using (carrier_id = auth.uid() or private.is_admin());
create policy carrier_documents_delete on public.carrier_documents for delete to authenticated using (carrier_id = auth.uid());

grant select on public.trucks to authenticated;
grant insert (carrier_id, plate, truck_type, capacity_tonnes, make_model) on public.trucks to authenticated;
grant update (plate, truck_type, capacity_tonnes, make_model, active) on public.trucks to authenticated;
create policy trucks_read on public.trucks for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.trips t where t.truck_id = trucks.id and t.shipper_id = auth.uid()));
create policy trucks_insert on public.trucks for insert to authenticated with check (carrier_id = auth.uid());
create policy trucks_update on public.trucks for update to authenticated using (carrier_id = auth.uid()) with check (carrier_id = auth.uid());

grant select on public.drivers to authenticated;
grant insert (carrier_id, full_name, phone, licence_no) on public.drivers to authenticated;
grant update (full_name, phone, licence_no, active) on public.drivers to authenticated;
create policy drivers_read on public.drivers for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.trips t where t.driver_id = drivers.id and t.shipper_id = auth.uid() and t.status not in ('awaiting_payment', 'completed', 'cancelled')));
create policy drivers_insert on public.drivers for insert to authenticated with check (carrier_id = auth.uid());
create policy drivers_update on public.drivers for update to authenticated using (carrier_id = auth.uid()) with check (carrier_id = auth.uid());

grant select on public.loads to authenticated;
grant insert (shipper_id, origin_id, origin_detail, destination_id, destination_detail, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, border_crossings, guide_price, price, notes) on public.loads to authenticated;
grant update (origin_detail, destination_detail, pickup_date, cargo_description, price, notes) on public.loads to authenticated;
-- The direct shipper check comes first: a new row is not yet visible to the helper during insert ... returning.
create policy loads_read on public.loads for select to authenticated using (shipper_id = auth.uid() or private.load_visible(id) or private.is_admin());
create policy loads_insert on public.loads for insert to authenticated with check (shipper_id = auth.uid() and pickup_date >= current_date - 1);
create policy loads_update on public.loads for update to authenticated using (shipper_id = auth.uid() and status = 'open') with check (shipper_id = auth.uid());

grant select, insert, update on public.load_contacts to authenticated;
create policy load_contacts_read on public.load_contacts for select to authenticated using (
  private.is_admin()
  or exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = auth.uid())
  or exists (select 1 from public.trips t where t.load_id = load_contacts.load_id and t.carrier_id = auth.uid() and t.status not in ('cancelled', 'awaiting_payment')));
create policy load_contacts_write on public.load_contacts for insert to authenticated with check (exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = auth.uid()));
create policy load_contacts_update on public.load_contacts for update to authenticated using (exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = auth.uid()));

grant select on public.bids to authenticated;
create policy bids_read on public.bids for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = auth.uid()));

grant select (id, ref, load_id, bid_id, shipper_id, carrier_id, price, commission_bps, commission, carrier_payout, truck_id, driver_id, status, amount_paid,
  paid_at, picked_up_at, delivered_at, completed_at, pod_path, dispute_reason, cancel_reason, created_at, updated_at) on public.trips to authenticated;
create policy trips_read on public.trips for select to authenticated using (shipper_id = auth.uid() or carrier_id = auth.uid() or private.is_admin());

grant select on public.trip_events, public.trip_locations to authenticated;
create policy trip_events_read on public.trip_events for select to authenticated using (private.trip_party(trip_id) or private.is_admin());
create policy trip_locations_read on public.trip_locations for select to authenticated using (private.trip_party(trip_id) or private.is_admin());

grant select (id, trip_id, shipper_id, method, amount, phone, receipt, status, result_description, created_at, paid_at) on public.payments to authenticated;
create policy payments_read on public.payments for select to authenticated using (shipper_id = auth.uid() or private.is_admin());

grant select on public.payouts to authenticated;
create policy payouts_read on public.payouts for select to authenticated using (carrier_id = auth.uid() or private.is_admin());

grant select on public.ratings to authenticated;
create policy ratings_read on public.ratings for select to authenticated using (rater_id = auth.uid() or ratee_id = auth.uid() or private.is_admin());

grant execute on function
  public.place_bid(uuid, integer, text), public.withdraw_bid(uuid), public.accept_bid(uuid), public.cancel_booking(uuid, text),
  public.cancel_load(uuid), public.assign_trip(uuid, uuid, uuid), public.carrier_update_trip(uuid, text, text, double precision, double precision),
  public.trip_driver_token(uuid), public.confirm_delivery(uuid), public.raise_dispute(uuid, text), public.rate_trip(uuid, integer, text),
  public.admin_review_carrier(uuid, text, text), public.admin_record_bank_payment(uuid, integer, text), public.admin_resolve_dispute(uuid, text, text),
  public.admin_cancel_trip(uuid, text, boolean), public.admin_mark_payouts_paid(uuid[], text)
to authenticated;

revoke execute on function public.apply_mpesa_payment(text, text, integer, jsonb), public.fail_mpesa_payment(text, text, jsonb),
  public.driver_update_trip(text, text, text, double precision, double precision), public.driver_ping(text, double precision, double precision, integer),
  public.driver_attach_pod(text, text), public.run_daily_jobs() from authenticated;
grant execute on function public.apply_mpesa_payment(text, text, integer, jsonb), public.fail_mpesa_payment(text, text, jsonb),
  public.driver_update_trip(text, text, text, double precision, double precision), public.driver_ping(text, double precision, double precision, integer),
  public.driver_attach_pod(text, text), public.run_daily_jobs() to service_role;

-- New functions and tables are closed to the API until granted on purpose.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Storage: private buckets. The app reads and writes them on the server after checking access,
-- and hands out short-lived signed links, so there are no storage policies for the API roles.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('carrier-docs', 'carrier-docs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('pod', 'pod', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Towns, ports and border posts on the Northern and Central corridors and beyond.
-- ---------------------------------------------------------------------------------------------

insert into public.places (id, name, country, lat, lng, is_border) values
  ('mombasa', 'Mombasa', 'KE', -4.0435, 39.6682, false),
  ('nairobi', 'Nairobi', 'KE', -1.2921, 36.8219, false),
  ('athi-river', 'Athi River / Mlolongo', 'KE', -1.4560, 36.9780, false),
  ('thika', 'Thika', 'KE', -1.0388, 37.0834, false),
  ('machakos', 'Machakos', 'KE', -1.5177, 37.2634, false),
  ('voi', 'Voi', 'KE', -3.3961, 38.5561, false),
  ('malindi', 'Malindi', 'KE', -3.2192, 40.1169, false),
  ('lamu', 'Lamu', 'KE', -2.2717, 40.9020, false),
  ('naivasha', 'Naivasha', 'KE', -0.7172, 36.4310, false),
  ('nakuru', 'Nakuru', 'KE', -0.3031, 36.0800, false),
  ('eldoret', 'Eldoret', 'KE', 0.5143, 35.2698, false),
  ('kisumu', 'Kisumu', 'KE', -0.0917, 34.7680, false),
  ('kericho', 'Kericho', 'KE', -0.3677, 35.2831, false),
  ('kisii', 'Kisii', 'KE', -0.6817, 34.7660, false),
  ('kitale', 'Kitale', 'KE', 1.0157, 35.0062, false),
  ('bungoma', 'Bungoma', 'KE', 0.5635, 34.5606, false),
  ('nyeri', 'Nyeri', 'KE', -0.4201, 36.9476, false),
  ('meru', 'Meru', 'KE', 0.0463, 37.6559, false),
  ('embu', 'Embu', 'KE', -0.5389, 37.4596, false),
  ('isiolo', 'Isiolo', 'KE', 0.3546, 37.5822, false),
  ('garissa', 'Garissa', 'KE', -0.4532, 39.6461, false),
  ('lodwar', 'Lodwar', 'KE', 3.1191, 35.5973, false),
  ('malaba', 'Malaba border (KE/UG)', 'KE', 0.6340, 34.2830, true),
  ('busia', 'Busia border (KE/UG)', 'KE', 0.4600, 34.1110, true),
  ('namanga', 'Namanga border (KE/TZ)', 'KE', -2.5450, 36.7920, true),
  ('taveta', 'Taveta / Holili border (KE/TZ)', 'KE', -3.3980, 37.6750, true),
  ('lunga-lunga', 'Lunga Lunga / Horohoro border (KE/TZ)', 'KE', -4.5550, 39.1230, true),
  ('isebania', 'Isebania / Sirari border (KE/TZ)', 'KE', -1.2330, 34.4780, true),
  ('moyale', 'Moyale border (KE/ET)', 'KE', 3.5167, 39.0584, true),
  ('lokichogio', 'Lokichogio / Nadapal border (KE/SS)', 'KE', 4.2041, 34.3482, true),
  ('kampala', 'Kampala', 'UG', 0.3476, 32.5825, false),
  ('jinja', 'Jinja', 'UG', 0.4479, 33.2026, false),
  ('tororo', 'Tororo', 'UG', 0.6928, 34.1808, false),
  ('mbarara', 'Mbarara', 'UG', -0.6072, 30.6545, false),
  ('gulu', 'Gulu', 'UG', 2.7724, 32.2881, false),
  ('kasese', 'Kasese', 'UG', 0.1830, 30.0830, false),
  ('elegu', 'Elegu / Nimule border (UG/SS)', 'UG', 3.5800, 32.0500, true),
  ('katuna', 'Katuna / Gatuna border (UG/RW)', 'UG', -1.4220, 30.0130, true),
  ('mutukula', 'Mutukula border (UG/TZ)', 'UG', -1.0000, 31.4170, true),
  ('kigali', 'Kigali', 'RW', -1.9441, 30.0619, false),
  ('rusumo', 'Rusumo border (RW/TZ)', 'RW', -2.3800, 30.7830, true),
  ('rubavu', 'Rubavu / Gisenyi', 'RW', -1.7020, 29.2560, false),
  ('dar-es-salaam', 'Dar es Salaam', 'TZ', -6.7924, 39.2083, false),
  ('tanga', 'Tanga', 'TZ', -5.0689, 39.0988, false),
  ('arusha', 'Arusha', 'TZ', -3.3869, 36.6830, false),
  ('moshi', 'Moshi', 'TZ', -3.3349, 37.3404, false),
  ('morogoro', 'Morogoro', 'TZ', -6.8278, 37.6591, false),
  ('dodoma', 'Dodoma', 'TZ', -6.1630, 35.7516, false),
  ('isaka', 'Isaka dry port', 'TZ', -3.9000, 32.9333, false),
  ('mwanza', 'Mwanza', 'TZ', -2.5164, 32.9175, false),
  ('kigoma', 'Kigoma', 'TZ', -4.8769, 29.6267, false),
  ('mbeya', 'Mbeya', 'TZ', -8.9094, 33.4608, false),
  ('tunduma', 'Tunduma border (TZ/ZM)', 'TZ', -9.3000, 32.7670, true),
  ('bujumbura', 'Bujumbura', 'BI', -3.3614, 29.3599, false),
  ('juba', 'Juba', 'SS', 4.8594, 31.5713, false),
  ('goma', 'Goma', 'CD', -1.6585, 29.2205, false),
  ('bukavu', 'Bukavu', 'CD', -2.5083, 28.8608, false),
  ('lubumbashi', 'Lubumbashi', 'CD', -11.6609, 27.4794, false),
  ('addis-ababa', 'Addis Ababa', 'ET', 9.0300, 38.7400, false),
  ('lusaka', 'Lusaka', 'ZM', -15.3875, 28.3228, false)
on conflict (id) do nothing;
