-- Private, immutable per-channel outbox. Apply before deploying the producer/worker.
create table if not exists public.digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('morning_brief', 'digest_kr_close')),
  sent_date date not null,
  channel text not null check (channel in ('email', 'push')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'retryable', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  deadline_at timestamptz not null default now() + interval '6 hours',
  lease_owner uuid,
  lease_until timestamptz,
  provider_id text,
  last_error text,
  failure_reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, notification_type, sent_date, channel)
);
alter table public.digest_deliveries enable row level security;
revoke all on public.digest_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.digest_deliveries to service_role;
create index if not exists digest_deliveries_due on public.digest_deliveries(next_attempt_at)
  where status in ('pending', 'retryable', 'sending');
-- Also safe if this migration is re-applied to an earlier staging copy.
alter table public.digest_deliveries add column if not exists failure_reported_at timestamptz;

-- SKIP LOCKED + lease token prevents two workers from owning the same attempt.
-- An email can safely retry an ambiguous timeout with its persisted provider idempotency key.
-- A push has no such provider guarantee: an abandoned send is terminal, not blindly repeated.
create or replace function public.claim_digest_deliveries(p_owner uuid, p_limit integer default 10)
returns setof public.digest_deliveries language plpgsql security invoker set search_path = '' as $$
begin
  update public.digest_deliveries set status = 'failed', updated_at = now(), lease_owner = null, lease_until = null,
    last_error = case when deadline_at <= now() then 'expired' else 'send_outcome_unknown' end
    where status in ('pending','retryable','sending') and
      (deadline_at <= now() or (status = 'sending' and lease_until < now() and (channel = 'push' or attempts >= 3)));
  return query
    with due as (
      select id from public.digest_deliveries
      where deadline_at > now() and attempts < 3 and next_attempt_at <= now()
        and (status in ('pending','retryable') or (channel = 'email' and status = 'sending' and lease_until < now()))
      order by next_attempt_at, created_at for update skip locked limit greatest(1, least(p_limit, 10))
    )
    update public.digest_deliveries as d set status = 'sending', attempts = d.attempts + 1,
      lease_owner = p_owner, lease_until = now() + interval '2 minutes', updated_at = now()
    from due where d.id = due.id returning d.*;
end;
$$;
revoke all on function public.claim_digest_deliveries(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_digest_deliveries(uuid, integer) to service_role;

-- Includes failures created inside claim_digest_deliveries, not only provider rejections.
-- Concurrent workers atomically consume different unreported failures; no recipient/body leaves SQL.
create or replace function public.claim_digest_failure_report()
returns integer language sql security invoker set search_path = '' as $$
  with unreported as (
    select id from public.digest_deliveries where status = 'failed' and failure_reported_at is null
    for update skip locked
  ), reported as (
    update public.digest_deliveries d set failure_reported_at = now()
    from unreported where d.id = unreported.id returning d.id
  ) select count(*)::integer from reported;
$$;
revoke all on function public.claim_digest_failure_report() from public, anon, authenticated;
grant execute on function public.claim_digest_failure_report() to service_role;

-- Existing Vault credential, restricted fixed destination. Scheduling is a separate post-deploy step.
create or replace function public.enqueue_digest_retry()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare token text;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'joobi_market_watch_cron_secret';
  if token is null or length(token) = 0 then raise exception 'Scheduler credential missing'; end if;
  return net.http_get(url := 'https://joobi.kr/api/cron/digest-retry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || token), timeout_milliseconds := 60000);
end;
$$;
revoke all on function public.enqueue_digest_retry() from public, anon, authenticated, service_role;
