# 2026-11-13 - 계정 로딩 재발

## 작업 요약
- 사용자15:06 캡처: 계정확인실패, 이후 동의확인 로딩. 실제 원인 단계는 캡처만으로 단정불가.
- AccountAccessStatus는 pending상태에서 float/shadow/dots 반복. error에서는 정지. reduced-motion이면 움직임 없음. JoobiAvatar mood 미전달로21반응 미연결.
- useAuth getSession6초 뒤 오류표시, 늦은 정상응답 회복허용. AgeEligibilityGate 동의조회6초 제한/abort, 오류뒤 수동재조회.
- 기존 진단스크립트 읽기전용32조회 모두200. 동의4403ms/portfolio2215ms/auth573ms/config1695ms 최대. 이후수십~수백ms. artifacts/db-latency-20261113/afternoon-recurrence.json.

## 결정사항
- 익명RLS 조회는 인증된 사용자 요청과 다름. 지연재현은 확인했으나 실패원인·DB사양·브라우저auth락은 미확정.
- 앱/인증설정/계정/DB수정 없음. 테스트모델/운영질문/배포/push 없음.

## 미해결 TODO
- [ ] 정상 로그인 브라우저에서 session/consent 요청별 소요·중복수·실패코드 측정.
- [ ] 로딩/오류 화면 mood연결과 중복애니메이션 정리(이번은 조사만).

## 다음 세션 진입점
- useAuth.ts, AgeEligibilityGate.tsx, AccountAccessStatus.tsx/.module.css.
