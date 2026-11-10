# 2026-10-17 - 앱 공통 UI 운영 배포

## 작업 요약
- 사용자 운영 배포 요청에 따라 검수한 격리 소스를 Vercel production 원격 빌드로 배포했다. 사전61파일해시 일치 확인, 기존 미배포 시장 관찰 작업 제외.
- `dpl_HKkEEiDibtxkxCNfaoqSRx4fjk5G` READY. joobi.kr/www.joobi.kr 및 기존 Vercel별칭 연결. 관리자 주소 /admin 유지.
- 원격1,486pass/4skip·컴파일/타입/페이지 생성 통과. 운영 Chrome320/390/1440×두테마62검사·실제 Pretendard CDN 로딩·공개 HTTP/번들 필수 설정 통과. 실제 사용자/DB/AI변경 없이 fixture로 검수.
- 새 배포 실행 오류로그13:20:30~13:30:30 KST0건, 제외구간 없음. 최신CLI에서 --level 제거돼 --query 'level:error'와 --deployment로 조회했다.

## 결정사항
- 로컬 prebuilt의 마스킹 공개 키 위험을 피하려 기존 원격 빌드 방식을 유지했다. 환경/보안/모니터링 설정 변경 없음.
- 검수 소스는 미커밋 변경이 포함되어 commit번호 하나를 전체 배포의 증거로 제시하지 않는다. 격리 소스 및 파일해시와 deployment ID를 연결한다.
- 메모리 승급 검토: 기존 배포 방식의 실행 결과이며 새 사용자 선호/영구 규칙 없음. 결과는 운영 검수 보고서에 기록.

## 미해결 TODO
- [ ] iPhone Safari 실기기·큰 글자 설정·실계정/실제 OAuth 확인.

## 다음 세션 진입점
- `artifacts/app-ui-production-20261017/REPORT.md`, deployment.json, source-check.json, 검수JSON/PNG, runtime-errors.jsonl.
- 운영은 이번 공통 UI 배포로 갱신됐다. 원본의 미배포 시장 관찰 기능은 여전히 별도 작업이다.
