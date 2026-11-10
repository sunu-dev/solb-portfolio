-- No automatic conversation capture. Service-only tables; routes enforce ownership.
create table if not exists public.assistant_quality_events (
  id uuid primary key,
  created_at timestamptz not null,
  topic text not null check (topic in ('price_reason','buy_more','average_down','buy_timing','sell_timing','trending','definition','explain')),
  asset text not null check (asset in ('market','stock','fund','leveraged')),
  model text not null check (model in ('sonnet','haiku','other','none')),
  version text not null,
  outcome text not null check (outcome in ('ready','blocked','failed','limited')),
  failure text not null check (failure in ('none','validation','sources','usage','limit','other')),
  duration_ms integer not null check (duration_ms >= 0),
  sources_ms integer not null check (sources_ms >= 0),
  generation_ms integer not null check (generation_ms >= 0),
  received boolean not null default false
);
create index if not exists assistant_quality_events_created on public.assistant_quality_events(created_at);
create table if not exists public.assistant_quality_feedback (
  event_id uuid primary key references public.assistant_quality_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1,1)),
  reason text check (reason in ('unrelated','insufficient','difficult','incorrect','slow')),
  updated_at timestamptz not null default now()
);
create table if not exists public.assistant_quality_cases (
  event_id uuid primary key references public.assistant_quality_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 2 and 600),
  answer text not null check (char_length(answer) between 2 and 5000),
  consent_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  review_status text not null default 'new' check (review_status in ('new','reviewed','fixed')),
  issue text check (issue in ('unrelated','insufficient','difficult','incorrect','slow'))
);
create index if not exists assistant_quality_cases_owner on public.assistant_quality_cases(user_id, expires_at);
alter table public.assistant_quality_events enable row level security;
alter table public.assistant_quality_feedback enable row level security;
alter table public.assistant_quality_cases enable row level security;
revoke all on public.assistant_quality_events, public.assistant_quality_feedback, public.assistant_quality_cases from anon, authenticated;
grant all on public.assistant_quality_events, public.assistant_quality_feedback, public.assistant_quality_cases to service_role;

-- Aggregate in Postgres: no hidden first-1000-row sample, no account IDs in admin metrics.
create or replace function public.assistant_quality_summary()
returns jsonb language sql security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from (
    select e.topic, e.asset, e.model, e.version,
      count(*) as requests,
      count(*) filter (where e.outcome = 'ready') as ready,
      count(*) filter (where e.received) as received,
      count(*) filter (where e.outcome = 'blocked') as blocked,
      count(*) filter (where e.outcome = 'failed') as failed,
      count(*) filter (where e.outcome = 'limited') as limited,
      round(avg(e.duration_ms)) as average_ms,
      percentile_disc(0.95) within group (order by e.duration_ms) as p95_ms,
      round(avg(e.sources_ms)) as sources_ms, round(avg(e.generation_ms)) as generation_ms,
      count(f.rating) as ratings, count(*) filter (where f.rating = 1) as helpful,
      count(*) filter (where f.rating = -1) as unhelpful
    from public.assistant_quality_events e
    left join public.assistant_quality_feedback f on f.event_id = e.id
    where e.created_at > now() - interval '30 days'
    group by e.topic, e.asset, e.model, e.version
    order by count(*) desc
  ) s;
$$;
revoke all on function public.assistant_quality_summary() from public, anon, authenticated;
grant execute on function public.assistant_quality_summary() to service_role;
