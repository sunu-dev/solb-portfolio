-- Run only AFTER the migration and authenticated worker route are deployed.
-- Do not execute the worker manually against real recipients for a smoke test.
-- Ten leased messages per minute (up to 600/hour), independent of producer invocation time.
select cron.schedule('joobi-digest-retry', '* * * * *', 'select public.enqueue_digest_retry()');
-- Private queued message contents expire after 7 days; terminal status metrics can be aggregated first.
select cron.schedule('joobi-digest-retention', '25 19 * * *',
  $$delete from public.digest_deliveries where created_at < now() - interval '7 days'$$);
