-- 이전 버전의 감사 테이블을 이미 적용한 로컬 검증 DB용 보강.
alter table public.ai_output_audits
  add column if not exists source_snapshot jsonb null;
