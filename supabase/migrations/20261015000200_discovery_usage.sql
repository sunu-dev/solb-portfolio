-- Additive allowlist expansion. Older clients remain compatible. No new personal data.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
alter table public.usage_samples drop constraint if exists usage_samples_event_check;
alter table public.usage_samples add constraint usage_samples_event_check
 check (event in ('view','explore_step','related_company','brief_read','fresh_news_open','learning_open','learning_read','learning_continue')) not valid;
alter table public.usage_samples validate constraint usage_samples_event_check;
commit;
notify pgrst, 'reload schema';
