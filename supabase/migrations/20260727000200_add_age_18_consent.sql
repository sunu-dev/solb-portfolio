-- Gemini API 약관(2026-03-23 시행)의 API Client 만 18세 이상 요건 반영.
-- 기존 age_14_plus 증거를 성인 동의로 승격하지 않는다. 사용자가 직접 다시 확인해야 한다.

alter table public.user_consents
  drop constraint if exists user_consents_consent_type_check;

alter table public.user_consents
  add constraint user_consents_consent_type_check
  check (consent_type in ('terms', 'privacy', 'age_14_plus', 'age_18_plus', 'marketing'));

comment on column public.user_consents.consent_type is
  'terms | privacy | age_14_plus(legacy) | age_18_plus | marketing';
