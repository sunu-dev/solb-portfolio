// ==========================================
// LEGAL VERSIONS — 약관·개인정보·동의 버전 SSOT
// ==========================================
//
// 동의 증거 정합성: 사용자가 화면(/terms, /privacy)에서 본 문서 버전과
// user_consents DB에 기록되는 버전이 반드시 일치해야 한다.
// 자본시장법 면책(약관 제7조)의 증거력이 이 정합성에 의존하기 때문이다 —
// 손실 분쟁 시 "동의 기록 버전 ≠ 게시 약관 버전"은 면책 동의의 유효성을
// 다툴 빌미가 된다.
//
// 버전 개정 시 이 파일 한 곳만 수정하면 다음이 모두 동기화된다:
//   - /terms, /privacy 페이지 시행일·버전 표기
//   - LoginModal 동의 sessionStorage 기록값 (terms/privacy)
//   - useAuth user_consents DB INSERT 값 (terms/privacy/age_14_plus)
//
// 드리프트 사고 이력 (2026-05-29 수정): 약관 페이지는 v3로 개정됐으나
// LoginModal 동의 상수는 v2로 남아, 신규 가입자가 화면에서 v3에 동의해도
// DB에는 terms=v2로 기록되던 증거 결함. 이 SSOT 도입으로 근본 차단.

/** 이용약관 (/terms)
 *  v4 (2026-05-29): 단일종목 레버리지 '중간 옵션' 반영 — 신규 추천 제외 유지 +
 *  보유분 사후 위험 해설 허용 + 성인·위험 게이트. ⚠️ 변호사 정식 검토 후 배포할 것
 *  (의견서 §5). 텍스트와 버전은 항상 함께 이동 (동의 증거력 정합성). */
export const TERMS_VERSION = 'v4';
export const TERMS_EFFECTIVE_DATE = '2026년 5월 29일';

/** 개인정보처리방침 (/privacy) */
export const PRIVACY_VERSION = 'v2';
export const PRIVACY_EFFECTIVE_DATE = '2026년 5월 15일';

/** 만 14세 게이트 동의 — 별도 문서 페이지 없는 동의 항목 (자본시장법 §49) */
export const AGE_GATE_VERSION = 'v1';
