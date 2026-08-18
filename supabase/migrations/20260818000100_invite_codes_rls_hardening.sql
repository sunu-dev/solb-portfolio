-- 초대·리퍼럴 코드 하드닝 (2026-08-18 전수 감사 P0)
--
-- 배경 1 — codes 전량 공개 조회:
--   docs/sql_invite_system.sql 은 `CREATE POLICY "codes_select" ON codes FOR SELECT USING (true)` 를
--   "validate API에서 사용"이라는 사유로 만들었다. 그러나 실제 코드 접근 경로
--   (/api/codes/validate·generate·my-invite, /api/account/delete)는 **전부 service_role 클라이언트**를
--   쓰므로 RLS를 우회한다. 즉 이 정책을 필요로 하는 소비자가 없다.
--   반면 anon 키는 클라이언트 번들에 실려 있어, 누구나 브라우저에서
--   `supabase.from('codes').select('*')` 로 code·rewards·max_uses·use_count 를 덤프할 수 있었다.
--   → 베타 초대 게이트가 실질적으로 무효였다. 정책을 제거한다.
--
-- 배경 2 — 리퍼럴 크레딧 중복 수령:
--   code_uses 에 (code, used_by) 유니크 제약이 없고, /api/codes/validate 의 중복 확인이
--   `.single()` 결과만 보고 error 를 버려서, 동일 코드로 동시에 여러 번 POST 하면
--   use_count 증가와 보상 지급이 각각 성립할 수 있었다.
--   → DB 레벨에서 1인 1회를 강제한다. 애플리케이션 경합과 무관하게 두 번째 INSERT 는 실패한다.

-- 1. codes 공개 조회 정책 제거 (service_role 접근은 RLS 대상이 아니므로 영향 없음)
drop policy if exists "codes_select" on codes;

-- 2. code_uses 1인 1코드 강제
--    기존 중복 행이 있으면 유니크 인덱스 생성이 실패한다. 가장 이른 사용 1건만 남기고 정리한다.
delete from code_uses a
using code_uses b
where a.code = b.code
  and a.used_by = b.used_by
  and a.used_by is not null
  and (a.used_at, a.id) > (b.used_at, b.id);

create unique index if not exists uniq_code_uses_code_user
  on code_uses (code, used_by)
  where used_by is not null;
