-- AI 분석·AI 촉·OCR의 사용자별 사용량 가드가 공통으로 요구하는 컬럼을 보강한다.
-- 운영의 초기 ai_usage 테이블에는 user_id와 symbol이 없어 모든 AI 경로가 503으로 닫혔다.

alter table public.ai_usage
  add column if not exists user_id uuid null,
  add column if not exists symbol text null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.ai_usage'::regclass
       and conname = 'ai_usage_user_id_fkey'
  ) then
    alter table public.ai_usage
      add constraint ai_usage_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_ai_usage_user_date
  on public.ai_usage (user_id, date);

create index if not exists idx_ai_usage_date_mentor
  on public.ai_usage (date, mentor_id);
