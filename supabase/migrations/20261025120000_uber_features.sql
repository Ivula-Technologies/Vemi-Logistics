-- Vemi Logistics: the Uber and Uber Freight features (see docs/UBER-FEATURES.md).
-- Instant booking, trucks online, busy-lane pricing, multi-stop loads, saved places, favourites,
-- promo and referral codes, a wallet, tips, cancellation fees, waiting-time and extra charges,
-- fuel advances, cargo cover, business accounts with teams and credit, pickup and delivery codes,
-- tracking links, SOS and truck watch, trip chat, masked calls, push, phone sign-in, compliments,
-- damage claims and the ops tools behind them. Runs after 20261025090000_vemi_core.sql.

-- ---------------------------------------------------------------------------------------------
-- Settings ops can tune (Admin → Settings)
-- ---------------------------------------------------------------------------------------------

alter table public.platform_settings
  add column urgent_surcharge_bps integer not null default 1500 check (urgent_surcharge_bps between 0 and 10000),
  add column busy_lane_max_bps integer not null default 2000 check (busy_lane_max_bps between 0 and 10000),
  add column stop_fee_kes integer not null default 2000 check (stop_fee_kes between 0 and 100000),
  add column free_waiting_hours integer not null default 3 check (free_waiting_hours between 0 and 48),
  add column waiting_kes_per_hour integer not null default 1500 check (waiting_kes_per_hour between 0 and 100000),
  add column cancel_fee_bps integer not null default 1000 check (cancel_fee_bps between 0 and 10000),
  add column cancel_fee_min_kes integer not null default 2000 check (cancel_fee_min_kes >= 0),
  add column insurance_bps integer not null default 30 check (insurance_bps between 0 and 1000),
  add column insurance_min_kes integer not null default 500 check (insurance_min_kes >= 0),
  add column fuel_advance_max_bps integer not null default 3000 check (fuel_advance_max_bps between 0 and 8000),
  add column fuel_advance_fee_bps integer not null default 300 check (fuel_advance_fee_bps between 0 and 2000),
  add column referral_reward_kes integer not null default 1000 check (referral_reward_kes between 0 and 100000),
  add column referee_credit_kes integer not null default 1000 check (referee_credit_kes between 0 and 100000),
  add column usd_rate numeric(8, 2) not null default 129.00 check (usd_rate > 0);

-- ---------------------------------------------------------------------------------------------
-- People: referral codes, first-time setup for Google sign-ins, business accounts and teams
-- ---------------------------------------------------------------------------------------------

alter table public.profiles
  add column referral_code text unique check (referral_code ~ '^V[A-Z0-9]{6}$'),
  add column referred_by uuid references public.profiles (id) on delete set null,
  add column onboarded boolean not null default true;

create function private.eat_today() returns date language sql stable as $$
  select (now() at time zone 'Africa/Nairobi')::date
$$;

create function private.new_referral_code() returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
  b bytea;
begin
  loop
    b := extensions.gen_random_bytes(6);
    v := 'V';
    for i in 0..5 loop v := v || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.profiles where referral_code = v);
  end loop;
  return v;
end $$;

update public.profiles set referral_code = private.new_referral_code() where referral_code is null;

create table public.business_accounts (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  kra_pin text check (kra_pin is null or kra_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  billing_email text check (billing_email is null or billing_email ~ '^\S+@\S+\.\S+$'),
  billing_phone text check (billing_phone is null or billing_phone ~ '^254[17][0-9]{8}$'),
  credit_status text not null default 'none' check (credit_status in ('none', 'requested', 'approved', 'declined', 'suspended')),
  credit_limit integer not null default 0 check (credit_limit between 0 and 100000000),
  terms_days integer not null default 30 check (terms_days between 7 and 90),
  credit_note text check (char_length(credit_note) <= 500),
  requested_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.team_members (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  account_id uuid not null references public.business_accounts (owner_id) on delete cascade,
  role text not null default 'booker' check (role in ('admin', 'booker')),
  created_at timestamptz not null default now(),
  check (member_id <> account_id)
);
create index team_members_account on public.team_members (account_id);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.business_accounts (owner_id) on delete cascade,
  email text not null check (email ~ '^\S+@\S+\.\S+$'),
  role text not null default 'booker' check (role in ('admin', 'booker')),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);
create index team_invites_account on public.team_invites (account_id);

-- The shipper account a signed-in person books for: their own, or the business they were invited to.
create function private.shipper_account() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select account_id from public.team_members where member_id = auth.uid()), auth.uid())
$$;

create function private.is_account_admin(p_account uuid) returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = p_account or exists (select 1 from public.team_members where member_id = auth.uid() and account_id = p_account and role = 'admin')
$$;

-- People in the same business account can see each other's names.
create function private.same_account(p_other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_other = private.shipper_account()
    or exists (select 1 from public.team_members where member_id = p_other and account_id = private.shipper_account())
$$;

-- ---------------------------------------------------------------------------------------------
-- Carriers, trucks and drivers: photos, languages, availability, more documents
-- ---------------------------------------------------------------------------------------------

alter table public.carriers add column cancellations integer not null default 0 check (cancellations >= 0);
alter table public.trucks add column photo_path text;
alter table public.drivers
  add column photo_path text,
  add column language text not null default 'sw' check (language in ('en', 'sw'));

alter table public.carrier_documents drop constraint carrier_documents_kind_check;
alter table public.carrier_documents
  add constraint carrier_documents_kind_check check (kind in ('national_id', 'kra_pin', 'logbook', 'inspection', 'git_insurance', 'driving_licence', 'yellow_card', 'good_conduct', 'other')),
  add column driver_id uuid references public.drivers (id) on delete cascade,
  add column expiry_reminded_at timestamptz;

-- A truck that is free: where it is, from when, and where the carrier would like to go.
create table public.truck_availability (
  truck_id uuid primary key references public.trucks (id) on delete cascade,
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  place_id text not null references public.places (id),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  available_from date not null,
  heading_to text references public.places (id),
  note text check (char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index truck_availability_carrier on public.truck_availability (carrier_id);

-- ---------------------------------------------------------------------------------------------
-- Loads: instant booking, time window, map pins, favourites first, stops, cargo cover
-- ---------------------------------------------------------------------------------------------

alter table public.loads
  add column instant_book boolean not null default true,
  add column pickup_window text not null default 'anytime' check (pickup_window in ('anytime', 'morning', 'afternoon', 'evening')),
  add column origin_lat double precision check (origin_lat between -90 and 90),
  add column origin_lng double precision check (origin_lng between -180 and 180),
  add column destination_lat double precision check (destination_lat between -90 and 90),
  add column destination_lng double precision check (destination_lng between -180 and 180),
  add column favourites_until timestamptz,
  add column surge_bps integer not null default 0 check (surge_bps between 0 and 20000),
  add column stop_count integer not null default 0 check (stop_count between 0 and 5),
  add column declared_value integer check (declared_value is null or declared_value between 1000 and 100000000),
  add column insure boolean not null default false,
  add column require_codes boolean not null default true,
  add column copied_from uuid references public.loads (id) on delete set null,
  -- When carriers were told about the load (later for loads offered to favourites first).
  add column announced_at timestamptz,
  add constraint loads_insure_needs_value check (not insure or declared_value is not null);

-- Extra drop-offs (or pickups) on the way, in order. Their phone numbers live in load_contacts.stops.
create table public.load_stops (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  seq integer not null check (seq between 1 and 5),
  kind text not null default 'drop' check (kind in ('drop', 'pickup')),
  place_id text not null references public.places (id),
  detail text check (char_length(detail) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  done_at timestamptz,
  unique (load_id, seq)
);

alter table public.load_contacts add column stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array');

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  place_id text not null references public.places (id),
  detail text check (char_length(detail) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  contact_name text check (char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or contact_phone ~ '^254[17][0-9]{8}$'),
  created_at timestamptz not null default now()
);
create index saved_places_account on public.saved_places (account_id);

create table public.favourite_carriers (
  account_id uuid not null references public.profiles (id) on delete cascade,
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, carrier_id)
);

-- ---------------------------------------------------------------------------------------------
-- Trips: money columns, codes, tracking link, arrival times, safety, claims, cancellations
-- ---------------------------------------------------------------------------------------------

-- A 4-digit code from the secure random generator.
create function private.random_code() returns text language sql volatile set search_path = public as $$
  select lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0') from (select extensions.gen_random_bytes(2) as b) r
$$;

alter table public.trips drop constraint trips_status_check;
alter table public.trips
  add constraint trips_status_check check (status in ('awaiting_payment', 'scheduled', 'to_pickup', 'at_pickup', 'loaded', 'in_transit', 'at_border', 'at_dropoff', 'delivered', 'completed', 'disputed', 'cancelled')),
  add column insurance_fee integer not null default 0 check (insurance_fee >= 0),
  add column discount integer not null default 0 check (discount >= 0),
  add column extras integer not null default 0 check (extras >= 0),
  add column extras_commission integer not null default 0 check (extras_commission >= 0),
  add column tip integer not null default 0 check (tip >= 0),
  add column advance_amount integer not null default 0 check (advance_amount >= 0),
  add column advance_fee integer not null default 0 check (advance_fee >= 0),
  add column on_credit boolean not null default false,
  add column credit_due_on date,
  add column credit_reminded_on date,
  add column expected_delivery date,
  add column pickup_code text not null default private.random_code(),
  add column delivery_code text not null default private.random_code(),
  add column code_failures integer not null default 0,
  add column code_failed_at timestamptz,
  add column share_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  add column arrived_pickup_at timestamptz,
  add column arrived_dropoff_at timestamptz,
  add column sos_at timestamptz,
  add column sos_note text check (char_length(sos_note) <= 500),
  add column alert text check (alert in ('no_signal', 'stopped')),
  add column alert_at timestamptz,
  add column claim_amount integer check (claim_amount is null or claim_amount > 0),
  add column dispute_files text[] not null default '{}',
  add column cancel_fee integer not null default 0 check (cancel_fee >= 0),
  add column cancelled_by text check (cancelled_by in ('shipper', 'carrier', 'admin')),
  add column reminded_at timestamptz,
  add column total_due integer generated always as (price + insurance_fee + extras - discount) stored,
  -- What the shipper still owes: the rest of the trip, or a cancellation fee on a trip booked on credit.
  add column balance integer generated always as (
    case when status = 'cancelled' then greatest(cancel_fee - amount_paid, 0)
    else greatest(price + insurance_fee + extras - discount - amount_paid, 0) end) stored,
  add constraint trips_discount_fits check (discount <= price + insurance_fee + extras);

-- Waiting time and other extras on top of the agreed price.
create table public.trip_charges (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null check (kind in ('waiting', 'extra_stop', 'loading', 'other')),
  amount integer not null check (amount between 100 and 1000000),
  commission integer not null default 0 check (commission >= 0),
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by text not null check (requested_by in ('carrier', 'system', 'admin')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index trip_charges_trip on public.trip_charges (trip_id);

create table public.messages (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  sender text not null check (sender in ('shipper', 'carrier', 'driver', 'vemi')),
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  to_support boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_trip on public.messages (trip_id, created_at);

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  requested_by text not null,
  caller_phone text not null,
  callee_phone text not null,
  session_id text,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
create index voice_calls_trip on public.voice_calls (trip_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Money: payment methods, payout kinds, wallet, refunds, promo codes, referrals
-- ---------------------------------------------------------------------------------------------

alter table public.payments drop constraint payments_method_check;
alter table public.payments
  add constraint payments_method_check check (method in ('mpesa', 'bank', 'paypal', 'wallet')),
  add column purpose text not null default 'trip' check (purpose in ('trip', 'tip')),
  add column paypal_order_id text unique,
  add column usd_amount numeric(10, 2);

alter table public.payouts drop constraint payouts_trip_id_key;
alter table public.payouts drop constraint payouts_status_check;
alter table public.payouts
  add constraint payouts_status_check check (status in ('queued', 'sending', 'paid', 'held')),
  add column kind text not null default 'trip' check (kind in ('trip', 'advance', 'tip', 'cancellation', 'bonus')),
  add column b2c_conversation_id text unique,
  add column b2c_error text;
create unique index payouts_one_per_kind on public.payouts (trip_id, kind, carrier_id);

create table public.wallet_entries (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('referral', 'cancellation', 'claim', 'used', 'cashout', 'cashout_reversed', 'admin')),
  reason text not null check (char_length(reason) <= 200),
  trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now()
);
create index wallet_entries_account on public.wallet_entries (account_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  phone text not null check (phone ~ '^254[17][0-9]{8}$'),
  status text not null default 'queued' check (status in ('queued', 'sending', 'paid', 'cancelled')),
  reference text,
  b2c_conversation_id text unique,
  b2c_error text,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index refunds_account on public.refunds (account_id, created_at desc);

create table public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  description text check (char_length(description) <= 200),
  kind text not null check (kind in ('percent', 'amount')),
  value integer not null check (value > 0),
  max_discount_kes integer check (max_discount_kes is null or max_discount_kes > 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  first_trip_only boolean not null default false,
  min_price_kes integer not null default 0 check (min_price_kes >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

create table public.promo_redemptions (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  code text not null references public.promo_codes (code),
  account_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index promo_redemptions_account on public.promo_redemptions (account_id, code);

create table public.referral_rewards (
  referee_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  amount integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Ratings compliments, push subscriptions, phone sign-in codes
-- ---------------------------------------------------------------------------------------------

alter table public.ratings add column tags text[] not null default '{}'
  check (tags <@ array['on_time', 'careful', 'communication', 'professional', 'clean_truck', 'ready_on_time', 'fast_loading', 'clear_directions', 'pays_fast']::text[]);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

create table public.login_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz
);
create index login_codes_phone on public.login_codes (phone, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function private.km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create function private.wallet_balance_of(p_account uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::integer from public.wallet_entries where account_id = p_account
$$;

create function private.add_wallet(p_account uuid, p_amount integer, p_kind text, p_reason text, p_trip uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.wallet_entries (account_id, amount, kind, reason, trip_id) select p_account, p_amount, p_kind, p_reason, p_trip where p_amount <> 0
$$;

-- Once everything owed before dispatch is in, the truck can go.
create function private.check_paid(p_trip uuid) returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip for update;
  if t.status = 'awaiting_payment' and t.amount_paid >= t.total_due then
    update public.trips set status = 'scheduled', paid_at = now() where id = p_trip returning * into t;
    perform private.log_event(p_trip, 'scheduled', 'system', 'Paid in full. The carrier can dispatch.');
  end if;
  return t;
end $$;

create or replace function private.apply_payment(p_trip uuid, p_amount integer, p_note text) returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips set amount_paid = amount_paid + p_amount where id = p_trip returning * into t;
  perform private.log_event(p_trip, t.status, 'system', 'Payment received: KES ' || to_char(p_amount, 'FM999,999,999') || ' (' || p_note || ')');
  return private.check_paid(p_trip);
end $$;

-- A tip goes to the carrier in full, with no commission.
create function private.apply_tip(p_trip uuid, p_amount integer, p_note text) returns public.trips language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  update public.trips set tip = tip + p_amount where id = p_trip returning * into t;
  insert into public.payouts (trip_id, carrier_id, amount, phone, kind)
  values (t.id, t.carrier_id, p_amount, (select payout_phone from public.carrier_private where carrier_id = t.carrier_id), 'tip')
  on conflict (trip_id, kind, carrier_id) do update set amount = public.payouts.amount + excluded.amount;
  perform private.log_event(p_trip, t.status, 'system', 'Tip received: KES ' || to_char(p_amount, 'FM999,999,999') || ' (' || p_note || '). All of it goes to the carrier.');
  return t;
end $$;

create function private.add_charge(p_trip uuid, p_kind text, p_amount integer, p_note text, p_status text, p_by text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_commission integer;
  v_id uuid;
begin
  select * into t from public.trips where id = p_trip for update;
  v_commission := round(p_amount * t.commission_bps / 10000.0)::integer;
  insert into public.trip_charges (trip_id, kind, amount, commission, note, status, requested_by, decided_at)
  values (p_trip, p_kind, p_amount, v_commission, nullif(trim(p_note), ''), p_status, p_by, case when p_status <> 'pending' then now() end)
  returning id into v_id;
  if p_status = 'approved' then
    update public.trips set extras = extras + p_amount, extras_commission = extras_commission + v_commission where id = p_trip;
  end if;
  return v_id;
end $$;

-- The working days a trip needs: about 450 km a day plus a day per border.
create function private.expected_delivery(p_pickup date, p_km integer, p_borders integer) returns date language sql immutable as $$
  select p_pickup + greatest(0, ceil(p_km / 450.0)::integer - 1) + p_borders
$$;

-- ---------------------------------------------------------------------------------------------
-- New users: referral codes, a welcome credit from a referral, and Google sign-ins choose a role later
-- ---------------------------------------------------------------------------------------------

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case when v_meta ->> 'role' = 'carrier' then 'carrier' else 'shipper' end;
  v_referrer uuid;
  v_credit integer;
begin
  select id into v_referrer from public.profiles where referral_code = upper(trim(coalesce(v_meta ->> 'ref', '')));
  insert into public.profiles (id, role, full_name, phone, company, referral_code, referred_by, onboarded)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(v_meta ->> 'full_name', ''), v_meta ->> 'name', ''), 120),
    case when coalesce(v_meta ->> 'phone', '') ~ '^\+?[0-9]{9,15}$' then v_meta ->> 'phone' end,
    nullif(left(coalesce(v_meta ->> 'company', ''), 160), ''),
    private.new_referral_code(),
    v_referrer,
    v_meta ? 'role'
  )
  on conflict (id) do nothing;
  if v_referrer is not null and v_role = 'shipper' then
    select referee_credit_kes into v_credit from public.platform_settings;
    perform private.add_wallet(new.id, v_credit, 'referral', 'Welcome credit: you were referred to Vemi');
  end if;
  return new;
end $$;

-- Someone who signed in with Google picks shipper or carrier once.
create function public.choose_role(p_role text, p_phone text, p_company text default null, p_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_credit integer;
begin
  if p_role not in ('shipper', 'carrier') then raise exception 'Choose shipper or carrier.'; end if;
  if coalesce(p_phone, '') !~ '^254[17][0-9]{8}$' then raise exception 'Enter a Kenyan mobile number like 0712 345 678.'; end if;
  select id into v_referrer from public.profiles where referral_code = upper(trim(coalesce(p_ref, ''))) and id <> auth.uid();
  update public.profiles set role = p_role, phone = p_phone, company = nullif(left(trim(coalesce(p_company, '')), 160), ''), onboarded = true,
    referred_by = coalesce(referred_by, v_referrer)
  where id = auth.uid() and not onboarded and role <> 'admin';
  if not found then raise exception 'Your account is already set up.'; end if;
  -- A Google sign-up with a referral code gets the same welcome credit as an email sign-up.
  if v_referrer is not null and p_role = 'shipper' and not exists (select 1 from public.wallet_entries where account_id = auth.uid() and kind = 'referral') then
    select referee_credit_kes into v_credit from public.platform_settings;
    perform private.add_wallet(auth.uid(), v_credit, 'referral', 'Welcome credit: you were referred to Vemi');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Access helpers now know about business accounts and favourites
-- ---------------------------------------------------------------------------------------------

create or replace function private.trip_party(p_trip uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip and (t.shipper_id = private.shipper_account() or t.carrier_id = auth.uid()))
$$;

create or replace function private.load_visible(p_load uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.loads l
    where l.id = p_load and (
      l.shipper_id = private.shipper_account()
      or (l.status = 'open'
        and exists (select 1 from public.carriers c where c.id = auth.uid() and c.status = 'verified')
        and (l.favourites_until is null or l.favourites_until <= now()
          or exists (select 1 from public.favourite_carriers f where f.account_id = l.shipper_id and f.carrier_id = auth.uid())))
      or exists (select 1 from public.bids b where b.load_id = l.id and b.carrier_id = auth.uid())
    )
  )
$$;

create or replace function private.counterparty(p_other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t
    where t.status not in ('awaiting_payment', 'cancelled')
      and ((t.shipper_id = private.shipper_account() and t.carrier_id = p_other) or (t.carrier_id = auth.uid() and t.shipper_id = p_other)))
$$;

-- ---------------------------------------------------------------------------------------------
-- Booking: one path for accepting a bid and for instant booking
-- ---------------------------------------------------------------------------------------------

create function private.book(p_bid uuid, p_actor text) returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.bids;
  l public.loads;
  t public.trips;
  s public.platform_settings;
  v_bps integer;
  v_commission integer;
  v_insurance integer := 0;
begin
  select * into b from public.bids where id = p_bid for update;
  if not found then raise exception 'Bid not found.'; end if;
  select * into l from public.loads where id = b.load_id for update;
  select * into s from public.platform_settings;
  if l.status <> 'open' then raise exception 'This load is already booked or closed.'; end if;
  if b.status <> 'pending' then raise exception 'This bid is no longer available.'; end if;
  if not exists (select 1 from public.carriers where id = b.carrier_id and status = 'verified') then raise exception 'This carrier is not verified any more. Choose another bid.'; end if;

  v_bps := private.commission_bps_for(b.carrier_id);
  v_commission := round(b.amount * v_bps / 10000.0)::integer;
  if l.insure then v_insurance := greatest(s.insurance_min_kes, round(l.declared_value * s.insurance_bps / 10000.0)::integer); end if;
  insert into public.trips (ref, load_id, bid_id, shipper_id, carrier_id, price, commission_bps, commission, carrier_payout, insurance_fee, expected_delivery)
  values (
    l.ref || case when exists (select 1 from public.trips where load_id = l.id) then '-' || (select count(*) + 1 from public.trips where load_id = l.id) else '' end,
    l.id, b.id, l.shipper_id, b.carrier_id, b.amount, v_bps, v_commission, b.amount - v_commission, v_insurance,
    private.expected_delivery(l.pickup_date, l.distance_km, l.border_crossings)
  ) returning * into t;
  update public.bids set status = 'accepted', closed_by_trip = t.id where id = b.id;
  update public.bids set status = 'declined', closed_by_trip = t.id where load_id = l.id and id <> b.id and status = 'pending';
  update public.loads set status = 'booked' where id = l.id;
  perform private.log_event(t.id, 'awaiting_payment', p_actor,
    case when p_actor = 'carrier' then 'Booked instantly by the carrier at KES ' else 'Booked at KES ' end || to_char(b.amount, 'FM999,999,999'));
  return t.id;
end $$;

-- What a shipper account owes on trips that are not on credit (extras after delivery, for example).
create function private.amount_owed(p_account uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(balance), 0)::integer from public.trips
  where shipper_id = p_account and not on_credit and status not in ('awaiting_payment', 'cancelled')
$$;

create or replace function public.accept_bid(p_bid uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare
  l public.loads;
  v_owed integer;
begin
  select l2.* into l from public.loads l2 join public.bids b on b.load_id = l2.id where b.id = p_bid;
  if not found then raise exception 'Bid not found.'; end if;
  if l.shipper_id is distinct from private.shipper_account() then raise exception 'Only the shipper who posted this load can book it.'; end if;
  v_owed := private.amount_owed(l.shipper_id);
  if v_owed > 0 then raise exception 'Please pay the KES % you still owe on an earlier trip first.', to_char(v_owed, 'FM999,999,999'); end if;
  return private.book(p_bid, 'shipper');
end $$;

-- Carrier: take an instant-book load at the shipper's price. First verified truck wins.
create function public.instant_book(p_load uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare
  l public.loads;
  v_bid uuid;
begin
  if not private.is_verified_carrier() then raise exception 'Only verified carriers can book loads.'; end if;
  select * into l from public.loads where id = p_load for update;
  if not found then raise exception 'Load not found.'; end if;
  if l.status <> 'open' then raise exception 'Another truck booked this load first.'; end if;
  if not private.load_visible(p_load) then raise exception 'Load not found.'; end if;
  if not l.instant_book then raise exception 'This shipper wants bids for this load. Send a bid instead.'; end if;
  if l.shipper_id = auth.uid() then raise exception 'You cannot book your own load.'; end if;
  insert into public.bids (load_id, carrier_id, amount, note) values (p_load, auth.uid(), l.price, 'Booked instantly at the shipper''s price')
  on conflict (load_id, carrier_id) do update set amount = excluded.amount, note = excluded.note, status = 'pending', closed_by_trip = null
  where public.bids.status in ('pending', 'withdrawn', 'declined')
  returning id into v_bid;
  if v_bid is null then raise exception 'Your bid on this load can no longer be changed.'; end if;
  return private.book(v_bid, 'carrier');
end $$;

create or replace function public.cancel_load(p_load uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.loads set status = 'cancelled' where id = p_load and shipper_id = private.shipper_account() and status = 'open';
  if not found then raise exception 'Only an open load of yours can be cancelled.'; end if;
  update public.bids set status = 'declined' where load_id = p_load and status = 'pending';
end $$;

-- ---------------------------------------------------------------------------------------------
-- Cancellations: free until the truck sets off, then a fee for the carrier. Money goes to the wallet.
-- ---------------------------------------------------------------------------------------------

create function private.cancel_trip(p_trip uuid, p_by text, p_reason text, p_fee integer, p_reopen boolean) returns public.trips
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_refund integer;
  v_carrier_part integer;
  v_redemption public.promo_redemptions;
begin
  update public.trips set status = 'cancelled', cancel_reason = nullif(trim(p_reason), ''), cancelled_by = p_by, cancel_fee = p_fee
  where id = p_trip returning * into t;
  update public.bids set status = 'declined' where id = t.bid_id;
  if p_reopen then
    update public.loads set status = 'open' where id = t.load_id and pickup_date >= private.eat_today();
    update public.bids set status = 'pending', closed_by_trip = null where load_id = t.load_id and closed_by_trip = t.id and id <> t.bid_id
      and exists (select 1 from public.loads where id = t.load_id and status = 'open');
  else
    update public.loads set status = 'cancelled' where id = t.load_id;
    update public.bids set status = 'declined' where load_id = t.load_id and status = 'pending';
  end if;
  -- Whatever was paid, less the fee, goes back to the shipper's wallet straight away.
  v_refund := greatest(t.amount_paid - p_fee, 0);
  perform private.add_wallet(t.shipper_id, v_refund, 'cancellation', 'Refund for cancelled trip ' || t.ref, t.id);
  if p_fee > 0 then
    v_carrier_part := p_fee - round(p_fee * t.commission_bps / 10000.0)::integer;
    insert into public.payouts (trip_id, carrier_id, amount, phone, kind)
    values (t.id, t.carrier_id, v_carrier_part, (select payout_phone from public.carrier_private where carrier_id = t.carrier_id), 'cancellation')
    on conflict (trip_id, kind, carrier_id) do nothing;
  end if;
  -- A promo code used on a cancelled trip can be used again.
  delete from public.promo_redemptions where trip_id = t.id returning * into v_redemption;
  if v_redemption.code is not null then update public.promo_codes set uses = greatest(uses - 1, 0) where code = v_redemption.code; end if;
  perform private.log_event(p_trip, 'cancelled', p_by, concat_ws(' · ', nullif(trim(p_reason), ''),
    case when p_fee > 0 then 'Cancellation fee KES ' || to_char(p_fee, 'FM999,999,999') end,
    case when v_refund > 0 then 'KES ' || to_char(v_refund, 'FM999,999,999') || ' back to the shipper''s Vemi wallet' end));
  return t;
end $$;

-- Shipper: cancel a booking. Free before the truck sets off; a fee once it is on its way; not after loading.
create or replace function public.cancel_booking(p_trip uuid, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  s public.platform_settings;
  v_fee integer := 0;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.shipper_id is distinct from private.shipper_account() then raise exception 'Trip not found.'; end if;
  select * into s from public.platform_settings;
  if t.status in ('to_pickup', 'at_pickup') then
    v_fee := least(greatest(s.cancel_fee_min_kes, round(t.price * s.cancel_fee_bps / 10000.0)::integer), t.price);
    if not t.on_credit then v_fee := least(v_fee, t.amount_paid); end if;
  elsif t.status not in ('awaiting_payment', 'scheduled') then
    raise exception 'The goods are already loaded. Call Vemi support to stop this trip.';
  end if;
  -- Before payment the shipper is usually choosing another truck, so the load goes back on the board.
  perform private.cancel_trip(p_trip, 'shipper', coalesce(p_reason, 'Cancelled by the shipper'), v_fee, t.status = 'awaiting_payment');
end $$;

-- Carrier: give a trip back before loading. The load returns to the board and it counts against reliability.
create function public.carrier_cancel_trip(p_trip uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Tell the shipper why (at least 5 characters).'; end if;
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status not in ('awaiting_payment', 'scheduled', 'to_pickup', 'at_pickup') then raise exception 'The goods are loaded. Call Vemi support if the truck cannot continue.'; end if;
  if t.status <> 'awaiting_payment' then update public.carriers set cancellations = cancellations + 1 where id = t.carrier_id; end if;
  perform private.cancel_trip(p_trip, 'carrier', p_reason, 0, true);
end $$;

create or replace function public.admin_cancel_trip(p_trip uuid, p_reason text, p_reopen_load boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if not exists (select 1 from public.trips where id = p_trip and status not in ('completed', 'cancelled')) then raise exception 'Only an open trip can be cancelled.'; end if;
  perform private.cancel_trip(p_trip, 'admin', p_reason, 0, p_reopen_load);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Moving a trip: arrival steps, pickup and delivery codes, waiting time, stops
-- ---------------------------------------------------------------------------------------------

drop function public.carrier_update_trip(uuid, text, text, double precision, double precision);
drop function public.driver_update_trip(text, text, text, double precision, double precision);
drop function private.advance_trip(uuid, text, text, text, double precision, double precision);

-- Returns {ok: true} or {ok: false, error: "..."} for a wrong code (so the failed try is counted).
create function private.advance_trip(p_trip uuid, p_status text, p_actor text, p_note text, p_lat double precision, p_lng double precision, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  l public.loads;
  s public.platform_settings;
  v_allowed text[];
  v_note text := nullif(trim(p_note), '');
  v_hours numeric;
  v_waiting integer;
  v_checked boolean := p_actor not in ('driver', 'carrier');
  v_expected text;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found then raise exception 'Trip not found.'; end if;
  select * into l from public.loads where id = t.load_id;
  select * into s from public.platform_settings;
  v_allowed := case t.status
    when 'scheduled' then array['to_pickup']
    when 'to_pickup' then array['at_pickup', 'loaded']
    when 'at_pickup' then array['loaded']
    when 'loaded' then array['in_transit']
    when 'in_transit' then array['at_border', 'at_dropoff', 'delivered']
    when 'at_border' then array['in_transit', 'at_dropoff', 'delivered']
    when 'at_dropoff' then array['delivered']
    else array[]::text[]
  end;
  if t.status = 'awaiting_payment' then raise exception 'This trip is not paid yet. Wait for the shipper''s payment before moving.'; end if;
  if not (p_status = any (v_allowed)) then raise exception 'A trip that is % cannot move to %.', t.status, p_status; end if;
  if p_status = 'to_pickup' and (t.truck_id is null or t.driver_id is null) then raise exception 'Assign a truck and a driver first.'; end if;

  -- Codes prove the right truck loaded and the right person received. Ten wrong tries lock them for 30 minutes.
  if not v_checked and l.require_codes and p_status in ('loaded', 'delivered') then
    if t.code_failures >= 10 and t.code_failed_at > now() - interval '30 minutes' then
      raise exception 'Too many wrong codes. Wait 30 minutes or call Vemi support.';
    end if;
    if nullif(trim(coalesce(p_code, '')), '') is not null then
      v_expected := case when p_status = 'loaded' then t.pickup_code else t.delivery_code end;
      if trim(p_code) <> v_expected then
        update public.trips set code_failures = case when code_failed_at < now() - interval '30 minutes' then 1 else code_failures + 1 end, code_failed_at = now() where id = p_trip;
        return jsonb_build_object('ok', false, 'error', 'That code is wrong. Ask for the 4-digit code again.');
      end if;
      v_note := concat_ws(' · ', v_note, case when p_status = 'loaded' then 'Pickup code confirmed' else 'Delivery code confirmed' end);
    elsif p_status = 'loaded' then
      return jsonb_build_object('ok', false, 'error', 'Enter the 4-digit pickup code. The person loading the truck has it.');
    elsif t.pod_path is null then
      return jsonb_build_object('ok', false, 'error', 'Enter the receiver''s 4-digit delivery code, or upload a photo of the signed delivery note first.');
    else
      v_note := concat_ws(' · ', v_note, 'Delivered without the code: delivery photo uploaded');
    end if;
  end if;
  if p_status = 'delivered' and exists (select 1 from public.load_stops where load_id = t.load_id and done_at is null) then
    raise exception 'Tick off every stop on the way first.';
  end if;

  update public.trips set
    status = p_status,
    code_failures = case when p_status in ('loaded', 'delivered') then 0 else code_failures end,
    arrived_pickup_at = case when p_status = 'at_pickup' then now() else arrived_pickup_at end,
    arrived_dropoff_at = case when p_status = 'at_dropoff' then now() else arrived_dropoff_at end,
    picked_up_at = case when p_status = 'loaded' then now() else picked_up_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    alert = case when p_status = 'delivered' then null else alert end
  where id = p_trip returning * into t;
  perform private.log_event(p_trip, p_status, p_actor, v_note, p_lat, p_lng);
  if p_lat is not null and p_lng is not null then
    insert into public.trip_locations (trip_id, lat, lng) values (p_trip, p_lat, p_lng);
  end if;

  -- Waiting time after the free hours, worked out from the arrival time.
  if (p_status = 'loaded' and t.arrived_pickup_at is not null) or (p_status = 'delivered' and t.arrived_dropoff_at is not null) then
    v_hours := extract(epoch from now() - case when p_status = 'loaded' then t.arrived_pickup_at else t.arrived_dropoff_at end) / 3600.0;
    if v_hours > s.free_waiting_hours and s.waiting_kes_per_hour > 0 then
      v_waiting := ceil(v_hours - s.free_waiting_hours)::integer * s.waiting_kes_per_hour;
      perform private.add_charge(p_trip, 'waiting', least(v_waiting, 1000000),
        'Waited ' || round(v_hours, 1) || ' h at ' || case when p_status = 'loaded' then 'pickup' else 'drop-off' end || ' (' || s.free_waiting_hours || ' h free)', 'approved', 'system');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', p_trip);
end $$;

create function public.carrier_update_trip(p_trip uuid, p_status text, p_note text default null, p_lat double precision default null, p_lng double precision default null, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and carrier_id = auth.uid()) then raise exception 'Trip not found.'; end if;
  return private.advance_trip(p_trip, p_status, 'carrier', p_note, p_lat, p_lng, p_code);
end $$;

create function public.driver_update_trip(p_token text, p_status text, p_note text default null, p_lat double precision default null, p_lng double precision default null, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select id into v_trip from public.trips where driver_token = p_token;
  if v_trip is null then raise exception 'This trip link is not valid.'; end if;
  return private.advance_trip(v_trip, p_status, 'driver', p_note, p_lat, p_lng, p_code);
end $$;

-- Only the shipper side (and ops) can read the codes they hand to the people at each end.
create function public.trip_codes(p_trip uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pickup', pickup_code, 'delivery', delivery_code) from public.trips
  where id = p_trip and (shipper_id = private.shipper_account() or private.is_admin())
$$;

create function public.trip_share_token(p_trip uuid) returns text language sql stable security definer set search_path = public as $$
  select share_token from public.trips where id = p_trip and (shipper_id = private.shipper_account() or carrier_id = auth.uid() or private.is_admin())
$$;

create or replace function public.trip_driver_token(p_trip uuid) returns text language sql stable security definer set search_path = public as $$
  select driver_token from public.trips where id = p_trip and (carrier_id = auth.uid() or private.is_admin())
$$;

create function private.mark_stop(p_trip uuid, p_seq integer, p_actor text) returns void language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip;
  if t.status not in ('loaded', 'in_transit', 'at_border', 'at_dropoff') then raise exception 'Stops can be ticked off once the goods are on the road.'; end if;
  update public.load_stops set done_at = now() where load_id = t.load_id and seq = p_seq and done_at is null;
  if not found then raise exception 'That stop is already done.'; end if;
  perform private.log_event(p_trip, t.status, p_actor, 'Stop ' || p_seq || ' done: ' || (select coalesce(s.detail, p.name) from public.load_stops s join public.places p on p.id = s.place_id where s.load_id = t.load_id and s.seq = p_seq));
end $$;

create function public.carrier_stop_done(p_trip uuid, p_seq integer) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and carrier_id = auth.uid()) then raise exception 'Trip not found.'; end if;
  perform private.mark_stop(p_trip, p_seq, 'carrier');
end $$;

create function public.driver_stop_done(p_token text, p_seq integer) returns void language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select id into v_trip from public.trips where driver_token = p_token;
  if v_trip is null then raise exception 'This trip link is not valid.'; end if;
  perform private.mark_stop(v_trip, p_seq, 'driver');
end $$;

-- ---------------------------------------------------------------------------------------------
-- Delivery, disputes with claims, completion and payouts
-- ---------------------------------------------------------------------------------------------

create or replace function private.complete_trip(p_trip uuid, p_actor text, p_note text) returns public.trips language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  s public.platform_settings;
  v_referrer uuid;
  v_referrer_role text;
  v_person uuid;
begin
  update public.trip_charges set status = 'declined', decided_at = now(), note = concat_ws(' ', note, '(not approved before the trip was completed)')
  where trip_id = p_trip and status = 'pending';
  update public.trips set status = 'completed', completed_at = now(), alert = null where id = p_trip and status in ('delivered', 'disputed') returning * into t;
  if not found then raise exception 'Only a delivered trip can be confirmed.'; end if;
  insert into public.payouts (trip_id, carrier_id, amount, phone, kind)
  values (t.id, t.carrier_id, greatest(t.carrier_payout + t.extras - t.extras_commission - t.advance_amount, 0),
    (select payout_phone from public.carrier_private where carrier_id = t.carrier_id), 'trip')
  on conflict (trip_id, kind, carrier_id) do update set status = case when public.payouts.status = 'held' then 'queued' else public.payouts.status end;
  perform private.log_event(p_trip, 'completed', p_actor, p_note);

  -- Referral rewards on the first completed trip of a referred shipper account or carrier.
  select * into s from public.platform_settings;
  foreach v_person in array array[t.shipper_id, t.carrier_id] loop
    select referred_by into v_referrer from public.profiles where id = v_person;
    continue when v_referrer is null or s.referral_reward_kes = 0;
    continue when exists (select 1 from public.trips where id <> t.id and status = 'completed' and (shipper_id = v_person or carrier_id = v_person));
    insert into public.referral_rewards (referee_id, referrer_id, trip_id, amount) values (v_person, v_referrer, t.id, s.referral_reward_kes) on conflict do nothing;
    continue when not found;
    select role into v_referrer_role from public.profiles where id = v_referrer;
    if v_referrer_role = 'carrier' then
      insert into public.payouts (trip_id, carrier_id, amount, phone, kind)
      values (t.id, v_referrer, s.referral_reward_kes, (select payout_phone from public.carrier_private where carrier_id = v_referrer), 'bonus')
      on conflict (trip_id, kind, carrier_id) do nothing;
    else
      perform private.add_wallet(v_referrer, s.referral_reward_kes, 'referral', 'Referral reward: someone you invited completed their first trip', t.id);
    end if;
  end loop;
  return t;
end $$;

create or replace function public.confirm_delivery(p_trip uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip and shipper_id = private.shipper_account() and status = 'delivered') then raise exception 'Only a delivered trip of yours can be confirmed.'; end if;
  perform private.complete_trip(p_trip, 'shipper', 'Delivery confirmed by the shipper');
end $$;

drop function public.raise_dispute(uuid, text);
create function public.raise_dispute(p_trip uuid, p_reason text, p_claim integer default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'Tell us what went wrong (at least 10 characters).'; end if;
  if p_claim is not null and p_claim <= 0 then raise exception 'Enter the value of the damage or loss in KES, or leave it empty.'; end if;
  update public.trips set status = 'disputed', dispute_reason = trim(p_reason), claim_amount = p_claim
  where id = p_trip and shipper_id = private.shipper_account() and status = 'delivered';
  if not found then raise exception 'Only a delivered trip of yours can be disputed, before it is confirmed.'; end if;
  perform private.log_event(p_trip, 'disputed', 'shipper', concat_ws(' · ', trim(p_reason), case when p_claim is not null then 'Claim KES ' || to_char(p_claim, 'FM999,999,999') end));
end $$;

-- Server (after checking the shipper's session): attach a photo to a dispute.
create function public.attach_dispute_file(p_trip uuid, p_path text) returns void language sql security definer set search_path = public as $$
  update public.trips set dispute_files = (dispute_files || p_path)[1:10] where id = p_trip and status = 'disputed'
$$;

drop function public.admin_resolve_dispute(uuid, text, text);
-- pay_carrier: payout as normal. hold: keep it. split: take p_amount from the payout for the shipper's wallet.
create function public.admin_resolve_dispute(p_trip uuid, p_outcome text, p_note text, p_amount integer default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_payout integer;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  select * into t from public.trips where id = p_trip;
  if not found or t.status <> 'disputed' then raise exception 'This trip is not in dispute.'; end if;
  if p_outcome = 'pay_carrier' then
    perform private.complete_trip(p_trip, 'admin', coalesce(p_note, 'Dispute resolved: carrier paid'));
  elsif p_outcome = 'split' then
    v_payout := greatest(t.carrier_payout + t.extras - t.extras_commission - t.advance_amount, 0);
    if p_amount is null or p_amount <= 0 or p_amount > v_payout then raise exception 'Enter an amount between 1 and the payout (KES %).', v_payout; end if;
    perform private.complete_trip(p_trip, 'admin', coalesce(p_note, 'Dispute settled'));
    update public.payouts set amount = amount - p_amount where trip_id = p_trip and kind = 'trip' and carrier_id = t.carrier_id;
    perform private.add_wallet(t.shipper_id, p_amount, 'claim', 'Damage or loss settlement on ' || t.ref, t.id);
    perform private.log_event(p_trip, 'completed', 'admin', 'KES ' || to_char(p_amount, 'FM999,999,999') || ' from the carrier''s payout credited to the shipper''s wallet');
  elsif p_outcome = 'hold' then
    insert into public.payouts (trip_id, carrier_id, amount, phone, status, kind)
    select t.id, t.carrier_id, greatest(t.carrier_payout + t.extras - t.extras_commission - t.advance_amount, 0), cp.payout_phone, 'held', 'trip'
    from (select 1) x left join public.carrier_private cp on cp.carrier_id = t.carrier_id
    on conflict (trip_id, kind, carrier_id) do update set status = 'held';
    perform private.log_event(p_trip, 'disputed', 'admin', coalesce(p_note, 'Payout held while Vemi investigates'));
  else
    raise exception 'Unknown outcome.';
  end if;
end $$;

drop function public.rate_trip(uuid, integer, text);
create function public.rate_trip(p_trip uuid, p_stars integer, p_comment text default null, p_tags text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_rater uuid;
  v_ratee uuid;
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found.'; end if;
  if t.carrier_id = auth.uid() then v_rater := t.carrier_id; v_ratee := t.shipper_id;
  elsif t.shipper_id = private.shipper_account() then v_rater := t.shipper_id; v_ratee := t.carrier_id;
  else raise exception 'Trip not found.'; end if;
  if t.status <> 'completed' then raise exception 'You can rate a trip once it is completed.'; end if;
  insert into public.ratings (trip_id, rater_id, ratee_id, stars, comment, tags) values (p_trip, v_rater, v_ratee, p_stars, nullif(trim(p_comment), ''), coalesce(p_tags, '{}'))
  on conflict (trip_id, rater_id) do update set stars = excluded.stars, comment = excluded.comment, tags = excluded.tags;
  update public.profiles p set rating_avg = r.avg, rating_count = r.n
  from (select round(avg(stars)::numeric, 2) as avg, count(*)::integer as n from public.ratings where ratee_id = v_ratee) r
  where p.id = v_ratee;
  update public.carriers c set rating_avg = p.rating_avg, rating_count = p.rating_count from public.profiles p where c.id = v_ratee and p.id = v_ratee;
end $$;

-- On-time record, completed trips, cancellations and top compliments for the carriers shown to a shipper.
create function public.carrier_scores(p_ids uuid[]) returns table (carrier_id uuid, completed integer, on_time_pct integer, cancellations integer, compliments text[])
language sql stable security definer set search_path = public as $$
  select c.id,
    (select count(*)::integer from public.trips t where t.carrier_id = c.id and t.status = 'completed'),
    (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where (t.delivered_at at time zone 'Africa/Nairobi')::date <= t.expected_delivery) / count(*))::integer end
      from public.trips t where t.carrier_id = c.id and t.status = 'completed' and t.expected_delivery is not null and t.delivered_at is not null),
    c.cancellations,
    array(select tag from public.ratings r, unnest(r.tags) tag where r.ratee_id = c.id group by tag order by count(*) desc limit 3)
  from public.carriers c where c.id = any (p_ids) and (c.status = 'verified' or c.id = auth.uid() or private.is_admin())
$$;

-- ---------------------------------------------------------------------------------------------
-- Payments: promo codes, wallet, credit, tips (M-Pesa callback), fuel advance, extra charges
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_mpesa_payment(p_checkout_request_id text, p_receipt text, p_amount integer, p_raw jsonb)
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
  if p.purpose = 'tip' then return private.apply_tip(p.trip_id, p.amount, 'M-Pesa ' || coalesce(p_receipt, '')); end if;
  return private.apply_payment(p.trip_id, p.amount, 'M-Pesa ' || coalesce(p_receipt, ''));
end $$;

-- Server (PayPal return, after PayPal confirmed the capture): record a card or PayPal payment once.
create function public.apply_paypal_payment(p_order_id text, p_capture_id text, p_usd numeric, p_raw jsonb) returns public.trips
language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  update public.payments set status = 'paid', receipt = p_capture_id, raw = p_raw, paid_at = now(), usd_amount = coalesce(p_usd, usd_amount)
  where paypal_order_id = p_order_id and status = 'pending' returning * into p;
  if not found then return (select t.* from public.trips t join public.payments p2 on p2.trip_id = t.id where p2.paypal_order_id = p_order_id); end if;
  return private.apply_payment(p.trip_id, p.amount, 'PayPal ' || p_capture_id);
end $$;

create function public.apply_promo(p_trip uuid, p_code text) returns integer language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  c public.promo_codes;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_discount integer;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.shipper_id is distinct from private.shipper_account() then raise exception 'Trip not found.'; end if;
  if t.status <> 'awaiting_payment' or t.amount_paid > 0 or t.on_credit then raise exception 'Add a promo code before you pay.'; end if;
  if exists (select 1 from public.promo_redemptions where trip_id = p_trip) then raise exception 'This trip already has a promo code.'; end if;
  select * into c from public.promo_codes where code = v_code for update;
  if not found or not c.active or (c.expires_at is not null and c.expires_at < now()) then raise exception 'That promo code is not valid.'; end if;
  if c.max_uses is not null and c.uses >= c.max_uses then raise exception 'That promo code has been used up.'; end if;
  if t.price < c.min_price_kes then raise exception 'That code works on trips from KES %.', to_char(c.min_price_kes, 'FM999,999,999'); end if;
  if exists (select 1 from public.promo_redemptions where code = v_code and account_id = t.shipper_id) then raise exception 'You have already used that code.'; end if;
  if c.first_trip_only and exists (select 1 from public.trips where shipper_id = t.shipper_id and id <> t.id and status <> 'cancelled' and (amount_paid > 0 or on_credit)) then
    raise exception 'That code is for your first trip only.';
  end if;
  v_discount := case when c.kind = 'percent' then round(t.price * c.value / 100.0)::integer else c.value end;
  if c.max_discount_kes is not null then v_discount := least(v_discount, c.max_discount_kes); end if;
  v_discount := least(v_discount, t.total_due);
  update public.trips set discount = discount + v_discount where id = p_trip;
  update public.promo_codes set uses = uses + 1 where code = v_code;
  insert into public.promo_redemptions (trip_id, code, account_id, amount) values (p_trip, v_code, t.shipper_id, v_discount);
  perform private.log_event(p_trip, t.status, 'shipper', 'Promo code ' || v_code || ': KES ' || to_char(v_discount, 'FM999,999,999') || ' off');
  perform private.check_paid(p_trip);
  return v_discount;
end $$;

create function public.wallet_balance() returns integer language sql stable security definer set search_path = public as $$
  select private.wallet_balance_of(private.shipper_account())
$$;

-- Pay what is owed on a trip from the wallet (as much as the wallet holds).
create function public.pay_with_wallet(p_trip uuid) returns integer language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_amount integer;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.shipper_id is distinct from private.shipper_account() then raise exception 'Trip not found.'; end if;
  perform 1 from public.profiles where id = t.shipper_id for update;
  v_amount := least(private.wallet_balance_of(t.shipper_id), t.balance);
  if v_amount <= 0 then raise exception 'There is nothing to pay from your wallet.'; end if;
  perform private.add_wallet(t.shipper_id, -v_amount, 'used', 'Paid towards ' || t.ref, t.id);
  insert into public.payments (trip_id, shipper_id, method, amount, receipt, status, recorded_by, paid_at)
  values (p_trip, t.shipper_id, 'wallet', v_amount, 'Vemi wallet', 'paid', auth.uid(), now());
  perform private.apply_payment(p_trip, v_amount, 'Vemi wallet');
  return v_amount;
end $$;

-- Wallet to M-Pesa. Ops send it with the payouts.
create function public.request_cashout(p_amount integer, p_phone text) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_account uuid := private.shipper_account();
  v_id uuid;
begin
  if not private.is_account_admin(v_account) then raise exception 'Only the account owner can cash out the wallet.'; end if;
  if coalesce(p_phone, '') !~ '^254[17][0-9]{8}$' then raise exception 'Enter a Safaricom number like 0712 345 678.'; end if;
  perform 1 from public.profiles where id = v_account for update;
  if p_amount is null or p_amount < 100 then raise exception 'The smallest cash-out is KES 100.'; end if;
  if p_amount > private.wallet_balance_of(v_account) then raise exception 'That is more than your wallet holds.'; end if;
  insert into public.refunds (account_id, amount, phone, requested_by) values (v_account, p_amount, p_phone, auth.uid()) returning id into v_id;
  perform private.add_wallet(v_account, -p_amount, 'cashout', 'Cash-out to M-Pesa ' || p_phone);
  return v_id;
end $$;

create function private.credit_outstanding(p_account uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(balance), 0)::integer from public.trips where shipper_id = p_account and on_credit
$$;

-- Business accounts with approved credit can dispatch now and pay on the invoice.
create function public.book_on_credit(p_trip uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  a public.business_accounts;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.shipper_id is distinct from private.shipper_account() then raise exception 'Trip not found.'; end if;
  if t.status <> 'awaiting_payment' then raise exception 'This trip is already paid or dispatched.'; end if;
  select * into a from public.business_accounts where owner_id = t.shipper_id;
  if not found or a.credit_status <> 'approved' then raise exception 'Pay-on-invoice is for business accounts with approved credit.'; end if;
  if exists (select 1 from public.trips where shipper_id = t.shipper_id and on_credit and balance > 0 and credit_due_on < private.eat_today() - 7) then
    raise exception 'An invoice is more than a week overdue. Pay it first, then book on credit again.';
  end if;
  if private.credit_outstanding(t.shipper_id) + t.balance > a.credit_limit then
    raise exception 'This trip would take you over your credit limit of KES %.', to_char(a.credit_limit, 'FM999,999,999');
  end if;
  update public.trips set on_credit = true, credit_due_on = private.eat_today() + a.terms_days, status = 'scheduled' where id = p_trip;
  perform private.log_event(p_trip, 'scheduled', 'shipper', 'Booked on credit: invoice due ' || to_char(private.eat_today() + a.terms_days, 'DD Mon YYYY') || '. The carrier can dispatch.');
end $$;

-- Carrier: ask for an extra charge (loading help, an extra stop on the day...). The shipper approves or declines.
create function public.request_charge(p_trip uuid, p_kind text, p_amount integer, p_note text) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  select * into t from public.trips where id = p_trip;
  if not found or t.carrier_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status not in ('scheduled', 'to_pickup', 'at_pickup', 'loaded', 'in_transit', 'at_border', 'at_dropoff', 'delivered') then raise exception 'Extra charges can only be added to a trip in progress.'; end if;
  if p_kind not in ('extra_stop', 'loading', 'other') then raise exception 'Choose what the charge is for.'; end if;
  if p_amount is null or p_amount < 100 or p_amount > 1000000 then raise exception 'Enter an amount between KES 100 and KES 1,000,000.'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Explain the charge to the shipper (at least 5 characters).'; end if;
  if (select count(*) from public.trip_charges where trip_id = p_trip and status = 'pending') >= 3 then raise exception 'Wait for the shipper to answer your other requests first.'; end if;
  return private.add_charge(p_trip, p_kind, p_amount, p_note, 'pending', 'carrier');
end $$;

create function public.decide_charge(p_charge uuid, p_approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare
  c public.trip_charges;
  t public.trips;
begin
  select * into c from public.trip_charges where id = p_charge for update;
  if not found then raise exception 'Charge not found.'; end if;
  select * into t from public.trips where id = c.trip_id for update;
  if t.shipper_id is distinct from private.shipper_account() and not private.is_admin() then raise exception 'Charge not found.'; end if;
  if c.status <> 'pending' then raise exception 'This charge was already answered.'; end if;
  update public.trip_charges set status = case when p_approve then 'approved' else 'declined' end, decided_at = now() where id = p_charge;
  if p_approve then
    update public.trips set extras = extras + c.amount, extras_commission = extras_commission + c.commission where id = c.trip_id;
  end if;
  perform private.log_event(c.trip_id, t.status, case when private.is_admin() then 'admin' else 'shipper' end,
    case when p_approve then 'Approved' else 'Declined' end || ' extra charge of KES ' || to_char(c.amount, 'FM999,999,999') || coalesce(': ' || c.note, ''));
end $$;

-- Carrier: up to 30% of the payout once the goods are loaded, for a small fee.
create function public.request_fuel_advance(p_trip uuid, p_amount integer) returns integer language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  s public.platform_settings;
  v_max integer;
  v_fee integer;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status not in ('loaded', 'in_transit', 'at_border', 'at_dropoff') then raise exception 'A fuel advance is available once the goods are loaded.'; end if;
  if t.advance_amount > 0 then raise exception 'You already took an advance on this trip.'; end if;
  if not t.on_credit and t.paid_at is null then raise exception 'The shipper has not paid in full yet.'; end if;
  select * into s from public.platform_settings;
  v_max := floor(t.carrier_payout * s.fuel_advance_max_bps / 10000.0)::integer;
  if p_amount is null or p_amount < 1000 or p_amount > v_max then raise exception 'Choose between KES 1,000 and KES %.', to_char(v_max, 'FM999,999,999'); end if;
  v_fee := round(p_amount * s.fuel_advance_fee_bps / 10000.0)::integer;
  update public.trips set advance_amount = p_amount, advance_fee = v_fee where id = p_trip;
  insert into public.payouts (trip_id, carrier_id, amount, phone, kind)
  values (t.id, t.carrier_id, p_amount - v_fee, (select payout_phone from public.carrier_private where carrier_id = t.carrier_id), 'advance');
  perform private.log_event(p_trip, t.status, 'carrier', 'Fuel advance of KES ' || to_char(p_amount, 'FM999,999,999') || ' requested (fee KES ' || to_char(v_fee, 'FM999,999,999') || ')');
  return p_amount - v_fee;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Trucks online and busy-lane pricing
-- ---------------------------------------------------------------------------------------------

create function public.set_truck_available(p_truck uuid, p_place text, p_from date, p_heading text default null, p_note text default null, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trucks where id = p_truck and carrier_id = auth.uid() and active) then raise exception 'Choose one of your active trucks.'; end if;
  if not exists (select 1 from public.places where id = p_place) then raise exception 'Choose the town where the truck is.'; end if;
  if p_from is null or p_from < private.eat_today() or p_from > private.eat_today() + 30 then raise exception 'Choose a date in the next 30 days.'; end if;
  insert into public.truck_availability (truck_id, carrier_id, place_id, lat, lng, available_from, heading_to, note, updated_at, expires_at)
  values (p_truck, auth.uid(), p_place, p_lat, p_lng, p_from, nullif(p_heading, ''), nullif(trim(p_note), ''), now(), (p_from + 3)::timestamptz)
  on conflict (truck_id) do update set place_id = excluded.place_id, lat = excluded.lat, lng = excluded.lng, available_from = excluded.available_from,
    heading_to = excluded.heading_to, note = excluded.note, updated_at = now(), expires_at = excluded.expires_at;
end $$;

create function public.clear_truck_available(p_truck uuid) returns void language sql security definer set search_path = public as $$
  delete from public.truck_availability where truck_id = p_truck and carrier_id = auth.uid()
$$;

-- How many free, verified trucks (of a type) are within 150 km of a town. Counts only, never who.
create function public.trucks_near(p_place text, p_truck_type text default null) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer
  from public.truck_availability a
  join public.trucks k on k.id = a.truck_id and k.active
  join public.carriers c on c.id = a.carrier_id and c.status = 'verified'
  join public.places at_place on at_place.id = a.place_id
  join public.places target on target.id = p_place
  where a.expires_at > now() and a.available_from <= private.eat_today() + 3
    and (p_truck_type is null or k.truck_type = p_truck_type)
    and private.km(coalesce(a.lat, at_place.lat), coalesce(a.lng, at_place.lng), target.lat, target.lng) <= 150
$$;

-- The surcharge on a guide price: urgent pickups, and lanes with more loads waiting than free trucks.
create function public.lane_surge(p_origin text, p_truck_type text, p_pickup date) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.platform_settings;
  o public.places;
  v_open integer;
  v_free integer;
begin
  select * into s from public.platform_settings;
  select * into o from public.places where id = p_origin;
  if not found then return jsonb_build_object('urgent_bps', 0, 'busy_bps', 0, 'open_loads', 0, 'free_trucks', 0); end if;
  select count(*) into v_open from public.loads l join public.places p on p.id = l.origin_id
  where l.status = 'open' and l.truck_type = p_truck_type and l.pickup_date between private.eat_today() and private.eat_today() + 7
    and private.km(p.lat, p.lng, o.lat, o.lng) <= 100;
  v_free := public.trucks_near(p_origin, p_truck_type);
  return jsonb_build_object(
    'urgent_bps', case when p_pickup <= private.eat_today() + 1 then s.urgent_surcharge_bps else 0 end,
    'busy_bps', least(s.busy_lane_max_bps, greatest(0, (v_open - v_free) * 250)),
    'open_loads', v_open, 'free_trucks', v_free);
end $$;

-- Where loads are waiting this week, for carriers deciding where to go next.
create function public.busy_lanes() returns table (origin_id text, destination_country text, open_loads integer, avg_price_per_km integer)
language sql stable security definer set search_path = public as $$
  select l.origin_id, d.country, count(*)::integer, round(avg(l.price::numeric / greatest(l.distance_km, 1)))::integer
  from public.loads l join public.places d on d.id = l.destination_id
  where l.status = 'open' and l.pickup_date between private.eat_today() and private.eat_today() + 7
    and (l.favourites_until is null or l.favourites_until <= now())
  group by l.origin_id, d.country order by count(*) desc limit 12
$$;

-- ---------------------------------------------------------------------------------------------
-- Favourites, team invites, business credit
-- ---------------------------------------------------------------------------------------------

create function public.toggle_favourite(p_carrier uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare v_account uuid := private.shipper_account();
begin
  delete from public.favourite_carriers where account_id = v_account and carrier_id = p_carrier;
  if found then return false; end if;
  if not exists (select 1 from public.trips where shipper_id = v_account and carrier_id = p_carrier and status not in ('awaiting_payment', 'cancelled')) then
    raise exception 'You can favourite carriers you have travelled with.';
  end if;
  insert into public.favourite_carriers (account_id, carrier_id) values (v_account, p_carrier);
  return true;
end $$;

create function public.create_team_invite(p_email text, p_role text default 'booker') returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_account uuid := private.shipper_account();
  v_id uuid;
begin
  if not exists (select 1 from public.business_accounts where owner_id = v_account) then raise exception 'Set up your business account first.'; end if;
  if not private.is_account_admin(v_account) then raise exception 'Only account admins can invite people.'; end if;
  if (select count(*) from public.team_invites where account_id = v_account and accepted_at is null and expires_at > now()) >= 20 then raise exception 'You have 20 open invites. Wait for some to be accepted.'; end if;
  insert into public.team_invites (account_id, email, role, invited_by) values (v_account, lower(trim(p_email)), coalesce(p_role, 'booker'), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.accept_team_invite(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare i public.team_invites;
begin
  select * into i from public.team_invites where token = p_token for update;
  if not found or i.accepted_at is not null or i.expires_at < now() then raise exception 'This invite has expired. Ask for a new one.'; end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> i.email then raise exception 'This invite is for %. Sign in with that email.', i.email; end if;
  if (select role from public.profiles where id = auth.uid()) <> 'shipper' then raise exception 'Carrier and ops accounts cannot join a shipper team.'; end if;
  if exists (select 1 from public.business_accounts where owner_id = auth.uid()) then raise exception 'You already own a business account.'; end if;
  if exists (select 1 from public.loads where shipper_id = auth.uid()) then raise exception 'This account already has its own loads. Sign up with a new email to join the team.'; end if;
  insert into public.team_members (member_id, account_id, role) values (auth.uid(), i.account_id, i.role)
  on conflict (member_id) do update set account_id = excluded.account_id, role = excluded.role;
  update public.team_invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.account_id;
end $$;

create function public.remove_team_member(p_member uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.team_members where member_id = p_member and (private.is_account_admin(account_id) or member_id = auth.uid());
  if not found then raise exception 'Member not found.'; end if;
end $$;

create function public.request_credit() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.business_accounts set credit_status = 'requested', requested_at = now()
  where owner_id = private.shipper_account() and private.is_account_admin(owner_id) and credit_status in ('none', 'declined');
  if not found then raise exception 'Credit can be requested once, by the account owner.'; end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Chat and safety
-- ---------------------------------------------------------------------------------------------

create function public.send_message(p_trip uuid, p_body text, p_to_support boolean default false) returns bigint language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_sender text;
  v_id bigint;
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found.'; end if;
  v_sender := case when private.is_admin() then 'vemi' when t.carrier_id = auth.uid() then 'carrier' when t.shipper_id = private.shipper_account() then 'shipper' end;
  if v_sender is null then raise exception 'Trip not found.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a message.'; end if;
  if (select count(*) from public.messages where trip_id = p_trip and sender_id = auth.uid() and created_at > now() - interval '10 minutes') >= 30 then raise exception 'Slow down a little: too many messages.'; end if;
  insert into public.messages (trip_id, sender, sender_id, body, to_support) values (p_trip, v_sender, auth.uid(), left(trim(p_body), 1000), coalesce(p_to_support, false)) returning id into v_id;
  return v_id;
end $$;

create function public.driver_send_message(p_token text, p_body text) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid;
  v_id bigint;
begin
  select id into v_trip from public.trips where driver_token = p_token;
  if v_trip is null then raise exception 'This trip link is not valid.'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a message.'; end if;
  if (select count(*) from public.messages where trip_id = v_trip and sender = 'driver' and created_at > now() - interval '10 minutes') >= 30 then raise exception 'Slow down a little: too many messages.'; end if;
  insert into public.messages (trip_id, sender, body) values (v_trip, 'driver', left(trim(p_body), 1000)) returning id into v_id;
  return v_id;
end $$;

create function private.sos(p_trip uuid, p_actor text, p_note text, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.trips set sos_at = now(), sos_note = left(nullif(trim(p_note), ''), 500) where id = p_trip;
  perform private.log_event(p_trip, (select status from public.trips where id = p_trip), p_actor, 'SOS: ' || coalesce(nullif(trim(p_note), ''), 'emergency button pressed'), p_lat, p_lng);
  if p_lat is not null and p_lng is not null then insert into public.trip_locations (trip_id, lat, lng) values (p_trip, p_lat, p_lng); end if;
end $$;

create function public.raise_sos(p_trip uuid, p_note text default null, p_lat double precision default null, p_lng double precision default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.trip_party(p_trip) then raise exception 'Trip not found.'; end if;
  perform private.sos(p_trip, case when exists (select 1 from public.trips where id = p_trip and carrier_id = auth.uid()) then 'carrier' else 'shipper' end, p_note, p_lat, p_lng);
end $$;

create function public.driver_sos(p_token text, p_note text default null, p_lat double precision default null, p_lng double precision default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select id into v_trip from public.trips where driver_token = p_token;
  if v_trip is null then raise exception 'This trip link is not valid.'; end if;
  perform private.sos(v_trip, 'driver', p_note, p_lat, p_lng);
  return v_trip;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Ops
-- ---------------------------------------------------------------------------------------------

create function public.admin_clear_sos(p_trip uuid, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  update public.trips set sos_at = null, alert = null where id = p_trip;
  perform private.log_event(p_trip, (select status from public.trips where id = p_trip), 'admin', 'Vemi ops: ' || coalesce(nullif(trim(p_note), ''), 'alert handled'));
end $$;

create function public.admin_update_settings(p jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  update public.platform_settings set
    commission_bps = coalesce((p ->> 'commission_bps')::integer, commission_bps),
    founding_commission_bps = coalesce((p ->> 'founding_commission_bps')::integer, founding_commission_bps),
    auto_confirm_hours = coalesce((p ->> 'auto_confirm_hours')::integer, auto_confirm_hours),
    mpesa_max_kes = coalesce((p ->> 'mpesa_max_kes')::integer, mpesa_max_kes),
    urgent_surcharge_bps = coalesce((p ->> 'urgent_surcharge_bps')::integer, urgent_surcharge_bps),
    busy_lane_max_bps = coalesce((p ->> 'busy_lane_max_bps')::integer, busy_lane_max_bps),
    stop_fee_kes = coalesce((p ->> 'stop_fee_kes')::integer, stop_fee_kes),
    free_waiting_hours = coalesce((p ->> 'free_waiting_hours')::integer, free_waiting_hours),
    waiting_kes_per_hour = coalesce((p ->> 'waiting_kes_per_hour')::integer, waiting_kes_per_hour),
    cancel_fee_bps = coalesce((p ->> 'cancel_fee_bps')::integer, cancel_fee_bps),
    cancel_fee_min_kes = coalesce((p ->> 'cancel_fee_min_kes')::integer, cancel_fee_min_kes),
    insurance_bps = coalesce((p ->> 'insurance_bps')::integer, insurance_bps),
    insurance_min_kes = coalesce((p ->> 'insurance_min_kes')::integer, insurance_min_kes),
    fuel_advance_max_bps = coalesce((p ->> 'fuel_advance_max_bps')::integer, fuel_advance_max_bps),
    fuel_advance_fee_bps = coalesce((p ->> 'fuel_advance_fee_bps')::integer, fuel_advance_fee_bps),
    referral_reward_kes = coalesce((p ->> 'referral_reward_kes')::integer, referral_reward_kes),
    referee_credit_kes = coalesce((p ->> 'referee_credit_kes')::integer, referee_credit_kes),
    usd_rate = coalesce((p ->> 'usd_rate')::numeric, usd_rate);
end $$;

create function public.admin_save_promo(p_code text, p_description text, p_kind text, p_value integer, p_max_discount integer, p_max_uses integer,
  p_first_trip_only boolean, p_min_price integer, p_expires_at timestamptz, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.promo_codes (code, description, kind, value, max_discount_kes, max_uses, first_trip_only, min_price_kes, expires_at, active, created_by)
  values (upper(trim(p_code)), nullif(trim(p_description), ''), p_kind, p_value, p_max_discount, p_max_uses, coalesce(p_first_trip_only, false), coalesce(p_min_price, 0), p_expires_at, coalesce(p_active, true), auth.uid())
  on conflict (code) do update set description = excluded.description, kind = excluded.kind, value = excluded.value, max_discount_kes = excluded.max_discount_kes,
    max_uses = excluded.max_uses, first_trip_only = excluded.first_trip_only, min_price_kes = excluded.min_price_kes, expires_at = excluded.expires_at, active = excluded.active;
end $$;

create function public.admin_decide_credit(p_owner uuid, p_status text, p_limit integer, p_terms integer, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('approved', 'declined', 'suspended') then raise exception 'Unknown decision.'; end if;
  update public.business_accounts set credit_status = p_status, credit_limit = case when p_status = 'approved' then coalesce(p_limit, credit_limit) else credit_limit end,
    terms_days = coalesce(p_terms, terms_days), credit_note = nullif(trim(p_note), ''), decided_at = now()
  where owner_id = p_owner;
  if not found then raise exception 'Business account not found.'; end if;
end $$;

create function public.admin_wallet_adjust(p_account uuid, p_amount integer, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Enter an amount.'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a reason the customer will see.'; end if;
  if private.wallet_balance_of(p_account) + p_amount < 0 then raise exception 'The wallet cannot go below zero.'; end if;
  perform private.add_wallet(p_account, p_amount, 'admin', trim(p_reason));
end $$;

create function public.admin_mark_refunds_paid(p_ids uuid[], p_reference text) returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then raise exception 'Enter the M-Pesa reference for this batch.'; end if;
  update public.refunds set status = 'paid', reference = trim(p_reference), paid_at = now() where id = any (p_ids) and status = 'queued';
  get diagnostics v = row_count;
  return v;
end $$;

create function public.admin_cancel_refund(p_id uuid, p_note text) returns void language plpgsql security definer set search_path = public as $$
declare r public.refunds;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  update public.refunds set status = 'cancelled', reference = left(nullif(trim(p_note), ''), 120) where id = p_id and status = 'queued' returning * into r;
  if not found then raise exception 'Only a queued cash-out can be cancelled.'; end if;
  perform private.add_wallet(r.account_id, r.amount, 'cashout_reversed', 'Cash-out cancelled: ' || coalesce(nullif(trim(p_note), ''), 'money back in your wallet'));
end $$;

-- Server (M-Pesa B2C): a payout or cash-out is on its way, then the result arrives.
create function public.b2c_sending(p_kind text, p_id uuid, p_conversation text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'payout' then
    update public.payouts set status = 'sending', b2c_conversation_id = p_conversation, b2c_error = null where id = p_id and status = 'queued';
  else
    update public.refunds set status = 'sending', b2c_conversation_id = p_conversation, b2c_error = null where id = p_id and status = 'queued';
  end if;
  return found;
end $$;

create function public.b2c_result(p_conversation text, p_ok boolean, p_receipt text, p_error text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payout public.payouts;
  v_refund public.refunds;
begin
  update public.payouts set status = case when p_ok then 'paid' else 'queued' end, reference = case when p_ok then p_receipt else reference end,
    paid_at = case when p_ok then now() else paid_at end, b2c_error = case when p_ok then null else left(p_error, 300) end
  where b2c_conversation_id = p_conversation and status = 'sending' returning * into v_payout;
  if found then return jsonb_build_object('kind', 'payout', 'id', v_payout.id, 'carrier_id', v_payout.carrier_id, 'amount', v_payout.amount, 'ok', p_ok); end if;
  update public.refunds set status = case when p_ok then 'paid' else 'queued' end, reference = case when p_ok then p_receipt else reference end,
    paid_at = case when p_ok then now() else paid_at end, b2c_error = case when p_ok then null else left(p_error, 300) end
  where b2c_conversation_id = p_conversation and status = 'sending' returning * into v_refund;
  if found then return jsonb_build_object('kind', 'refund', 'id', v_refund.id, 'account_id', v_refund.account_id, 'amount', v_refund.amount, 'ok', p_ok); end if;
  return null;
end $$;

-- Every 15 minutes (service role): trucks with no signal for 3 hours, or stopped for 2 hours away from a border.
create function public.run_watch_jobs() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_alert text;
  v_changed jsonb := '[]'::jsonb;
  v_announce jsonb;
begin
  for r in
    select t.id, t.ref, t.status, t.alert, t.carrier_id, t.shipper_id,
      greatest((select max(recorded_at) from public.trip_locations where trip_id = t.id), (select max(created_at) from public.trip_events where trip_id = t.id)) as last_seen,
      (select count(*) from public.trip_locations where trip_id = t.id and recorded_at > now() - interval '2 hours') as recent,
      (select max(private.km(a.lat, a.lng, b.lat, b.lng)) from public.trip_locations a,
        lateral (select lat, lng from public.trip_locations where trip_id = t.id order by recorded_at desc limit 1) b
        where a.trip_id = t.id and a.recorded_at > now() - interval '2 hours') as spread_km,
      (select min(recorded_at) from public.trip_locations where trip_id = t.id and recorded_at > now() - interval '2 hours') as first_recent
    from public.trips t where t.status in ('to_pickup', 'loaded', 'in_transit', 'at_border', 'at_dropoff')
  loop
    v_alert := case
      when r.last_seen < now() - interval '3 hours' then 'no_signal'
      when r.status in ('loaded', 'in_transit') and r.recent >= 6 and r.spread_km < 1 and r.first_recent < now() - interval '100 minutes' then 'stopped'
    end;
    if v_alert is distinct from r.alert then
      update public.trips set alert = v_alert, alert_at = case when v_alert is null then null else now() end where id = r.id;
      if v_alert is not null then
        v_changed := v_changed || jsonb_build_object('trip_id', r.id, 'ref', r.ref, 'alert', v_alert, 'carrier_id', r.carrier_id);
      end if;
    end if;
  end loop;
  -- Loads offered to favourites first are announced to everyone once the window closes.
  with due as (
    update public.loads set announced_at = now()
    where status = 'open' and announced_at is null and favourites_until is not null and favourites_until <= now()
    returning id
  ) select coalesce(jsonb_agg(id), '[]') into v_announce from due;
  return jsonb_build_object('alerts', v_changed, 'announce', v_announce);
end $$;

-- The daily job also sends pickup reminders, document expiry reminders and overdue invoice reminders.
create or replace function public.run_daily_jobs() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hours integer;
  v_completed integer := 0;
  v_expired integer;
  v_reminders jsonb;
  v_documents jsonb;
  v_invoices jsonb;
  r record;
begin
  select auto_confirm_hours into v_hours from public.platform_settings;
  for r in select id from public.trips where status = 'delivered' and delivered_at < now() - make_interval(hours => v_hours) loop
    perform private.complete_trip(r.id, 'system', 'Confirmed automatically: no reply from the shipper within ' || v_hours || ' hours');
    v_completed := v_completed + 1;
  end loop;
  update public.loads set status = 'expired' where status = 'open' and pickup_date < private.eat_today() - 3;
  get diagnostics v_expired = row_count;
  update public.bids b set status = 'declined' from public.loads l where l.id = b.load_id and l.status = 'expired' and b.status = 'pending';
  -- Old availability goes away by itself.
  delete from public.truck_availability where expires_at < now();
  delete from public.login_codes where created_at < now() - interval '1 day';

  with due as (
    update public.trips t set reminded_at = now() from public.loads l
    where l.id = t.load_id and t.status = 'scheduled' and t.reminded_at is null and l.pickup_date = private.eat_today() + 1
    returning t.id, t.ref, t.carrier_id, t.driver_id
  ) select coalesce(jsonb_agg(to_jsonb(due)), '[]') into v_reminders from due;

  with soon as (
    update public.carrier_documents d set expiry_reminded_at = now()
    where d.expires_on is not null and d.expires_on <= private.eat_today() + 14 and d.expiry_reminded_at is null
    returning d.id, d.carrier_id, d.kind, d.expires_on
  ) select coalesce(jsonb_agg(to_jsonb(soon)), '[]') into v_documents from soon;

  with overdue as (
    update public.trips set credit_reminded_on = private.eat_today()
    where on_credit and balance > 0 and credit_due_on < private.eat_today()
      and (credit_reminded_on is null or credit_reminded_on <= private.eat_today() - 7)
    returning id, ref, shipper_id, balance, credit_due_on
  ) select coalesce(jsonb_agg(to_jsonb(overdue)), '[]') into v_invoices from overdue;

  return jsonb_build_object('auto_confirmed', v_completed, 'expired_loads', v_expired, 'pickup_reminders', v_reminders, 'expiring_documents', v_documents, 'overdue_invoices', v_invoices);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------------------------

alter table public.business_accounts enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.truck_availability enable row level security;
alter table public.load_stops enable row level security;
alter table public.saved_places enable row level security;
alter table public.favourite_carriers enable row level security;
alter table public.trip_charges enable row level security;
alter table public.messages enable row level security;
alter table public.voice_calls enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.refunds enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.login_codes enable row level security;

revoke all on public.business_accounts, public.team_members, public.team_invites, public.truck_availability, public.load_stops, public.saved_places,
  public.favourite_carriers, public.trip_charges, public.messages, public.voice_calls, public.wallet_entries, public.refunds, public.promo_codes,
  public.promo_redemptions, public.referral_rewards, public.push_subscriptions, public.login_codes from anon, authenticated;

-- Business accounts see their own; staff in the account see each other.
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin() or private.counterparty(id) or private.same_account(id));

grant select on public.business_accounts to authenticated;
grant insert (owner_id, legal_name, kra_pin, billing_email, billing_phone) on public.business_accounts to authenticated;
grant update (legal_name, kra_pin, billing_email, billing_phone) on public.business_accounts to authenticated;
create policy business_read on public.business_accounts for select to authenticated using (owner_id = private.shipper_account() or private.is_admin());
create policy business_insert on public.business_accounts for insert to authenticated with check (
  owner_id = auth.uid() and private.shipper_account() = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'shipper'));
create policy business_update on public.business_accounts for update to authenticated using (private.is_account_admin(owner_id)) with check (private.is_account_admin(owner_id));

grant select on public.team_members to authenticated;
create policy team_read on public.team_members for select to authenticated using (account_id = private.shipper_account() or private.is_admin());

grant select (id, account_id, email, role, created_at, expires_at, accepted_at) on public.team_invites to authenticated;
grant delete on public.team_invites to authenticated;
create policy invites_read on public.team_invites for select to authenticated using (private.is_account_admin(account_id) or private.is_admin());
create policy invites_delete on public.team_invites for delete to authenticated using (private.is_account_admin(account_id) and accepted_at is null);

grant select on public.truck_availability to authenticated;
create policy availability_read on public.truck_availability for select to authenticated using (carrier_id = auth.uid() or private.is_admin());

-- Loads, contacts, bids, trips and payments belong to the shipper account, not just one login.
drop policy loads_read on public.loads;
drop policy loads_insert on public.loads;
drop policy loads_update on public.loads;
create policy loads_read on public.loads for select to authenticated using (shipper_id = private.shipper_account() or private.load_visible(id) or private.is_admin());
create policy loads_insert on public.loads for insert to authenticated with check (shipper_id = private.shipper_account() and pickup_date >= current_date - 1);
create policy loads_update on public.loads for update to authenticated using (shipper_id = private.shipper_account() and status = 'open') with check (shipper_id = private.shipper_account());
grant insert (instant_book, pickup_window, origin_lat, origin_lng, destination_lat, destination_lng, favourites_until, surge_bps, stop_count, declared_value, insure, require_codes, copied_from) on public.loads to authenticated;
grant update (instant_book) on public.loads to authenticated;

drop policy load_contacts_read on public.load_contacts;
drop policy load_contacts_write on public.load_contacts;
drop policy load_contacts_update on public.load_contacts;
create policy load_contacts_read on public.load_contacts for select to authenticated using (
  private.is_admin()
  or exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = private.shipper_account())
  or exists (select 1 from public.trips t where t.load_id = load_contacts.load_id and t.carrier_id = auth.uid() and t.status not in ('cancelled', 'awaiting_payment')));
create policy load_contacts_write on public.load_contacts for insert to authenticated with check (exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = private.shipper_account()));
create policy load_contacts_update on public.load_contacts for update to authenticated using (exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = private.shipper_account()));

grant select, insert (load_id, seq, kind, place_id, detail, lat, lng) on public.load_stops to authenticated;
create policy load_stops_read on public.load_stops for select to authenticated using (private.load_visible(load_id) or private.is_admin()
  or exists (select 1 from public.trips t where t.load_id = load_stops.load_id and t.carrier_id = auth.uid()));
create policy load_stops_insert on public.load_stops for insert to authenticated with check (
  exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = private.shipper_account() and l.status = 'open'));

grant select, delete on public.saved_places to authenticated;
grant insert (account_id, label, place_id, detail, lat, lng, contact_name, contact_phone) on public.saved_places to authenticated;
create policy saved_places_own on public.saved_places for all to authenticated using (account_id = private.shipper_account()) with check (account_id = private.shipper_account());

grant select on public.favourite_carriers to authenticated;
create policy favourites_read on public.favourite_carriers for select to authenticated using (account_id = private.shipper_account() or private.is_admin());

drop policy bids_read on public.bids;
create policy bids_read on public.bids for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.loads l where l.id = load_id and l.shipper_id = private.shipper_account()));

drop policy trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (shipper_id = private.shipper_account() or carrier_id = auth.uid() or private.is_admin());
grant select (insurance_fee, discount, extras, extras_commission, tip, advance_amount, advance_fee, on_credit, credit_due_on, expected_delivery,
  arrived_pickup_at, arrived_dropoff_at, sos_at, sos_note, alert, alert_at, claim_amount, dispute_files, cancel_fee, cancelled_by, total_due, balance) on public.trips to authenticated;

drop policy trucks_read on public.trucks;
create policy trucks_read on public.trucks for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.trips t where t.truck_id = trucks.id and t.shipper_id = private.shipper_account()));
drop policy drivers_read on public.drivers;
create policy drivers_read on public.drivers for select to authenticated using (
  carrier_id = auth.uid() or private.is_admin()
  or exists (select 1 from public.trips t where t.driver_id = drivers.id and t.shipper_id = private.shipper_account() and t.status not in ('awaiting_payment', 'completed', 'cancelled')));
grant insert (language) on public.drivers to authenticated;
grant update (language) on public.drivers to authenticated;

grant select on public.trip_charges to authenticated;
create policy charges_read on public.trip_charges for select to authenticated using (private.trip_party(trip_id) or private.is_admin());

grant select on public.messages to authenticated;
create policy messages_read on public.messages for select to authenticated using (private.trip_party(trip_id) or private.is_admin());

grant select on public.voice_calls to authenticated;
create policy voice_calls_read on public.voice_calls for select to authenticated using (private.is_admin());

drop policy payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (shipper_id = private.shipper_account() or private.is_admin());
grant select (purpose, usd_amount) on public.payments to authenticated;

grant select on public.wallet_entries to authenticated;
create policy wallet_read on public.wallet_entries for select to authenticated using (account_id = private.shipper_account() or private.is_admin());

grant select (id, account_id, amount, phone, status, reference, created_at, paid_at) on public.refunds to authenticated;
create policy refunds_read on public.refunds for select to authenticated using (account_id = private.shipper_account() or private.is_admin());

grant select on public.promo_codes to authenticated;
create policy promo_read on public.promo_codes for select to authenticated using (private.is_admin());
grant select on public.promo_redemptions to authenticated;
create policy redemptions_read on public.promo_redemptions for select to authenticated using (account_id = private.shipper_account() or private.is_admin());
grant select on public.referral_rewards to authenticated;
create policy referral_rewards_read on public.referral_rewards for select to authenticated using (referrer_id = auth.uid() or referrer_id = private.shipper_account() or private.is_admin());

drop policy ratings_read on public.ratings;
create policy ratings_read on public.ratings for select to authenticated using (
  rater_id in (auth.uid(), private.shipper_account()) or ratee_id in (auth.uid(), private.shipper_account()) or private.is_admin());

-- push_subscriptions and login_codes: server only (no grants to API roles).

-- Functions: start from nothing again, then grant the ones each role uses.
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(), private.is_verified_carrier(), private.trip_party(uuid), private.load_visible(uuid), private.counterparty(uuid),
  private.shipper_account(), private.is_account_admin(uuid), private.same_account(uuid) to authenticated;

grant execute on function
  public.place_bid(uuid, integer, text), public.withdraw_bid(uuid), public.accept_bid(uuid), public.instant_book(uuid), public.cancel_booking(uuid, text),
  public.carrier_cancel_trip(uuid, text), public.cancel_load(uuid), public.assign_trip(uuid, uuid, uuid),
  public.carrier_update_trip(uuid, text, text, double precision, double precision, text), public.carrier_stop_done(uuid, integer),
  public.trip_driver_token(uuid), public.trip_share_token(uuid), public.trip_codes(uuid), public.confirm_delivery(uuid), public.raise_dispute(uuid, text, integer),
  public.rate_trip(uuid, integer, text, text[]), public.carrier_scores(uuid[]), public.choose_role(text, text, text, text),
  public.apply_promo(uuid, text), public.wallet_balance(), public.pay_with_wallet(uuid), public.request_cashout(integer, text), public.book_on_credit(uuid),
  public.request_charge(uuid, text, integer, text), public.decide_charge(uuid, boolean), public.request_fuel_advance(uuid, integer),
  public.set_truck_available(uuid, text, date, text, text, double precision, double precision), public.clear_truck_available(uuid),
  public.trucks_near(text, text), public.lane_surge(text, text, date), public.busy_lanes(), public.toggle_favourite(uuid),
  public.create_team_invite(text, text), public.accept_team_invite(text), public.remove_team_member(uuid), public.request_credit(),
  public.send_message(uuid, text, boolean), public.raise_sos(uuid, text, double precision, double precision),
  public.admin_review_carrier(uuid, text, text), public.admin_record_bank_payment(uuid, integer, text), public.admin_resolve_dispute(uuid, text, text, integer),
  public.admin_cancel_trip(uuid, text, boolean), public.admin_mark_payouts_paid(uuid[], text), public.admin_clear_sos(uuid, text),
  public.admin_update_settings(jsonb), public.admin_save_promo(text, text, text, integer, integer, integer, boolean, integer, timestamptz, boolean),
  public.admin_decide_credit(uuid, text, integer, integer, text), public.admin_wallet_adjust(uuid, integer, text),
  public.admin_mark_refunds_paid(uuid[], text), public.admin_cancel_refund(uuid, text)
to authenticated;

grant execute on function public.apply_mpesa_payment(text, text, integer, jsonb), public.fail_mpesa_payment(text, text, jsonb),
  public.apply_paypal_payment(text, text, numeric, jsonb), public.attach_dispute_file(uuid, text),
  public.driver_update_trip(text, text, text, double precision, double precision, text), public.driver_ping(text, double precision, double precision, integer),
  public.driver_attach_pod(text, text), public.driver_stop_done(text, integer), public.driver_send_message(text, text), public.driver_sos(text, text, double precision, double precision),
  public.b2c_sending(text, uuid, text), public.b2c_result(text, boolean, text, text),
  public.run_daily_jobs(), public.run_watch_jobs() to service_role;

-- Driver and truck photos (private; served through the app after an access check).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
