-- Tester accounts and sample loads, so people trying the phone app can sign in straight away.
-- Run once in the Supabase SQL Editor AFTER the four migrations. Safe to run again (it skips what exists).
-- Every tester account uses the password VemiTest#2026. Delete these accounts before real launch
-- (Authentication → Users), or change their passwords.

do $$
declare
  v_pw text := extensions.crypt('VemiTest#2026', extensions.gen_salt('bf'));
  v_person record;
  v_id uuid;
begin
  for v_person in
    select * from (values
      ('tester.shipper@ivulatechnologies.com', 'shipper', 'Amina Wanjiru (tester)', '254700100001', 'Tester Foods Ltd'),
      ('tester.carrier@ivulatechnologies.com', 'carrier', 'Otieno Haulage (tester)', '254700100002', 'Otieno Haulage'),
      ('tester.admin@ivulatechnologies.com', 'shipper', 'Vemi Ops (tester)', '254700100003', 'Vemi')
    ) as p(email, role, full_name, phone, company)
  loop
    select id into v_id from auth.users where email = v_person.email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_person.email, v_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('role', v_person.role, 'full_name', v_person.full_name, 'phone', v_person.phone, 'company', v_person.company),
        now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_person.email, 'email_verified', true), 'email', now(), now(), now());
    end if;
  end loop;
end $$;

-- Ops tester: the admin screens (verify carriers, record bank payments, payouts).
update public.profiles set role = 'admin', onboarded = true where id = (select id from auth.users where email = 'tester.admin@ivulatechnologies.com');
update public.profiles set onboarded = true where id in (select id from auth.users where email like 'tester.%@ivulatechnologies.com');

-- Carrier tester: verified, with a trailer, a lorry, a driver and an M-Pesa payout number.
insert into public.carriers (id, business_name, base_town, cross_border, countries, status, verified_at)
select id, 'Otieno Haulage (tester)', 'Mombasa', true, '{KE,UG,TZ}', 'verified', now() from auth.users where email = 'tester.carrier@ivulatechnologies.com'
on conflict (id) do update set status = 'verified', verified_at = coalesce(public.carriers.verified_at, now());
insert into public.carrier_private (carrier_id, payout_phone, payout_name)
select id, '254700100002', 'Otieno Haulage' from auth.users where email = 'tester.carrier@ivulatechnologies.com'
on conflict (carrier_id) do nothing;
insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes, make_model)
select u.id, t.plate, t.truck_type, t.capacity, t.make from auth.users u,
  (values ('KTST 001A', 'trailer', 28.0, 'Mercedes Actros (tester)'), ('KTST 002B', 'lorry_10t', 10.0, 'Isuzu FSR (tester)')) as t(plate, truck_type, capacity, make)
where u.email = 'tester.carrier@ivulatechnologies.com'
  and not exists (select 1 from public.trucks k where upper(replace(k.plate, ' ', '')) = upper(replace(t.plate, ' ', '')));
insert into public.drivers (carrier_id, full_name, phone, licence_no, language)
select id, 'Juma Mwangi (tester driver)', '254700100004', 'DLTEST01', 'sw' from auth.users u
where email = 'tester.carrier@ivulatechnologies.com' and not exists (select 1 from public.drivers d where d.carrier_id = u.id);

-- Sample open loads from the shipper tester, picking up in two and three days.
insert into public.loads (shipper_id, origin_id, origin_detail, destination_id, destination_detail, pickup_date, cargo_type, cargo_description,
  weight_tonnes, truck_type, distance_km, border_crossings, guide_price, price, instant_book, require_codes, part_load)
select u.id, l.origin, l.origin_detail, l.destination, l.destination_detail, current_date + l.days, l.cargo, l.description,
  l.tonnes, l.truck, l.km, l.borders, l.price, l.price, true, true, l.part
from auth.users u, (values
  ('mombasa', 'Changamwe, ICD gate 2', 'nairobi', 'Industrial Area, Enterprise Rd', 2, 'fmcg', 'Cooking oil, 1,200 cartons on pallets (sample load)', 24.0, 'trailer', 550, 0, 121000, false),
  ('nairobi', 'Baba Dogo Rd', 'kampala', 'Nakawa industrial area', 3, 'general', 'Hardware and roofing sheets (sample cross-border load)', 26.0, 'trailer', 820, 1, 196500, false),
  ('mombasa', 'Shimanzi godowns', 'nairobi', 'Ruaraka', 2, 'agricultural', 'Fertiliser, 120 bags on 3 pallets (sample part load)', 3.0, 'trailer', 550, 0, 36500, true)
) as l(origin, origin_detail, destination, destination_detail, days, cargo, description, tonnes, truck, km, borders, price, part)
where u.email = 'tester.shipper@ivulatechnologies.com'
  and not exists (select 1 from public.loads x where x.shipper_id = u.id and x.cargo_description = l.description and x.status = 'open');
update public.loads set announced_at = now() where announced_at is null and cargo_description like '%(sample%';
insert into public.load_contacts (load_id, pickup_name, pickup_phone, dropoff_name, dropoff_phone)
select l.id, 'Warehouse desk (tester)', '254700100005', 'Receiving bay (tester)', '254700100006' from public.loads l
where l.cargo_description like '%(sample%' and not exists (select 1 from public.load_contacts c where c.load_id = l.id);
