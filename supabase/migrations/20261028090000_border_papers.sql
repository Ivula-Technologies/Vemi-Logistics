-- Border papers: the customs and transit documents a cross-border truck needs at the border (customs entry or
-- T1, electronic seal number, invoice, packing list, certificate of origin, permits), kept on the trip so the
-- shipper or their clearing agent, the carrier and the driver all see the same set. A missing customs entry is
-- the most common reason a truck sits at Malaba or Busia for days.

create table public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null check (kind in ('customs_entry', 'rects_seal', 'commercial_invoice', 'packing_list', 'certificate_of_origin', 'permit', 'border_release', 'other')),
  reference text check (char_length(reference) between 1 and 80),
  path text,
  added_by uuid references auth.users (id) on delete set null,
  added_as text not null check (added_as in ('shipper', 'carrier', 'driver', 'admin')),
  created_at timestamptz not null default now(),
  check (reference is not null or path is not null)
);
create index trip_documents_trip on public.trip_documents (trip_id, created_at);

alter table public.trips add column papers_reminded_at timestamptz;

alter table public.trip_documents enable row level security;
revoke all on public.trip_documents from anon, authenticated;
grant select (id, trip_id, kind, reference, path, added_as, created_at) on public.trip_documents to authenticated;
create policy trip_documents_read on public.trip_documents for select to authenticated using (private.trip_party(trip_id) or private.is_admin());

-- Files must sit in the trip's own folder, so nobody can point a document at someone else's file.
create function private.trip_document_path_ok(p_trip uuid, p_path text) returns boolean language sql immutable as $$
  select p_path is null or (p_path like p_trip::text || '/%' and p_path !~ '\.\.')
$$;

create function public.add_trip_document(p_trip uuid, p_kind text, p_reference text default null, p_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_as text;
  v_id uuid;
begin
  select * into t from public.trips where id = p_trip;
  if not found then raise exception 'Trip not found.'; end if;
  if private.is_admin() then v_as := 'admin';
  elsif t.carrier_id = auth.uid() then v_as := 'carrier';
  elsif t.shipper_id = private.shipper_account() then v_as := 'shipper';
  else raise exception 'Trip not found.';
  end if;
  if t.status in ('completed', 'cancelled') then raise exception 'This trip is closed.'; end if;
  if nullif(trim(p_reference), '') is null and p_path is null then raise exception 'Add a reference number or a file.'; end if;
  if not private.trip_document_path_ok(p_trip, p_path) then raise exception 'That file does not belong to this trip.'; end if;
  insert into public.trip_documents (trip_id, kind, reference, path, added_by, added_as)
  values (p_trip, p_kind, nullif(trim(p_reference), ''), p_path, auth.uid(), v_as)
  returning id into v_id;
  return v_id;
end $$;

-- Removes a paper the caller added (admins can remove any). Returns the file path so the app can delete the file.
create function public.remove_trip_document(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_path text;
begin
  delete from public.trip_documents d
  where d.id = p_id and (d.added_by = auth.uid() or private.is_admin())
    and exists (select 1 from public.trips t where t.id = d.trip_id and t.status not in ('completed', 'cancelled'))
  returning d.path into v_path;
  if not found then raise exception 'You can only remove papers you added, on an open trip.'; end if;
  return v_path;
end $$;

-- The driver (no login, trip link) adds what they get on the way: the seal number, a photo of the stamped release.
create function public.driver_add_trip_document(p_token text, p_kind text, p_reference text default null, p_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_id uuid;
begin
  select * into t from public.trips where driver_token = p_token and status in ('scheduled', 'to_pickup', 'loaded', 'in_transit', 'at_border', 'delivered');
  if not found then raise exception 'This trip link is not valid any more.'; end if;
  if nullif(trim(p_reference), '') is null and p_path is null then raise exception 'Add a reference number or a photo.'; end if;
  if not private.trip_document_path_ok(t.id, p_path) then raise exception 'That file does not belong to this trip.'; end if;
  insert into public.trip_documents (trip_id, kind, reference, path, added_as)
  values (t.id, p_kind, nullif(trim(p_reference), ''), p_path, 'driver')
  returning id into v_id;
  return v_id;
end $$;

-- Daily: cross-border trips picking up within a day that still have no customs entry. Each is returned once.
create function public.papers_reminders() returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  with due as (
    update public.trips t set papers_reminded_at = now()
    from public.loads l
    where l.id = t.load_id and l.border_crossings > 0
      and t.status in ('scheduled', 'to_pickup') and t.papers_reminded_at is null
      and l.pickup_date <= private.eat_today() + 1
      and not exists (select 1 from public.trip_documents d where d.trip_id = t.id and d.kind = 'customs_entry')
    returning t.id, t.ref, t.shipper_id, t.carrier_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ref', ref, 'shipper_id', shipper_id, 'carrier_id', carrier_id)), '[]'::jsonb) into v from due;
  return v;
end $$;

revoke all on function public.add_trip_document(uuid, text, text, text), public.remove_trip_document(uuid),
  public.driver_add_trip_document(text, text, text, text), public.papers_reminders() from public, anon, authenticated;
revoke all on function private.trip_document_path_ok(uuid, text) from public, anon, authenticated;
grant execute on function public.add_trip_document(uuid, text, text, text), public.remove_trip_document(uuid) to authenticated;
grant execute on function public.driver_add_trip_document(text, text, text, text), public.papers_reminders() to service_role;

-- Customs papers: photos and PDFs, private, served through the app after an access check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('trip-docs', 'trip-docs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
