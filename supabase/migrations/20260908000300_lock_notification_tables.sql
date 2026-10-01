-- Apply AFTER deploying the service-client push subscribe route.
-- Server-only tables: authenticated users must use the authenticated API.
-- No application data is modified or deleted.
begin;
alter table public.push_subscriptions enable row level security;
alter table public.sent_alerts enable row level security;
revoke all on table public.push_subscriptions, public.sent_alerts from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions, public.sent_alerts to service_role;
notify pgrst, 'reload schema';
commit;
