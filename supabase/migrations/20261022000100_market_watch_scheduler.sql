-- Frequent collection uses the existing Supabase database scheduler.
-- Vercel Hobby permits daily schedules only; public reads never collect data.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Jobs contain only this function call. The bearer value stays in Vault.
create or replace function public.enqueue_market_watch(p_scope text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  token text;
  endpoint text;
begin
  if p_scope = 'market' then
    endpoint := '/api/cron/market-watch';
  elsif p_scope = 'industries' then
    endpoint := '/api/cron/industry-watch';
  else
    raise exception 'Unknown market watch scope';
  end if;

  select decrypted_secret into token from vault.decrypted_secrets
    where name = 'joobi_market_watch_cron_secret';
  if token is null or length(token) = 0 then
    raise exception 'Market watch scheduler secret is not configured';
  end if;

  return net.http_get(
    url := 'https://joobi.kr' || endpoint,
    headers := jsonb_build_object('Authorization', 'Bearer ' || token),
    timeout_milliseconds := 120000
  );
end;
$$;
revoke all on function public.enqueue_market_watch(text) from public, anon, authenticated, service_role;
revoke all on table net.http_request_queue, net._http_response from public, anon, authenticated;

-- Install/enable named jobs only after the routes are deployed and Vault is set.
-- See supabase/operations/market-watch-schedule.sql.
