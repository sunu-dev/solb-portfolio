-- 가져오기 전 포트폴리오 복구 지점과 변경 요약.
-- 원본 CSV 파일명·업로드 이미지·OCR 원문은 저장하지 않는다.
-- 새 환경에서도 이 migration chain만으로 포트폴리오 기반을 재현할 수 있게 한다.
create table if not exists public.user_portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stocks jsonb not null default '{}'::jsonb,
  daily_snapshots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_portfolios enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_portfolios'
      and policyname = 'user_portfolios_own_records'
  ) then
    create policy user_portfolios_own_records
      on public.user_portfolios
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

grant select, insert, update, delete on public.user_portfolios to authenticated;

alter table public.user_portfolios
  add column if not exists portfolio_history jsonb not null default '[]'::jsonb;

comment on column public.user_portfolios.portfolio_history is
  '최근 포트폴리오 가져오기 전 스냅샷과 변경 요약(최대 20개, 클라이언트 제한)';
