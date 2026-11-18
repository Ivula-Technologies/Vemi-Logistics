-- Operations tables: rate limits count every hit, only the server can use them, and old rows are pruned.

select tests.act_as_service();
select tests.check(public.hit_rate_limit('test:ip', 2, 600), 'first hit allowed');
select tests.check(public.hit_rate_limit('test:ip', 2, 600), 'second hit allowed');
select tests.check(not public.hit_rate_limit('test:ip', 2, 600), 'third hit refused');
select tests.check(public.hit_rate_limit('test:other', 2, 600), 'other keys have their own count');

-- A finished window starts again.
update public.rate_limits set window_start = now() - interval '11 minutes' where key = 'test:ip';
select tests.check(public.hit_rate_limit('test:ip', 2, 600), 'new window after the old one passes');

-- People can't read or use them.
select tests.act_as('referred');
select tests.expect_error($$select public.hit_rate_limit('x', 1, 60)$$, 'permission denied');
select tests.expect_error($$select count(*) from public.app_events$$, 'permission denied');
select tests.act_as_anon();
select tests.expect_error($$select public.hit_rate_limit('x', 1, 60)$$, 'permission denied');

-- Pruning keeps recent rows.
select tests.act_as_service();
insert into public.app_events (at, source, message) values (now() - interval '31 days', 'test', 'old'), (now(), 'test', 'new');
update public.rate_limits set window_start = now() - interval '2 days' where key = 'test:other';
select public.prune_ops_tables();
select tests.check((select count(*) from public.app_events where source = 'test') = 1, 'old errors pruned, new kept');
select tests.check(not exists (select 1 from public.rate_limits where key = 'test:other'), 'old rate-limit rows pruned');
