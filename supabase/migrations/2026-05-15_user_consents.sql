-- 약관·개인정보·14세 동의 시점 DB 로깅 (9인 패널 BLOCKER #10 대응)
-- 분쟁 시 1순위 증거. 약관·개인정보 변경 시 재동의 modal 트리거 기준.

create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'privacy', 'age_14_plus', 'marketing')),
  version text not null default 'v1',
  agreed_at timestamptz not null default now(),
  -- 같은 (user, type, version) 조합 중복 방지
  unique (user_id, consent_type, version)
);

alter table user_consents enable row level security;

drop policy if exists "user_consents_self_select" on user_consents;
create policy "user_consents_self_select" on user_consents
  for select using (auth.uid() = user_id);

drop policy if exists "user_consents_self_insert" on user_consents;
create policy "user_consents_self_insert" on user_consents
  for insert with check (auth.uid() = user_id);

create index if not exists idx_user_consents_user on user_consents(user_id);
create index if not exists idx_user_consents_type on user_consents(consent_type, version);

comment on table user_consents is '동의 시점 로깅 — 분쟁 증거. 약관·개인정보 v2 갱신 시 재동의 modal 발동 기준.';
comment on column user_consents.consent_type is 'terms | privacy | age_14_plus | marketing';
comment on column user_consents.version is '동의한 약관/개인정보 버전 (예: v2)';
