-- Common, source-backed market observations. No portfolio or user data is stored here.
create table if not exists public.market_watch_events (
  id text primary key,
  scope text not null check (scope in ('market', 'industries')),
  payload jsonb not null,
  last_observed_at timestamptz not null
);
create index if not exists market_watch_events_recent on public.market_watch_events(last_observed_at desc);
create table if not exists public.market_watch_runs (
  scope text primary key check (scope in ('market', 'industries')),
  last_run jsonb,
  last_attempt_at timestamptz,
  last_error text,
  lease_owner uuid,
  lease_until timestamptz
);
alter table public.market_watch_events enable row level security;
alter table public.market_watch_runs enable row level security;
revoke all on public.market_watch_events, public.market_watch_runs from public, anon, authenticated;
grant select, insert, update, delete on public.market_watch_events, public.market_watch_runs to service_role;

-- One collector per scope across function instances; a crashed collector cannot hold the lease forever.
create or replace function public.claim_market_watch(p_scope text, p_owner uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  insert into public.market_watch_runs(scope, lease_owner, lease_until, last_attempt_at)
  values (p_scope, p_owner, now() + interval '4 minutes', now())
  on conflict (scope) do update set lease_owner = p_owner, lease_until = now() + interval '4 minutes', last_attempt_at = now()
  where market_watch_runs.lease_until is null or market_watch_runs.lease_until < now();
  return found;
end;
$$;

-- Publish event rows and the run's coverage atomically. An expired collector cannot overwrite a newer run.
create or replace function public.publish_market_watch(p_scope text, p_owner uuid, p_events jsonb, p_run jsonb, p_error text default null)
returns boolean language plpgsql security invoker set search_path = public as $$
declare owned boolean;
begin
  select true into owned from public.market_watch_runs
  where scope = p_scope and lease_owner = p_owner and lease_until > now() for update;
  if owned is distinct from true then return false; end if;
  if p_error is null then
    insert into public.market_watch_events(id, scope, payload, last_observed_at)
    select event->>'id', p_scope, event, (event->>'lastObservedAt')::timestamptz
    from jsonb_array_elements(p_events) as event
    on conflict (id) do update set payload = excluded.payload, last_observed_at = excluded.last_observed_at
    where market_watch_events.scope = excluded.scope
      and market_watch_events.last_observed_at <= excluded.last_observed_at;
    delete from public.market_watch_events where last_observed_at < now() - interval '30 days';
  end if;
  update public.market_watch_runs set last_run = case when p_error is null then p_run else last_run end,
    last_error = p_error, lease_owner = null, lease_until = null where scope = p_scope;
  return true;
end;
$$;
revoke all on function public.claim_market_watch(text, uuid) from public, anon, authenticated;
revoke all on function public.publish_market_watch(text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_market_watch(text, uuid) to service_role;
grant execute on function public.publish_market_watch(text, uuid, jsonb, jsonb, text) to service_role;
