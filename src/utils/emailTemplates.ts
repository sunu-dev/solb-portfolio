/**
 * 이메일 HTML 템플릿
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 *
 * 호환성 가이드:
 * - 모든 스타일 인라인 (이메일 클라이언트별 <style> 지원 불일치)
 * - 큰 폭 컬러 그라데이션은 단색 fallback
 * - max-width 580px로 모바일 안전
 * - table 레이아웃은 도입 안 함 — 모던 클라이언트(Gmail/Apple Mail) 충분
 */

const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

interface MorningBriefHtmlOpts {
  /** 헤드라인 — buildPushPayload 결과 */
  title: string;
  /** 본문 한 줄 */
  body: string;
  /** 누적 평가액 (포맷팅 완료 문자열, 예: "1,234만원") */
  totalValueFormatted: string;
  /** 어제 대비 델타 (포맷팅 완료, ±부호 포함) — null이면 미표시 */
  yesterdayDeltaFormatted: string | null;
  /** 어제 대비 % — 색상 판단용 */
  yesterdayPct: number | null;
  /** 가장 큰 움직임 종목 (있으면) */
  biggestMover: { symbol: string; dp: number } | null;
  /** 앱 URL — CTA 버튼 */
  appUrl: string;
  /** 사용자 이름 (있으면 인사) */
  userName?: string;
}

const COLOR_GAIN = '#EF4452';
const COLOR_LOSS = '#3182F6';
const COLOR_TEXT = '#191F28';
const COLOR_SECONDARY = '#4E5968';
const COLOR_TERTIARY = '#8B95A1';
const COLOR_BG = '#F8F9FA';
const COLOR_BORDER = '#E5E8EB';

/** 모닝브리프 이메일 HTML 빌드 */
export function buildMorningBriefHtml(opts: MorningBriefHtmlOpts): string {
  const { title, body, totalValueFormatted, yesterdayDeltaFormatted, yesterdayPct, biggestMover, appUrl, userName } = opts;
  const isUp = (yesterdayPct ?? 0) >= 0;
  const accentColor = yesterdayPct === null ? COLOR_TERTIARY : isUp ? COLOR_GAIN : COLOR_LOSS;

  const moverColor = biggestMover && biggestMover.dp >= 0 ? COLOR_GAIN : COLOR_LOSS;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR_BG};font-family:${FONT};color:${COLOR_TEXT};">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;">

    <!-- 헤더 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:${COLOR_TERTIARY};letter-spacing:0.5px;margin-bottom:4px;">
        SOLB · MORNING BRIEFING
      </div>
      <div style="font-size:13px;color:${COLOR_SECONDARY};">
        ${userName ? `${escapeHtml(userName)}님, 좋은 아침이에요 ☕` : '좋은 아침이에요 ☕'}
      </div>
    </div>

    <!-- 메인 카드 -->
    <div style="background:#FFFFFF;border-radius:16px;border:1px solid ${COLOR_BORDER};padding:24px 20px;margin-bottom:14px;">

      <div style="font-size:16px;font-weight:700;color:${COLOR_TEXT};margin-bottom:12px;line-height:1.4;">
        ${escapeHtml(title)}
      </div>

      <div style="font-size:13px;color:${COLOR_SECONDARY};line-height:1.6;margin-bottom:18px;">
        ${escapeHtml(body)}
      </div>

      <!-- 평가액 -->
      <div style="background:${COLOR_BG};border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="font-size:11px;color:${COLOR_TERTIARY};font-weight:600;margin-bottom:4px;">
          현재 평가액
        </div>
        <div style="font-size:22px;font-weight:800;color:${COLOR_TEXT};letter-spacing:-0.02em;">
          ${escapeHtml(totalValueFormatted)}
        </div>
        ${yesterdayDeltaFormatted !== null
          ? `<div style="font-size:12px;font-weight:700;color:${accentColor};margin-top:4px;">
              어제 대비 ${escapeHtml(yesterdayDeltaFormatted)}
            </div>`
          : ''}
      </div>

      ${biggestMover ? `
        <div style="background:${COLOR_BG};border-radius:12px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:11px;color:${COLOR_TERTIARY};font-weight:600;margin-bottom:4px;">
            가장 큰 움직임
          </div>
          <div style="display:flex;align-items:baseline;gap:8px;">
            <span style="font-size:15px;font-weight:700;color:${COLOR_TEXT};">${escapeHtml(biggestMover.symbol)}</span>
            <span style="font-size:14px;font-weight:700;color:${moverColor};">
              ${biggestMover.dp >= 0 ? '+' : ''}${biggestMover.dp.toFixed(2)}%
            </span>
          </div>
        </div>
      ` : ''}

      <!-- CTA -->
      <a href="${escapeHtml(appUrl)}"
         style="display:block;text-align:center;padding:12px 20px;background:#3182F6;color:#FFFFFF;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">
        앱에서 자세히 보기 →
      </a>
    </div>

    <!-- 시그니처 -->
    <div style="text-align:center;font-size:11px;color:${COLOR_TERTIARY};line-height:1.6;padding:8px;">
      📊 SOLB Portfolio · 매일 오전 7시 발송
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
