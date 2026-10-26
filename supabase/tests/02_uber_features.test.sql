-- The Uber features: referrals, teams, instant booking, favourites, trucks online, surge, stops,
-- codes, waiting time, extra charges, promo codes, wallet, credit, tips, fuel advance, cancellations,
-- claims, chat, SOS, truck watch and the access rules around them. Runs after 01 on the same database.

select tests.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
), 'anon still cannot run any public function');
select tests.check(not exists (select 1 from pg_tables t where t.schemaname = 'public' and not t.rowsecurity), 'every new table has row level security');
select tests.check(not has_table_privilege('authenticated', 'public.login_codes', 'select'), 'sign-in codes are server only');
select tests.check(not has_table_privilege('authenticated', 'public.push_subscriptions', 'select'), 'push subscriptions are server only');
select tests.check(not has_function_privilege('authenticated', 'public.b2c_result(text, boolean, text, text)', 'execute'), 'users cannot fake an M-Pesa payout result');
select tests.check(not has_function_privilege('authenticated', 'public.apply_paypal_payment(text, text, numeric, jsonb)', 'execute'), 'users cannot fake a PayPal payment');
select tests.check(not has_function_privilege('authenticated', 'public.run_watch_jobs()', 'execute'), 'truck watch is server only');

-- Referral codes: a shipper invites another; the new one gets welcome credit.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'owner@biz.test', '{"role":"shipper","full_name":"Akinyi Owner","phone":"254712000011"}');
select tests.set('owner', '00000000-0000-0000-0000-000000000011');
select tests.set('owner_code', (select referral_code from public.profiles where id = tests.id('owner')));
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000012', 'booker@biz.test', '{"role":"shipper","full_name":"Brian Booker"}'),
  ('00000000-0000-0000-0000-000000000013', 'truckco@vemi.test', '{"role":"carrier","full_name":"Fast Trucks"}'),
  ('00000000-0000-0000-0000-000000000014', 'google@vemi.test', '{"full_name":"Google Person"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000015', 'referred@vemi.test', jsonb_build_object('role', 'shipper', 'full_name', 'Referred Shipper', 'ref', lower(tests.get('owner_code'))));
select tests.set('booker', '00000000-0000-0000-0000-000000000012');
select tests.set('truckco', '00000000-0000-0000-0000-000000000013');
select tests.set('google', '00000000-0000-0000-0000-000000000014');
select tests.set('referred', '00000000-0000-0000-0000-000000000015');
select tests.check((select referred_by = tests.id('owner') from public.profiles where id = tests.id('referred')), 'referral code links the new account');
select tests.check(private.wallet_balance_of(tests.id('referred')) = 1000, 'referred shipper gets welcome credit');
select tests.check((select referral_code ~ '^V[A-Z0-9]{6}$' from public.profiles where id = tests.id('owner')), 'everyone gets a referral code');

-- Google sign-ins choose their role once.
select tests.check((select not onboarded from public.profiles where id = tests.id('google')), 'Google sign-in starts not set up');
select tests.act_as('google');
select public.choose_role('carrier', '254712000014');
select tests.check((select role = 'carrier' and onboarded from public.profiles where id = tests.id('google')), 'role chosen');
select tests.expect_error('select public.choose_role(''shipper'', ''254712000014'')', 'already set up');
select tests.act_as('owner');
select tests.expect_error('select public.choose_role(''carrier'', ''254712000011'')', 'already set up');

-- Business account and a team member who books for it.
select tests.act_as('owner');
insert into public.business_accounts (owner_id, legal_name, kra_pin) values (auth.uid(), 'Akinyi Distributors Ltd', 'P051234567X');
select tests.expect_error('update public.business_accounts set credit_status = ''approved''', 'permission denied');
select tests.set('invite', public.create_team_invite('Booker@Biz.test')::text);
select tests.expect_error('select token from public.team_invites', 'permission denied');
reset role;
select tests.set('invite_token', (select token from public.team_invites where id = tests.id('invite')));
select set_config('request.jwt.claims', jsonb_build_object('sub', tests.get('truckco'), 'role', 'authenticated', 'email', 'truckco@vemi.test')::text, false);
set role authenticated;
select tests.expect_error(format('select public.accept_team_invite(%L)', tests.get('invite_token')), 'This invite is for');
select set_config('request.jwt.claims', jsonb_build_object('sub', tests.get('booker'), 'role', 'authenticated', 'email', 'booker@biz.test')::text, false);
select tests.check(public.accept_team_invite(tests.get('invite_token')) = tests.id('owner'), 'team invite accepted');
select tests.check(private.shipper_account() = tests.id('owner'), 'the booker books for the business');
select tests.check(exists (select 1 from public.profiles where id = tests.id('owner')), 'team members see each other');

-- The booker posts an instant-book load for the business, with a stop and cargo cover.
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, declared_value, insure, stop_count)
values (tests.id('owner'), 'mombasa', 'nairobi', current_date + 1, 'fmcg', 'Soap, 800 cartons', 20, 'trailer', 610, 134000, 140000, 2000000, true, 1);
select tests.set('iload', (select id::text from public.loads where cargo_description = 'Soap, 800 cartons'));
insert into public.load_stops (load_id, seq, place_id, detail) values (tests.id('iload'), 1, 'voi', 'Voi depot');
insert into public.load_contacts (load_id, pickup_name, pickup_phone, stops) values (tests.id('iload'), 'Yard', '254700000300', '[{"seq":1,"name":"Voi depot","phone":"254700000301"}]');
select tests.expect_error(format('insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price) values (%L, ''nairobi'', ''thika'', current_date, ''general'', ''Mine'', 1, ''pickup'', 50, 3000, 3000)', tests.get('booker')), 'row-level security');
select tests.act_as('owner');
select tests.check(exists (select 1 from public.loads where id = tests.id('iload')), 'the owner sees the booker''s load');

-- A verified carrier with a truck online near Mombasa.
select tests.act_as('truckco');
insert into public.carriers (id, business_name, base_town) values (auth.uid(), 'Fast Trucks Ltd', 'Mombasa');
insert into public.carrier_private (carrier_id, payout_phone, payout_name) values (auth.uid(), '254712000013', 'Fast');
insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes) values (auth.uid(), 'KDF 777F', 'trailer', 28);
insert into public.drivers (carrier_id, full_name, phone, language) values (auth.uid(), 'Wafula', '254722000013', 'sw');
select tests.set('ftruck', (select id::text from public.trucks where plate = 'KDF 777F'));
select tests.set('fdriver', (select id::text from public.drivers where full_name = 'Wafula'));
select tests.act_as('admin');
select public.admin_review_carrier(tests.id('truckco'), 'verified');
select tests.act_as('truckco');
select tests.expect_error(format('select public.set_truck_available(%L, ''mombasa'', (now() at time zone ''Africa/Nairobi'')::date - 1)', tests.get('ftruck')), 'next 30 days');
select public.set_truck_available(tests.id('ftruck'), 'mombasa', (now() at time zone 'Africa/Nairobi')::date, 'kampala', 'Empty, can load today');
select tests.act_as('owner');
select tests.check(public.trucks_near('athi-river', 'trailer') = 0, 'no free trailer near Athi River');
select tests.check(public.trucks_near('mombasa', 'trailer') = 1, 'one free trailer near Mombasa');
select tests.check(public.trucks_near('mombasa', 'canter') = 0, 'truck type filter');
select tests.check((public.lane_surge('mombasa', 'trailer', current_date) ->> 'urgent_bps')::int = 1500, 'same-day pickup is urgent');
select tests.check((public.lane_surge('mombasa', 'trailer', current_date + 5) ->> 'urgent_bps')::int = 0, 'later pickups are not urgent');
select tests.check(not exists (select 1 from public.truck_availability), 'shippers cannot see which trucks are where');

-- Favourites first: while the window is open only favourite carriers see the load.
reset role;
update public.loads set favourites_until = now() + interval '2 hours' where id = tests.id('iload');
select tests.act_as('truckco');
select tests.check(not exists (select 1 from public.loads where id = tests.id('iload')), 'non-favourites wait for the favourites window');
select tests.expect_error(format('select public.instant_book(%L)', tests.get('iload')), 'not found');
select tests.act_as('owner');
select tests.expect_error(format('select public.toggle_favourite(%L)', tests.get('truckco')), 'travelled with');
reset role;
update public.loads set favourites_until = null where id = tests.id('iload');

-- Instant book: the first verified carrier gets it at the shipper's price, with cover added.
select tests.act_as('carrier2');
select tests.check(exists (select 1 from public.loads where id = tests.id('iload')), 'open instant loads are on the board');
select tests.act_as('truckco');
select tests.set('itrip', public.instant_book(tests.id('iload'))::text);
select tests.act_as('carrier2');
select tests.expect_error(format('select public.instant_book(%L)', tests.get('iload')), 'Another truck booked');
select tests.act_as('booker');
select tests.check((select price = 140000 and insurance_fee = 6000 and total_due = 146000 and status = 'awaiting_payment' from public.trips where id = tests.id('itrip')), 'instant booking with cargo cover (0.3%)');
select tests.check((select expected_delivery = current_date + 2 from public.trips where id = tests.id('itrip')), 'expected delivery date set');
select tests.check(public.trip_codes(tests.id('itrip')) ? 'delivery', 'the shipper side can read the codes');
select tests.check(public.trip_share_token(tests.id('itrip')) is not null, 'the shipper side can share tracking');
select tests.act_as('truckco');
select tests.check(public.trip_codes(tests.id('itrip')) is null, 'the carrier cannot read the codes');
select tests.expect_error('select pickup_code from public.trips', 'permission denied');
select tests.expect_error('select share_token from public.trips', 'permission denied');

-- Promo code from ops, used once per account, then the rest paid from M-Pesa.
select tests.act_as('admin');
select public.admin_save_promo('KARIBU10', 'Launch offer', 'percent', 10, 5000, 100, true, 10000, now() + interval '30 days', true);
select tests.act_as('booker');
select tests.check((select count(*) from public.promo_codes) = 0, 'shippers cannot list promo codes');
select tests.expect_error(format('select public.apply_promo(%L, ''NOPE'')', tests.get('itrip')), 'not valid');
select tests.check(public.apply_promo(tests.id('itrip'), 'karibu10') = 5000, 'promo capped at KES 5,000');
select tests.expect_error(format('select public.apply_promo(%L, ''KARIBU10'')', tests.get('itrip')), 'already has a promo');
select tests.check((select total_due = 141000 from public.trips where id = tests.id('itrip')), 'discount comes off what the shipper pays');
select tests.check((select carrier_payout from public.trips where id = tests.id('itrip')) = 126000, 'carrier still gets their full share');
reset role;
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id) values (tests.id('itrip'), tests.id('owner'), 'mpesa', 100000, '254712000011', 'ws_CO_part1');
select tests.act_as_service();
select public.apply_mpesa_payment('ws_CO_part1', 'PART1', 100000, '{}');
reset role;
select tests.check((select status = 'awaiting_payment' and balance = 41000 from public.trips where id = tests.id('itrip')), 'part payment does not dispatch');
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id) values (tests.id('itrip'), tests.id('owner'), 'mpesa', 41000, '254712000011', 'ws_CO_part2');
select tests.act_as_service();
select public.apply_mpesa_payment('ws_CO_part2', 'PART2', 41000, '{}');
reset role;
select tests.check((select status = 'scheduled' and balance = 0 from public.trips where id = tests.id('itrip')), 'paid in parts, then dispatched');

-- Drive the trip: arrive, wait too long, stop, deliver with the code.
select tests.act_as('truckco');
select public.assign_trip(tests.id('itrip'), tests.id('ftruck'), tests.id('fdriver'));
select tests.set('itoken', public.trip_driver_token(tests.id('itrip')));
reset role;
select tests.set('icodes', (select pickup_code || ',' || delivery_code from public.trips where id = tests.id('itrip')));
select tests.act_as_service();
select public.driver_update_trip(tests.get('itoken'), 'to_pickup');
select public.driver_update_trip(tests.get('itoken'), 'at_pickup');
reset role;
update public.trips set arrived_pickup_at = now() - interval '5 hours 10 minutes' where id = tests.id('itrip');
select tests.act_as_service();
select public.driver_update_trip(tests.get('itoken'), 'loaded', null, null, null, split_part(tests.get('icodes'), ',', 1));
reset role;
select tests.check((select amount = 4500 and status = 'approved' and kind = 'waiting' from public.trip_charges where trip_id = tests.id('itrip')), 'three hours of waiting charged after 3 free hours');
select tests.check((select extras = 4500 and balance = 4500 from public.trips where id = tests.id('itrip')), 'waiting time is owed by the shipper');
select tests.act_as_service();
select public.driver_update_trip(tests.get('itoken'), 'in_transit');
select tests.expect_error(format('select public.driver_update_trip(%L, ''delivered'', null, null, null, %L)', tests.get('itoken'), split_part(tests.get('icodes'), ',', 2)), 'every stop');
select public.driver_stop_done(tests.get('itoken'), 1);
select tests.expect_error(format('select public.driver_stop_done(%L, 1)', tests.get('itoken')), 'already done');

-- Fuel advance once loaded, an extra charge the shipper approves, a chat and an SOS.
select tests.act_as('truckco');
select tests.expect_error(format('select public.request_fuel_advance(%L, 50000)', tests.get('itrip')), 'between KES 1,000');
select tests.check(public.request_fuel_advance(tests.id('itrip'), 30000) = 29100, 'fuel advance less the 3% fee');
select tests.expect_error(format('select public.request_fuel_advance(%L, 1000)', tests.get('itrip')), 'already took');
select tests.set('charge', public.request_charge(tests.id('itrip'), 'loading', 2000, 'Two casuals for offloading')::text);
select tests.expect_error(format('select public.decide_charge(%L, true)', tests.get('charge')), 'not found');
select public.send_message(tests.id('itrip'), 'Truck is at Voi now');
select tests.act_as('booker');
select public.decide_charge(tests.id('charge'), true);
select tests.check((select extras = 6500 from public.trips where id = tests.id('itrip')), 'approved charge added');
select public.send_message(tests.id('itrip'), 'Thanks, please call the depot', true);
select tests.check((select count(*) from public.messages where trip_id = tests.id('itrip')) = 2, 'both sides read the chat');
select tests.act_as('carrier2');
select tests.check(not exists (select 1 from public.messages), 'other carriers cannot read the chat');
select tests.expect_error(format('select public.send_message(%L, ''hi'')', tests.get('itrip')), 'not found');
select tests.act_as_service();
select public.driver_send_message(tests.get('itoken'), 'Niko Voi');
select tests.check(public.driver_sos(tests.get('itoken'), 'Tyre burst', -3.39, 38.55) = tests.id('itrip'), 'driver SOS');
reset role;
select tests.check((select sos_at is not null from public.trips where id = tests.id('itrip')), 'SOS flagged on the trip');
select tests.act_as('admin');
select public.admin_clear_sos(tests.id('itrip'), 'Called the driver, tyre changed');
select tests.act_as_service();
select public.driver_update_trip(tests.get('itoken'), 'delivered', null, null, null, split_part(tests.get('icodes'), ',', 2));

-- Confirmation: the payout is the carrier's share plus extras, less the advance.
select tests.act_as('booker');
select public.confirm_delivery(tests.id('itrip'));
select tests.act_as('truckco');
select tests.check((select amount from public.payouts where trip_id = tests.id('itrip') and kind = 'trip') = 126000 + 6500 - 650 - 30000, 'payout = share + extras − commission on extras − advance');
select tests.check((select amount from public.payouts where trip_id = tests.id('itrip') and kind = 'advance') = 29100, 'advance payout queued');
select public.rate_trip(tests.id('itrip'), 5, 'Great', array['pays_fast']);
select tests.expect_error(format('select public.rate_trip(%L, 5, null, array[''made_up''])', tests.get('itrip')), 'check');
select tests.act_as('booker');
select public.rate_trip(tests.id('itrip'), 5, 'Careful driver', array['on_time', 'careful']);
select tests.check((select compliments @> array['careful'] and completed = 1 and on_time_pct = 100 from public.carrier_scores(array[tests.id('truckco')])), 'carrier score with compliments');
select tests.check(public.toggle_favourite(tests.id('truckco')), 'favourite after a trip together');

-- The waiting time and extras are still owed: no more bookings until paid; then a tip.
select tests.check((select balance = 6500 from public.trips where id = tests.id('itrip')), 'extras owed after delivery');
reset role;
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id) values (tests.id('itrip'), tests.id('owner'), 'mpesa', 6500, '254712000011', 'ws_CO_extras');
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id, purpose) values (tests.id('itrip'), tests.id('owner'), 'mpesa', 1000, '254712000011', 'ws_CO_tip', 'tip');
select tests.act_as_service();
select public.apply_mpesa_payment('ws_CO_extras', 'EXTRAS', 6500, '{}');
select public.apply_mpesa_payment('ws_CO_tip', 'TIP', 1000, '{}');
reset role;
select tests.check((select balance = 0 and tip = 1000 from public.trips where id = tests.id('itrip')), 'extras paid and tip recorded');
select tests.check((select amount = 1000 from public.payouts where trip_id = tests.id('itrip') and kind = 'tip'), 'the whole tip goes to the carrier');

-- The referred shipper's first completed trip rewards the owner who referred them.
select tests.act_as('referred');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes)
values (auth.uid(), 'nairobi', 'nakuru', current_date + 3, 'general', 'Referred load', 5, 'trailer', 200, 44000, 44000, false);
select tests.set('rload', (select id::text from public.loads where cargo_description = 'Referred load'));
select tests.act_as('truckco');
select tests.set('rtrip', public.instant_book(tests.id('rload'))::text);
select tests.act_as('referred');
select tests.check(public.pay_with_wallet(tests.id('rtrip')) = 1000, 'welcome credit pays part of the trip');
select tests.check(public.wallet_balance() = 0, 'wallet used up');
select tests.expect_error(format('select public.apply_promo(%L, ''KARIBU10'')', tests.get('rtrip')), 'before you pay');
reset role;
insert into public.payments (trip_id, shipper_id, method, amount, phone, checkout_request_id) values (tests.id('rtrip'), tests.id('referred'), 'mpesa', 43000, '254712000015', 'ws_CO_ref');
select tests.act_as_service();
select public.apply_mpesa_payment('ws_CO_ref', 'REF', 43000, '{}');
select tests.act_as('truckco');
select public.assign_trip(tests.id('rtrip'), tests.id('ftruck'), tests.id('fdriver'));
select public.carrier_update_trip(tests.id('rtrip'), 'to_pickup');

-- Cancelling once the truck has set off: a fee for the carrier, the rest back to the wallet.
select tests.act_as('referred');
select public.cancel_booking(tests.id('rtrip'), 'Goods not ready');
select tests.check((select status = 'cancelled' and cancel_fee = 4400 from public.trips where id = tests.id('rtrip')), '10% cancellation fee once the truck is on its way');
select tests.check(public.wallet_balance() = 44000 - 4400, 'the rest goes back to the wallet');
select tests.check((select status from public.loads where id = tests.id('rload')) = 'cancelled', 'a load cancelled after dispatch is closed');
select tests.act_as('truckco');
select tests.check((select amount = 4400 - 440 from public.payouts where trip_id = tests.id('rtrip') and kind = 'cancellation'), 'carrier gets the fee less commission');
select tests.check(not exists (select 1 from public.referral_rewards), 'no referral reward for a cancelled trip');

-- Cash-out of the wallet to M-Pesa, and ops cancelling a cash-out puts it back.
select tests.act_as('referred');
select tests.expect_error('select public.request_cashout(1000000, ''254712000015'')', 'more than your wallet');
select tests.set('refund', public.request_cashout(30000, '254712000015')::text);
select tests.check(public.wallet_balance() = 9600, 'cash-out leaves the wallet');
select tests.act_as('admin');
select public.admin_cancel_refund(tests.id('refund'), 'Wrong number');
select tests.act_as('referred');
select tests.check(public.wallet_balance() = 39600, 'cancelled cash-out goes back');

-- Carrier cancels before loading: the load goes back on the board and it counts against them.
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes)
values (auth.uid(), 'nairobi', 'kisumu', current_date + 3, 'general', 'Second referred load', 5, 'trailer', 400, 88000, 30000, false);
select tests.set('rload2', (select id::text from public.loads where cargo_description = 'Second referred load'));
select tests.act_as('truckco');
select tests.set('rtrip2', public.instant_book(tests.id('rload2'))::text);
select tests.act_as('referred');
select public.pay_with_wallet(tests.id('rtrip2'));
select tests.check((select status from public.trips where id = tests.id('rtrip2')) = 'scheduled', 'paid from the wallet');
select tests.act_as('truckco');
select tests.expect_error(format('select public.carrier_cancel_trip(%L, ''no'')', tests.get('rtrip2')), 'at least 5');
select public.carrier_cancel_trip(tests.id('rtrip2'), 'Truck broke down');
select tests.check((select cancellations = 1 from public.carriers where id = auth.uid()), 'carrier cancellation counted');
select tests.act_as('referred');
select tests.check((select status from public.loads where id = tests.id('rload2')) = 'open', 'load back on the board');
select tests.check(public.wallet_balance() = 39600, 'full refund to the wallet when the carrier cancels');

-- Credit for the business: approved by ops, dispatch now, pay on invoice.
select tests.act_as('booker');
select tests.expect_error('select public.request_credit()', 'account owner');
select tests.act_as('owner');
select public.request_credit();
select tests.act_as('admin');
select public.admin_decide_credit(tests.id('owner'), 'approved', 100000, 30, 'Two years of bank statements');
select tests.act_as('booker');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes, instant_book)
values (tests.id('owner'), 'nairobi', 'eldoret', current_date + 2, 'fmcg', 'Credit load', 10, 'trailer', 390, 86000, 86000, false, false);
select tests.set('cload', (select id::text from public.loads where cargo_description = 'Credit load'));
select tests.act_as('truckco');
select tests.expect_error(format('select public.instant_book(%L)', tests.get('cload')), 'wants bids');
select tests.set('cbid', (public.place_bid(tests.id('cload'), 86000)).id::text);
select tests.act_as('booker');
select tests.set('ctrip', public.accept_bid(tests.id('cbid'))::text);
select public.book_on_credit(tests.id('ctrip'));
select tests.check((select status = 'scheduled' and on_credit and credit_due_on = current_date + 30 from public.trips where id = tests.id('ctrip')), 'booked on credit');

-- Damage claim split: part of the payout goes to the shipper's wallet.
select tests.act_as('truckco');
select public.assign_trip(tests.id('ctrip'), tests.id('ftruck'), tests.id('fdriver'));
select public.carrier_update_trip(tests.id('ctrip'), 'to_pickup');
select public.carrier_update_trip(tests.id('ctrip'), 'loaded');
select public.carrier_update_trip(tests.id('ctrip'), 'in_transit');
select public.carrier_update_trip(tests.id('ctrip'), 'delivered');
select tests.check((select status from public.trips where id = tests.id('ctrip')) = 'delivered', 'codes are optional when the shipper turns them off');
select tests.act_as('booker');
select public.raise_dispute(tests.id('ctrip'), 'Five cartons crushed in transit', 5000);
select tests.act_as('admin');
select tests.expect_error(format('select public.admin_resolve_dispute(%L, ''split'', ''x'', 999999)', tests.get('ctrip')), 'between 1 and the payout');
select public.admin_resolve_dispute(tests.id('ctrip'), 'split', 'Carrier accepts the damage', 5000);
select tests.act_as('owner');
select tests.check(public.wallet_balance() = 5000, 'claim credited to the business wallet');
select tests.act_as('truckco');
select tests.check((select amount from public.payouts where trip_id = tests.id('ctrip') and kind = 'trip') = 86000 - 8600 - 5000, 'claim taken from the payout');

-- Truck watch flags a live trip that has gone quiet.
select tests.act_as('referred');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes)
values (auth.uid(), 'nairobi', 'nyeri', current_date + 3, 'general', 'Watch load', 5, 'trailer', 150, 33000, 33000, false);
select tests.act_as('truckco');
select tests.set('wtrip', public.instant_book((select id from public.loads where cargo_description = 'Watch load'))::text);
select tests.act_as('referred');
select public.pay_with_wallet(tests.id('wtrip'));
select tests.act_as('truckco');
select public.assign_trip(tests.id('wtrip'), tests.id('ftruck'), tests.id('fdriver'));
select public.carrier_update_trip(tests.id('wtrip'), 'to_pickup');
reset role;
update public.trip_events set created_at = now() - interval '4 hours' where trip_id = tests.id('wtrip');
select tests.act_as_service();
select tests.check(jsonb_array_length(public.run_watch_jobs() -> 'alerts') = 1, 'quiet truck flagged');
select tests.check(jsonb_array_length(public.run_watch_jobs() -> 'alerts') = 0, 'flagged once, not every run');
reset role;
select tests.check((select alert = 'no_signal' from public.trips where id = tests.id('wtrip')), 'no-signal alert on the trip');

-- A Google sign-up with a referral code gets the same welcome credit as an email sign-up, once.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000016', 'google2@vemi.test', '{"full_name":"Google Shipper"}');
select tests.set('google2', '00000000-0000-0000-0000-000000000016');
select tests.act_as('google2');
select public.choose_role('shipper', '254712000016', 'Google Traders', lower(tests.get('owner_code')));
reset role;
select tests.check((select referred_by = tests.id('owner') and onboarded from public.profiles where id = tests.id('google2')), 'Google sign-up keeps the referral');
select tests.check(private.wallet_balance_of(tests.id('google2')) = 1000, 'Google sign-up with a code gets welcome credit');
