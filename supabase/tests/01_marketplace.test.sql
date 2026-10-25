-- The whole marketplace flow and its access rules: sign-up, verification, loads, bids, booking,
-- payment, dispatch, tracking, delivery, payout, ratings, disputes and the daily jobs.

-- Signed-out visitors can read the list of towns and nothing else.
select tests.check(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'p') and c.relname <> 'places'
    and has_table_privilege('anon', c.oid, 'select, insert, update, delete')
), 'anon only sees places');
select tests.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
), 'anon cannot run any public function');
select tests.check(not exists (select 1 from pg_tables t where t.schemaname = 'public' and not t.rowsecurity), 'every public table has row level security');
select tests.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
), 'every security definer function pins its search path');
select tests.check(not has_function_privilege('authenticated', 'public.apply_mpesa_payment(text, text, integer, jsonb)', 'execute'), 'users cannot fake a payment');
select tests.check(not has_function_privilege('authenticated', 'public.driver_update_trip(text, text, text, double precision, double precision)', 'execute'), 'driver link functions are server-only');

-- People. Sign-up can choose shipper or carrier, never admin.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ops@vemi.test', '{"full_name":"Ops"}'),
  ('00000000-0000-0000-0000-000000000001', 'shipper@vemi.test', '{"role":"shipper","full_name":"Wanjiru Traders","phone":"254712000001"}'),
  ('00000000-0000-0000-0000-000000000002', 'carrier@vemi.test', '{"role":"carrier","full_name":"Otieno Transport","phone":"254712000002"}'),
  ('00000000-0000-0000-0000-000000000003', 'other@vemi.test', '{"role":"carrier","full_name":"Second Carrier"}'),
  ('00000000-0000-0000-0000-000000000004', 'sneaky@vemi.test', '{"role":"admin","full_name":"Sneaky"}');
select tests.set('admin', '00000000-0000-0000-0000-00000000000a');
select tests.set('shipper', '00000000-0000-0000-0000-000000000001');
select tests.set('carrier', '00000000-0000-0000-0000-000000000002');
select tests.set('carrier2', '00000000-0000-0000-0000-000000000003');
select tests.set('sneaky', '00000000-0000-0000-0000-000000000004');
update public.profiles set role = 'admin' where id = tests.id('admin');
select tests.check((select role from public.profiles where id = tests.id('sneaky')) = 'shipper', 'admin cannot be chosen at sign-up');
select tests.check((select role from public.profiles where id = tests.id('carrier')) = 'carrier', 'carrier sign-up');

select tests.act_as('sneaky');
select tests.expect_error('update public.profiles set role = ''admin'' where id = auth.uid()', 'permission denied');
select tests.expect_error('insert into public.carriers (id, business_name) values (auth.uid(), ''Fake'')', 'row-level security');

-- Carrier onboarding: their own details only, and they start pending.
select tests.act_as('carrier');
insert into public.carriers (id, business_name, base_town, cross_border, countries) values (auth.uid(), 'Otieno Transport Ltd', 'Mombasa', true, '{KE,UG}');
insert into public.carrier_private (carrier_id, kra_pin, payout_phone, payout_name) values (auth.uid(), 'A123456789Z', '254712000002', 'Otieno');
select tests.expect_error('update public.carriers set status = ''verified'' where id = auth.uid()', 'permission denied');
insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes) values (auth.uid(), 'KDA 123A', 'trailer', 28);
insert into public.drivers (carrier_id, full_name, phone, licence_no) values (auth.uid(), 'Juma Driver', '254722000009', 'DL123');
select tests.set('truck', (select id::text from public.trucks where plate = 'KDA 123A'));
select tests.set('driver', (select id::text from public.drivers where full_name = 'Juma Driver'));

select tests.act_as('carrier2');
insert into public.carriers (id, business_name) values (auth.uid(), 'Second Carrier');
select tests.expect_error(format('insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes) values (%L, ''KCB 999X'', ''canter'', 3)', tests.get('carrier')), 'row-level security');
select tests.check(not exists (select 1 from public.carrier_private), 'carriers cannot see each other''s payout details');
select tests.check(not exists (select 1 from public.carriers where id = tests.id('carrier')), 'pending carriers are hidden from others');

-- The shipper posts a load. Carriers that are not verified cannot see or bid on it.
select tests.act_as('shipper');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, border_crossings, guide_price, price)
values (auth.uid(), 'mombasa', 'kampala', current_date + 2, 'fmcg', 'Cooking oil, 1,200 cartons', 26, 'trailer', 1400, 1, 323000, 300000);
select tests.set('load', (select id::text from public.loads limit 1));
-- The app inserts and reads the new row back in one statement.
with created as (insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price)
  values (auth.uid(), 'nairobi', 'thika', current_date, 'general', 'Returning test', 1, 'pickup', 50, 3000, 3000) returning id)
select tests.check((select count(*) from created) = 1, 'a shipper can insert a load and read it back');
reset role;
delete from public.loads where cargo_description = 'Returning test';
select tests.act_as('shipper');
insert into public.load_contacts (load_id, pickup_name, pickup_phone, dropoff_name, dropoff_phone) values (tests.id('load'), 'Store', '254700000111', 'Kampala depot', '254700000222');
select tests.expect_error(format('update public.loads set status = ''booked'' where id = %L', tests.get('load')), 'permission denied');

select tests.act_as('carrier');
select tests.check(not exists (select 1 from public.loads), 'unverified carrier sees no loads');
select tests.expect_error(format('select public.place_bid(%L, 290000)', tests.get('load')), 'Only verified carriers');

-- Admin verifies both carriers; the first get the founding commission.
select tests.act_as('carrier');
select tests.expect_error(format('select public.admin_review_carrier(%L, ''verified'')', tests.get('carrier')), 'Admins only');
select tests.act_as('admin');
select public.admin_review_carrier(tests.id('carrier'), 'verified', 'Documents checked');
select public.admin_review_carrier(tests.id('carrier2'), 'verified');
select tests.check((select founding_until > now() + interval '89 days' from public.carriers where id = tests.id('carrier')), 'founding commission period set');
reset role;
update public.platform_settings set founding_slots = 0;  -- later carriers pay the standard rate
update public.carriers set founding_until = null where id = tests.id('carrier2');

-- Verified carriers see the load but not the contacts, and bid.
select tests.act_as('carrier');
select tests.check(exists (select 1 from public.loads where id = tests.id('load')), 'verified carrier sees open loads');
select tests.check(not exists (select 1 from public.load_contacts), 'contacts hidden before a paid booking');
select tests.check(not exists (select 1 from public.profiles where id = tests.id('shipper')), 'shipper phone hidden from bidders');
select (public.place_bid(tests.id('load'), 290000, 'Can load tomorrow')).id is not null;
select (public.place_bid(tests.id('load'), 285000, 'Best price')).amount = 285000;
select tests.set('bid', (select id::text from public.bids where carrier_id = auth.uid()));
select tests.act_as('carrier2');
select tests.set('bid2', (public.place_bid(tests.id('load'), 310000)).id::text);
select tests.check((select count(*) from public.bids) = 1, 'carriers only see their own bids');

-- The shipper sees both bids and the carriers' business names, then books the cheaper one.
select tests.act_as('shipper');
select tests.check((select count(*) from public.bids where load_id = tests.id('load')) = 2, 'shipper sees all bids on their load');
select tests.check((select count(*) from public.carriers) = 2, 'shipper sees verified carriers');
select tests.act_as('carrier2');
select tests.expect_error(format('select public.accept_bid(%L)', tests.get('bid')), 'Only the shipper');
select tests.act_as('shipper');
select tests.set('trip', public.accept_bid(tests.id('bid'))::text);
select tests.check((select status from public.loads where id = tests.id('load')) = 'booked', 'load booked');
select tests.check((select status from public.bids where id = tests.id('bid2')) = 'declined', 'other bids closed');
select tests.check((select commission = 14250 and carrier_payout = 270750 from public.trips where id = tests.id('trip')), 'founding 5% commission');
select tests.expect_error('select driver_token from public.trips', 'permission denied');
select tests.check(public.trip_driver_token(tests.id('trip')) is null, 'shipper cannot get the driver link');
select tests.check(not exists (select 1 from public.drivers), 'driver details hidden until paid');

-- Cancelling before payment reopens the load and brings the other bids back; booking again works.
select public.cancel_booking(tests.id('trip'), 'Changed my mind');
select tests.check((select status from public.loads where id = tests.id('load')) = 'open', 'load reopened');
select tests.check((select status from public.bids where id = tests.id('bid2')) = 'pending', 'other bids back');
select tests.act_as('carrier');
select public.place_bid(tests.id('load'), 285000, 'Still available');
select tests.act_as('shipper');
select tests.set('trip', public.accept_bid(tests.id('bid'))::text);
select tests.check((select ref like '%-2' from public.trips where id = tests.id('trip')), 'second booking gets its own reference');

-- The carrier assigns the truck and driver; nothing moves before payment.
select tests.act_as('carrier');
select public.assign_trip(tests.id('trip'), tests.id('truck'), tests.id('driver'));
select tests.set('token', public.trip_driver_token(tests.id('trip')));
select tests.expect_error(format('select public.carrier_update_trip(%L, ''to_pickup'')', tests.get('trip')), 'not paid yet');

-- M-Pesa payment (server side).
reset role;
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id) values (tests.id('trip'), tests.id('shipper'), 'mpesa', 285000, '254712000001', 'ws_CO_1');
select tests.act_as_service();
select public.apply_mpesa_payment('ws_CO_1', 'QWE123RTY', 285000, '{}');
select public.apply_mpesa_payment('ws_CO_1', 'QWE123RTY', 285000, '{}');  -- a repeated callback changes nothing
reset role;
select tests.check((select status = 'scheduled' and amount_paid = 285000 from public.trips where id = tests.id('trip')), 'paid once, trip scheduled');

-- Now the carrier sees the contacts and the shipper sees the driver.
select tests.act_as('carrier');
select tests.check(exists (select 1 from public.load_contacts), 'carrier sees contacts once paid');
select tests.check(exists (select 1 from public.profiles where id = tests.id('shipper')), 'carrier sees the shipper once paid');
select tests.act_as('shipper');
select tests.check(exists (select 1 from public.drivers), 'shipper sees the driver once paid');

-- The driver works through their link; steps must go in order.
select tests.act_as_service();
select tests.expect_error(format('select public.driver_update_trip(%L, ''delivered'')', tests.get('token')), 'cannot move');
select tests.expect_error('select public.driver_update_trip(''wrong-token'', ''to_pickup'')', 'not valid');
select public.driver_update_trip(tests.get('token'), 'to_pickup', null, -4.05, 39.66);
select tests.check(public.driver_ping(tests.get('token'), -4.04, 39.67) = false, 'pings are throttled to one a minute');
select public.driver_update_trip(tests.get('token'), 'loaded');
select public.driver_update_trip(tests.get('token'), 'in_transit');
select public.driver_update_trip(tests.get('token'), 'at_border', 'At Malaba');
select public.driver_update_trip(tests.get('token'), 'in_transit');
select public.driver_attach_pod(tests.get('token'), 'trip/pod.jpg');
select public.driver_update_trip(tests.get('token'), 'delivered', 'Signed by storekeeper', 0.35, 32.58);
reset role;
select tests.check((select count(*) from public.trip_locations where trip_id = tests.id('trip')) = 2, 'status updates with a position add a point');

-- A second carrier cannot see the trip at all.
select tests.act_as('carrier2');
select tests.check(not exists (select 1 from public.trips), 'other carriers cannot see the trip');
select tests.check(not exists (select 1 from public.trip_events), 'or its events');

-- The shipper confirms; the payout is queued with the carrier's M-Pesa number.
select tests.act_as('shipper');
select public.confirm_delivery(tests.id('trip'));
select tests.check((select status from public.trips where id = tests.id('trip')) = 'completed', 'trip completed');
select tests.check(not exists (select 1 from public.payouts), 'shippers do not see payouts');
select public.rate_trip(tests.id('trip'), 5, 'On time');
select tests.act_as('carrier');
select tests.check((select amount = 270750 and phone = '254712000002' and status = 'queued' from public.payouts), 'payout queued');
select public.rate_trip(tests.id('trip'), 4);
select tests.check((select rating_avg = 5 and rating_count = 1 from public.carriers where id = tests.id('carrier')), 'carrier rating updated');
select tests.expect_error(format('select public.admin_mark_payouts_paid(array[(select id from public.payouts)], ''REF123'')'), 'Admins only');
select tests.act_as('admin');
select tests.check(public.admin_mark_payouts_paid(array(select id from public.payouts), 'BULK-25OCT') = 1, 'admin marks payouts paid');

-- Disputes hold the payout; the daily job auto-confirms quiet deliveries and expires stale loads.
select tests.act_as('shipper');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price)
values (auth.uid(), 'nairobi', 'nakuru', current_date, 'construction', 'Cement, 200 bags', 10, 'lorry_10t', 200, 30000, 30000),
       (auth.uid(), 'nairobi', 'eldoret', current_date, 'general', 'Furniture', 5, 'lorry_7t', 390, 47000, 47000),
       (auth.uid(), 'thika', 'meru', current_date, 'general', 'Old load', 2, 'canter', 150, 13500, 13500);
select tests.set('load2', (select id::text from public.loads where cargo_description = 'Cement, 200 bags'));
select tests.set('load3', (select id::text from public.loads where cargo_description = 'Furniture'));
select tests.act_as('carrier2');
select tests.set('bid3', (public.place_bid(tests.id('load2'), 30000)).id::text);
select tests.set('bid4', (public.place_bid(tests.id('load3'), 45000)).id::text);
insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes) values (auth.uid(), 'KCC 456B', 'lorry_10t', 10);
insert into public.drivers (carrier_id, full_name, phone) values (auth.uid(), 'Ali', '254733000001');
select tests.act_as('shipper');
select tests.set('trip2', public.accept_bid(tests.id('bid3'))::text);
select tests.set('trip3', public.accept_bid(tests.id('bid4'))::text);
select tests.check((select commission = 3000 from public.trips where id = tests.id('trip2')), 'standard 10% commission');
select tests.act_as('admin');
select public.admin_record_bank_payment(tests.id('trip2'), 30000, 'EQ-778');
select public.admin_record_bank_payment(tests.id('trip3'), 47000, 'EQ-779');
reset role;
update public.trips set truck_id = (select id from public.trucks where plate = 'KCC 456B'), driver_id = (select id from public.drivers where full_name = 'Ali') where id in (tests.id('trip2'), tests.id('trip3'));
select tests.act_as('carrier2');
select public.carrier_update_trip(tests.id('trip2'), 'to_pickup');
select public.carrier_update_trip(tests.id('trip2'), 'loaded');
select public.carrier_update_trip(tests.id('trip2'), 'in_transit');
select public.carrier_update_trip(tests.id('trip2'), 'delivered');
select public.carrier_update_trip(tests.id('trip3'), 'to_pickup');
select public.carrier_update_trip(tests.id('trip3'), 'loaded');
select public.carrier_update_trip(tests.id('trip3'), 'in_transit');
select public.carrier_update_trip(tests.id('trip3'), 'delivered');
select tests.act_as('shipper');
select tests.expect_error(format('select public.raise_dispute(%L, ''bad'')', tests.get('trip2')), 'at least 10');
select public.raise_dispute(tests.id('trip2'), 'Ten bags were missing at delivery');
select tests.act_as('admin');
select public.admin_resolve_dispute(tests.id('trip2'), 'hold', 'Checking with the driver');
select tests.check((select status from public.payouts where trip_id = tests.id('trip2')) = 'held', 'payout held during a dispute');
reset role;
update public.trips set delivered_at = now() - interval '3 days' where id in (tests.id('trip2'), tests.id('trip3'));
update public.loads set pickup_date = current_date - 5 where cargo_description = 'Old load';
select tests.act_as_service();
select tests.check(public.run_daily_jobs() = '{"auto_confirmed": 1, "expired_loads": 1}'::jsonb, 'daily jobs: one auto-confirm (not the disputed trip), one expired load');
reset role;
select tests.check((select status from public.trips where id = tests.id('trip2')) = 'disputed', 'disputed trip is not auto-confirmed');
select tests.act_as('admin');
select public.admin_resolve_dispute(tests.id('trip2'), 'pay_carrier', 'Shortage was at the shipper''s store');
select tests.check((select status from public.payouts where trip_id = tests.id('trip2')) = 'queued', 'resolved dispute releases the payout');
reset role;
