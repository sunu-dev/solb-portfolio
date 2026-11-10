-- Keep the minute scheduler, but avoid pg_net queue/response writes and two worker
-- RPCs when no delivery, expiry, abandoned lease, or failure report needs work.
create index if not exists digest_deliveries_unreported_failures
  on public.digest_deliveries(id)
  where status = 'failed' and failure_reported_at is null;

create or replace function public.enqueue_digest_retry()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare token text;
begin
  if not exists (
    select 1 from public.digest_deliveries
    where status in ('pending', 'retryable', 'sending') and (
      deadline_at <= now()
      or (status = 'sending' and lease_until < now() and (channel = 'push' or attempts >= 3))
      or (deadline_at > now() and attempts < 3 and next_attempt_at <= now()
        and (status in ('pending', 'retryable')
          or (channel = 'email' and status = 'sending' and lease_until < now())))
    )
  ) and not exists (
    select 1 from public.digest_deliveries
    where status = 'failed' and failure_reported_at is null
  ) then
    return null;
  end if;

  select decrypted_secret into token from vault.decrypted_secrets
    where name = 'joobi_market_watch_cron_secret';
  if token is null or length(token) = 0 then raise exception 'Scheduler credential missing'; end if;
  return net.http_get(url := 'https://joobi.kr/api/cron/digest-retry',
    headers := jsonb_build_object('Authorization', 'Bearer ' || token), timeout_milliseconds := 60000);
end;
$$;
revoke all on function public.enqueue_digest_retry() from public, anon, authenticated, service_role;
