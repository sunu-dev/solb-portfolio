-- Active foreground time only. Service-role ingestion; no client read/write policies.
create table if not exists public.usage_samples (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  visitor_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_ms integer not null check (active_ms >= 0 and active_ms <= 60000),
  feature text not null check (feature in ('portfolio','analysis','chart','news','fundamentals','assistant','learning','company','insights','other')),
  event text check (event in ('view','explore_step','related_company')),
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (visitor_id is null)),
  check (ended_at >= started_at and ended_at - started_at <= interval '60 seconds'),
  check (active_ms <= extract(epoch from ended_at - started_at) * 1000),
  check (active_ms > 0 or event is not null)
);
alter table public.usage_samples enable row level security;
revoke all on public.usage_samples from anon, authenticated;
grant all on public.usage_samples to service_role;
create index if not exists usage_samples_start_idx on public.usage_samples (started_at, id);
create index if not exists usage_samples_user_idx on public.usage_samples (user_id, started_at);
comment on table public.usage_samples is 'Active usage, retained for 30 days by cleanup-pii. UUID batch IDs make retries idempotent. No portfolio, symbol, text or URL stored.';
notify pgrst, 'reload schema';
