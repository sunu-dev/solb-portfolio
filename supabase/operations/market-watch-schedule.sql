-- Re-running cron.schedule with a named job updates it rather than duplicating it.
select cron.schedule('joobi-market-watch', '*/10 * * * *',
  $$select public.enqueue_market_watch('market');$$);
select cron.schedule('joobi-industry-watch', '5 */2 * * *',
  $$select public.enqueue_market_watch('industries');$$);
select jobname, schedule, active from cron.job
  where jobname in ('joobi-market-watch', 'joobi-industry-watch');
