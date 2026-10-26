-- Test helpers: create users, act as them (role + JWT claims, as PostgREST would), keep ids
-- between steps and assert that a statement fails with the expected message.
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.ctx (key text primary key, value text);
grant all on tests.ctx to anon, authenticated, service_role;

create function tests.set(p_key text, p_value text) returns void language sql as $$
  insert into tests.ctx values (p_key, p_value) on conflict (key) do update set value = excluded.value
$$;
create function tests.get(p_key text) returns text language plpgsql as $$
declare v text;
begin
  select value into v from tests.ctx where key = p_key;
  if v is null then raise exception 'test context has no %', p_key; end if;
  return v;
end $$;
create function tests.id(p_key text) returns uuid language sql as $$ select tests.get(p_key)::uuid $$;

create function tests.new_user(p_key text, p_email text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v, p_email);
  perform tests.set(p_key, v::text);
  return v;
end $$;

-- Switches to the API role for a user. aal2 means they have passed two-factor verification.
create function tests.act_as(p_key text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', tests.get(p_key), 'role', 'authenticated', 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;

create function tests.act_as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;

create function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;

create function tests.expect_error(p_sql text, p_message text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_message is not null and sqlerrm not ilike '%' || p_message || '%' then
      raise exception 'Wrong error for: %   got: %   wanted: %', p_sql, sqlerrm, p_message;
    end if;
    return;
  end;
  raise exception 'Expected an error (%) from: %', coalesce(p_message, 'any'), p_sql;
end $$;

create function tests.check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAILED: %', p_what;
  end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
