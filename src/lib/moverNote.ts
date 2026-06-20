import { gateDigestNote } from '@/utils/alertCompliance';

/**
 * '오늘 한 줄' — 종목 변동의 RAG-grounded descriptive 해설 (방향0).
 *
 * ⚠️ 환각·§6 위험의 유일 지점이라 env 플래그로 게이트. 기본 off → null.
 * - `DIGEST_RAG_EXPLANATION='on'`일 때만 동작. 약관 v4 변호사 검토 후 on.
 * - LLM '생성'이 아니라 실제 헤드라인 '인용'(RAG-grounded 사실). 동일티커 환각 방어 위해
 *   **한글명으로만** 질의(영문 심볼 폴백 금지).
 * - `gateDigestNote()`로 인과·방향·미래 단정 검출 시 드롭 — 잘못된 인과보다 무(無)가 안전.
 *
 * SSOT: morning-brief cron(이메일 다이제스트)과 /api/mover-note(사이드바 '오늘 한 줄')가 공유.
 * docs/PERSONALIZED_DIGEST_SPEC.md · docs/TOSS_PC_UX_REVIEW_ADOPT.md 배치4.
 */
export async function buildMoverNote(name: string): Promise<string | null> {
  if (process.env.DIGEST_RAG_EXPLANATION !== 'on') return null;
  if (!name) return null; // 한글명 없으면 질의 안 함 (동일명 환각 방어)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    const res = await fetch(`${appUrl}/api/news?q=${encodeURIComponent(name)}&maxHours=24&locale=ko`, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    const headline: string | undefined = d?.items?.[0]?.title;
    if (!headline) return null;
    const { note } = gateDigestNote(`관련 소식: ${headline}`);
    return note;
  } catch {
    return null;
  }
}
