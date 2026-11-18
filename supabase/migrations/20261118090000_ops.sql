-- Operations for a one-person team: an error log, "last ran" times for the cron jobs, and rate limits that work
-- across Vercel's many short-lived server instances (an in-memory counter would reset on every cold start).
-- Only the server (service role) touches these tables: row-level security is on and there are no policies.

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null,
  message text not null,
  detail jsonb
);
create index if not exists app_events_at_idx on public.app_events (at desc);
alter table public.app_events enable row level security;

create table if not exists public.app_status (
  key text primary key,
  at timestamptz not null default now(),
  detail jsonb
);
alter table public.app_status enable row level security;

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;

revoke all on public.app_events, public.app_status, public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.app_events, public.app_status, public.rate_limits to service_role;
grant usage on sequence public.app_events_id_seq to service_role;

-- One call per request: counts the hit and says whether it is within the limit. A new window starts once the old
-- one has passed. Row lock on the key, so two requests at once are both counted.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Housekeeping from the daily cron: errors are kept 30 days, finished rate-limit windows one day.
create or replace function public.prune_ops_tables()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with e as (delete from public.app_events where at < now() - interval '30 days' returning 1),
       r as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select jsonb_build_object('events', (select count(*) from e), 'rate_limits', (select count(*) from r));
$$;
revoke all on function public.prune_ops_tables() from public, anon, authenticated;
grant execute on function public.prune_ops_tables() to service_role;
