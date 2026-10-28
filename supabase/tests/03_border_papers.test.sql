-- Border papers on a trip: who can add, see and remove them, the driver link, and the daily reminder.
-- Runs after 02 on the same database and reuses its people (referred = shipper, truckco = carrier).

select tests.check(not has_function_privilege('authenticated', 'public.driver_add_trip_document(text, text, text, text)', 'execute'), 'only the server adds papers for drivers');
select tests.check(not has_function_privilege('authenticated', 'public.papers_reminders()', 'execute'), 'paper reminders are server only');
select tests.check(not has_table_privilege('authenticated', 'public.trip_documents', 'insert'), 'papers are added through the function only');

-- A cross-border load, booked and paid, picking up tomorrow.
select tests.act_as('referred');
insert into public.loads (shipper_id, origin_id, destination_id, pickup_date, cargo_type, cargo_description, weight_tonnes, truck_type, distance_km, border_crossings, guide_price, price, require_codes)
values (auth.uid(), 'mombasa', 'kampala', current_date + 1, 'general', 'Border load', 20, 'trailer', 1150, 1, 260000, 260000, false);
select tests.act_as('truckco');
select tests.set('btrip', public.instant_book((select id from public.loads where cargo_description = 'Border load'))::text);
reset role;
select tests.set('btoken', (select driver_token from public.trips where id = tests.id('btrip')));
update public.trips set status = 'scheduled' where id = tests.id('btrip');

-- The daily job flags it once while the customs entry is missing.
select tests.act_as_service();
select tests.check((select count(*) from jsonb_array_elements(public.papers_reminders()) e where (e ->> 'id')::uuid = tests.id('btrip')) = 1, 'missing customs entry flagged');
select tests.check((select count(*) from jsonb_array_elements(public.papers_reminders()) e where (e ->> 'id')::uuid = tests.id('btrip')) = 0, 'flagged once');

-- The shipper adds the customs entry number and an invoice file in the trip's folder.
select tests.act_as('referred');
select tests.set('entry', public.add_trip_document(tests.id('btrip'), 'customs_entry', ' 2026MSA1234567 ')::text);
select public.add_trip_document(tests.id('btrip'), 'commercial_invoice', null, tests.get('btrip') || '/invoice.pdf');
select tests.expect_error(format('select public.add_trip_document(%L, ''packing_list'', null, %L)', tests.get('btrip'), tests.get('wtrip') || '/x.pdf'), 'does not belong');
select tests.expect_error(format('select public.add_trip_document(%L, ''packing_list'', null, %L)', tests.get('btrip'), tests.get('btrip') || '/../x.pdf'), 'does not belong');
select tests.expect_error(format('select public.add_trip_document(%L, ''packing_list'', ''  '')', tests.get('btrip')), 'reference number or a file');
select tests.expect_error(format('select public.add_trip_document(%L, ''passport'', ''X1'')', tests.get('btrip')), 'check');
select tests.check((select reference from public.trip_documents where id = tests.id('entry')) = '2026MSA1234567', 'reference trimmed');
select tests.expect_error('select added_by from public.trip_documents', 'permission denied');

-- The carrier sees them and adds the seal; strangers see nothing and cannot add.
select tests.act_as('truckco');
select tests.check((select count(*) from public.trip_documents where trip_id = tests.id('btrip')) = 2, 'carrier sees the papers');
select public.add_trip_document(tests.id('btrip'), 'rects_seal', 'KRA-SEAL-0098');
select tests.expect_error(format('select public.remove_trip_document(%L)', tests.get('entry')), 'only remove papers you added');
select tests.act_as('owner');
select tests.check((select count(*) from public.trip_documents where trip_id = tests.id('btrip')) = 0, 'other shippers see nothing');
select tests.expect_error(format('select public.add_trip_document(%L, ''other'', ''X'')', tests.get('btrip')), 'Trip not found');
select tests.act_as('google');
select tests.check((select count(*) from public.trip_documents where trip_id = tests.id('btrip')) = 0, 'other carriers see nothing');

-- The driver adds the stamped release through the trip link.
select tests.act_as_service();
select public.driver_add_trip_document(tests.get('btoken'), 'border_release', 'Malaba stamp', tests.get('btrip') || '/release.jpg');
select tests.expect_error(format('select public.driver_add_trip_document(%L, ''other'', ''X'')', 'not-a-token'), 'not valid');
reset role;
select tests.check((select added_as from public.trip_documents where trip_id = tests.id('btrip') and kind = 'border_release') = 'driver', 'driver paper recorded');

-- The shipper removes their own paper; nobody can change papers once the trip is closed.
select tests.act_as('referred');
select tests.check(public.remove_trip_document(tests.id('entry')) is null, 'reference-only paper removed, no file to delete');
reset role;
update public.trips set status = 'completed' where id = tests.id('btrip');
select tests.act_as('referred');
select tests.expect_error(format('select public.add_trip_document(%L, ''other'', ''Late'')', tests.get('btrip')), 'closed');
select tests.expect_error(format('select public.remove_trip_document(%L)', (select id from public.trip_documents where kind = 'commercial_invoice' and trip_id = tests.id('btrip'))), 'only remove papers you added');
reset role;
