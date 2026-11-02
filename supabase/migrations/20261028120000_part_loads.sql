-- Part loads ("share a truck"): a shipper with a few tonnes pays for their share of a lorry instead of a whole
-- one, and the carrier fills the truck with other part loads going the same way. Each part load is still its
-- own load and its own trip (own price, payment, codes and tracking); they just ride on the same truck.
-- Runs after 20261028090000_border_papers.sql.

alter table public.loads
  add column part_load boolean not null default false,
  add constraint loads_part_load_truck check (not part_load or truck_type in ('lorry_7t', 'lorry_10t', 'lorry_14t', 'trailer', 'reefer'));
create index loads_part_board on public.loads (pickup_date) where status = 'open' and part_load;

grant insert (part_load) on public.loads to authenticated;

-- Assigning a truck now checks it has room when it carries part loads: the loads on its open trips picking up
-- within a day of this one may not weigh more than the truck carries. Whole loads on back-to-back days still
-- work as before.
create or replace function public.assign_trip(p_trip uuid, p_truck uuid, p_driver uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  l public.loads;
  v_capacity numeric;
  v_carried numeric;
begin
  select * into t from public.trips where id = p_trip for update;
  if not found or t.carrier_id is distinct from auth.uid() then raise exception 'Trip not found.'; end if;
  if t.status not in ('awaiting_payment', 'scheduled', 'to_pickup') then raise exception 'The truck and driver cannot be changed after loading.'; end if;
  select capacity_tonnes into v_capacity from public.trucks where id = p_truck and carrier_id = auth.uid() and active;
  if not found then raise exception 'Choose one of your active trucks.'; end if;
  if not exists (select 1 from public.drivers where id = p_driver and carrier_id = auth.uid() and active) then raise exception 'Choose one of your active drivers.'; end if;
  select * into l from public.loads where id = t.load_id;
  select coalesce(sum(ol.weight_tonnes), 0) into v_carried
  from public.trips o join public.loads ol on ol.id = o.load_id
  where o.truck_id = p_truck and o.id <> p_trip
    and o.status in ('awaiting_payment', 'scheduled', 'to_pickup', 'at_pickup', 'loaded', 'in_transit', 'at_border', 'at_dropoff')
    and abs(ol.pickup_date - l.pickup_date) <= 1
    and (ol.part_load or l.part_load);
  if v_carried > 0 and v_carried + l.weight_tonnes > v_capacity then
    raise exception 'That truck already carries % t around that day and takes % t. Choose another truck.', trim(to_char(v_carried, 'FM999990.0')), trim(to_char(v_capacity, 'FM999990.0'));
  end if;
  update public.trips set truck_id = p_truck, driver_id = p_driver where id = p_trip returning * into t;
  perform private.log_event(p_trip, t.status, 'carrier', 'Truck and driver assigned');
end $$;

revoke all on function public.assign_trip(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_trip(uuid, uuid, uuid) to authenticated;
