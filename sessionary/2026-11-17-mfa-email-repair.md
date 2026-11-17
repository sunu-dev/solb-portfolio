# 2026-11-17 - 이메일 없는 카카오 관리자 MFA 등록 복구

## 작업 요약
- 사용자 실제등록 시 QR 미표시. 운영 Auth POST /factors 500, 오류 AccountName must be set 확인.
- Supabase 서버가 TOTP AccountName으로 user.email 사용. 카카오계정 이메일이 없어 실패하며 한글issuer 문제가 아님.
- 실제등록 이전 합성응답검수만 통과한 것을 충분한 검증처럼 안내한 한계 확인.
- 운영 MFA enroll/verify 활성화 확인. 설정비활성 문제가 아님.
- 이메일없는 계정은 본인이 입력한 이메일을 동일계정 updateUser로 연결→확인메일링크→getUser email_confirmed_at 확인→QR등록.
- verified MFA는 기존대로 도전가능. 미확인/변조된 클라이언트상태로 서버 관리자권한을 우회하지 못함.
- 실패코드별 안내 추가. 서버 원문/비밀을 UI나 로그에 노출하지 않음.

## 메일 환경
- 운영 emailEnabled/confirmationRequired true,joobi.kr redirect허용,customSMTP미설정.
- 기본Supabase SMTP는 프로젝트팀 이메일에만 발송가능. UI에 제한 명시. 사용자에게 가입메일 수신가능 여부 질문대기.
- 기존Resend 도메인 상태는 not_started. 읽기전용확인만 수행,SMTP/DNS/키변경/실메일발송 없음.
- 실제이메일연결/메일확인/실QR등록은 사용자후속. 앱에서 확인메일버튼은 본인이 눌러야 함.

## 검증
- 전체3001통과22생략/도구4/타입/제품게이트통과,대상ESLint통과.
- 프로덕션빌드통과 후 안내문구/조회실패시 폼표시가드 추가,최종verify재통과. 원격빌드 후속.
- 실제bundle+합성응답 브라우저:이메일없음→QR요청0,이메일업데이트1회,미확인시QR차단,확인후enroll1회/QR표시/390px넘침없음.
- 실제메일발송은 검증하지 않음. 로그 /private/tmp/joobi-mfa-email-*.log.

## 결정사항
- 이메일을 임의생성하거나 admin권한으로 확인처리하지 않음. 본인확인흐름과 기존계정ID를 유지.
- 사용자의 앤스로픽 질문품질 피드백을 병행기록. 현재회사/상장뉴스검색→사업설명→조건부전망순서 필요. 아직엔진코드변경없음.

## 미해결 TODO
- [ ] 배포/CI검증,사용자 이메일연결·실TOTP검수.
- [ ] 다른메일필요시 Resend도메인인증/SMTP연결 별도진행.
- [ ] 앤스로픽상장 질문의 기업중심검색·의도분기 개선.

## 다음 세션 진입점
- HANDOFF.txt, src/components/admin/AdminMfa.tsx, src/lib/adminMfaSetup.ts, src/__tests__/adminMfaSetup.test.ts.
- 공식근거 https://github.com/supabase/auth/blob/master/internal/api/mfa.go , https://supabase.com/docs/guides/auth/auth-smtp .
