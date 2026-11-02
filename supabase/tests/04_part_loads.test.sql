-- Part loads: a shared truck takes several shippers' loads, but never more than it carries.
-- Runs after 02 and 03 on the same database and reuses their people (referred = shipper, truckco = carrier).

-- Only trucks that can carry several shippers' goods take part loads.
select tests.act_as('referred');
select tests.expect_error($$insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes, part_load)
  values (auth.uid(), 'mombasa', 'nairobi', current_date + 2, 'fuel_liquid', 'Shared tanker', 5, 'tanker', 480, 20000, 20000, false, true)$$, 'loads_part_load_truck');

-- Three part loads on the same lane: 16 t, 14 t and 10 t, for a 28 t trailer.
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, guide_price, price, require_codes, part_load) values
  (auth.uid(), 'mombasa', 'nairobi', current_date + 2, 'general', 'Part A', 16, 'trailer', 480, 70000, 70000, false, true),
  (auth.uid(), 'mombasa', 'nairobi', current_date + 2, 'general', 'Part B', 14, 'trailer', 480, 60000, 60000, false, true),
  (auth.uid(), 'mombasa', 'nairobi', current_date + 3, 'general', 'Part C', 10, 'trailer', 480, 45000, 45000, false, true);
select tests.check((select count(*) from public.loads where part_load and cargo_description like 'Part %') = 3, 'part loads posted');

select tests.act_as('truckco');
insert into public.trucks (carrier_id, plate, truck_type, capacity_tonnes) values (auth.uid(), 'KDG 888G', 'trailer', 28);
select tests.set('ptruck', (select id::text from public.trucks where plate = 'KDG 888G'));
select tests.check((select count(*) from public.loads where part_load and status = 'open' and cargo_description like 'Part %') = 3, 'carriers see the part loads');
select tests.set('pa', public.instant_book((select id from public.loads where cargo_description = 'Part A'))::text);
select tests.set('pb', public.instant_book((select id from public.loads where cargo_description = 'Part B'))::text);
select tests.set('pc', public.instant_book((select id from public.loads where cargo_description = 'Part C'))::text);

-- 16 t goes on; 14 t more would be 30 t on a 28 t trailer; 10 t (picking up the next day) still fits.
select public.assign_trip(tests.id('pa'), tests.id('ptruck'), tests.id('fdriver'));
select tests.expect_error(format('select public.assign_trip(%L, %L, %L)', tests.get('pb'), tests.get('ptruck'), tests.get('fdriver')), 'already carries 16.0 t');
select public.assign_trip(tests.id('pc'), tests.id('ptruck'), tests.id('fdriver'));
select tests.check((select count(*) from public.trips where truck_id = tests.id('ptruck') and id in (tests.id('pa'), tests.id('pc'))) = 2, 'two part loads share the trailer');

-- Re-saving the same trip does not count its own load twice.
select public.assign_trip(tests.id('pa'), tests.id('ptruck'), tests.id('fdriver'));

-- Once the 16 t load leaves the truck (cancelled), the 14 t one fits next to the 10 t.
reset role;
update public.trips set status = 'cancelled' where id = tests.id('pa');
select tests.act_as('truckco');
select public.assign_trip(tests.id('pb'), tests.id('ptruck'), tests.id('fdriver'));
reset role;
