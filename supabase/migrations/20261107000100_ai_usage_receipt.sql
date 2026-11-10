-- Reconcile a lost usage-write response without inserting/charging twice.
-- Nullable for existing application versions; no RLS or user-data changes.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '10s';
alter table public.ai_usage add column if not exists request_id uuid;
create unique index if not exists ai_usage_request_id_unique
  on public.ai_usage (request_id) where request_id is not null;
notify pgrst, 'reload schema';
commit;
