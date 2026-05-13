-- AI 추천 품질 사용자 피드백 (1탭 👍/👎)
-- docs/ALGORITHM_REVIEW.md §5 (보강 #5)
--
-- 용도: priorityScore 가중치 A/B 테스트, 멘토 효과 검증, 알고리즘 개선 데이터
-- 적용: Supabase 콘솔 SQL Editor에 붙여넣고 실행

create table if not exists ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  source      text not null,
              -- 'ai-chok' | 'ai-analysis' | 'mentor:<id>'
  symbol      text,
  rating      smallint not null check (rating in (1, -1)),
              -- 1 = 👍 도움됐어요, -1 = 👎 별로예요
  context     jsonb,
              -- mentor_id, investor_type, vix_bucket 등 메타
  comment     text,
              -- 자유 텍스트 (선택, 200자)
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_feedback_source     on ai_feedback (source, created_at desc);
create index if not exists idx_ai_feedback_user       on ai_feedback (user_id, created_at desc);
create index if not exists idx_ai_feedback_symbol     on ai_feedback (symbol);

alter table ai_feedback enable row level security;

drop policy if exists "ai_feedback_self_select" on ai_feedback;
create policy "ai_feedback_self_select" on ai_feedback
  for select using (auth.uid() = user_id);

drop policy if exists "ai_feedback_self_insert" on ai_feedback;
create policy "ai_feedback_self_insert" on ai_feedback
  for insert with check (auth.uid() = user_id);
