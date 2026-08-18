# 주비 한글 로고 15번 확정 기록

## 확정안

- 선택일: 2026-07-26
- 비교 화면: 2026-07-29 정리 완료
- 선택 번호: 15
- 글꼴: Single Day Regular, 화면 표현 굵기 500
- 구조: `나만의 / 주 / 식 / 비 / 서`
- 읽힘: 멀리서는 큰 글자 `주비`, 가까이서는 전체 문장 `나만의 주식비서`
- 정렬: 다섯 묶음의 텍스트 기준선을 아래로 정렬
- 간격: 작은 `식`의 글자는 그대로 그리되 가로 점유 폭을 62%로 조정하고, 다음 `비`는 6%만 당겨 서로 겹치지 않으면서 한 덩어리로 보이게 구성

## 실제 서비스 구성

- 공용 컴포넌트: `src/components/brand/JoobiLockup.tsx`
- 공용 스타일: `src/app/globals.css`
- 글꼴 등록: `src/app/layout.tsx`
- 글꼴 원본: `public/fonts/brand/joobi-single-day-regular.ttf`
- 글꼴 라이선스: `public/fonts/brand/OFL-Single-Day.txt`
- 아이콘: `public/icon-192.png`

상단 헤더, 랜딩, 로그인 모달, 초기 로딩 화면은 모두 같은 공용 `JoobiLockup`을 사용한다.

## 크기 체계

| 사용 위치 | `주·비` | `나만의·식·서` |
|---|---:|---:|
| 헤더 | 29px | 9px |
| 랜딩 히어로 | 42px | 12px |
| 로그인 모달 | 34px | 10px |
| 로딩 | 32px | 9px |

모바일 헤더에서는 제한된 폭을 고려해 작은 글자를 숨기고 `주비`만 표시한다.

## 라이선스와 출처

- 출처: Google Fonts 공식 저장소 `ofl/singleday/SingleDay-Regular.ttf`
- 기준 커밋: `7ff85c87f93ea6cca5f41c69f2e4edcb90240f26`
- 라이선스: SIL Open Font License 1.1

글꼴 파일과 라이선스 사본을 함께 유지한다.

## 비교안 정리

15번 확정 후 2026-07-29에 20종 비교 화면과 미선택 원본 글꼴을 제거했다. 운영에는 `public/fonts/brand/joobi-single-day-regular.ttf`와 해당 OFL 라이선스만 유지한다.
