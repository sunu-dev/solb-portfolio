'use client';

import { useEffect, useState } from 'react';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import { US10Y_EDU_CARD } from '@/config/macroContextCopy';
import type { UsTreasuryResponse } from '@/app/api/us-treasury/route';

/**
 * 미 국채 10년물 카드 — 사실 표시 + 교육 (v1, 방향0).
 * 설계 근거: docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md §4·§5·§6
 *  - 숫자는 **중립색 고정** — 금리 등락에 손익색을 입히면 좋음/나쁨 신호가 된다
 *  - 카피는 macroContextCopy SSOT만 렌더 — 이 컴포넌트는 어떤 문장도 생성하지 않는다
 *  - 기준일을 항상 표시 — 전일 값을 오늘 값처럼 내보내지 않는다
 *  - 실패·로딩 시 카드 자체를 숨긴다(리포트 탭 흐름에 빈 카드 소음 금지)
 */
export default function MacroRateCard() {
  const [data, setData] = useState<UsTreasuryResponse | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/us-treasury')
      .then(r => (r.ok ? r.json() : null))
      .then((d: UsTreasuryResponse | null) =>
        setData(d && typeof d.yield10y === 'number' ? d : null))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const [, m, d] = data.asOfDate.split('-');
  const asOfLabel = `${Number(m)}.${Number(d)} 기준`;
  const ppText = data.changePp == null
    ? null
    : `전일 대비 ${data.changePp >= 0 ? '+' : ''}${data.changePp.toFixed(2)}%p`;

  return (
    <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #E5E8EB)' }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          {US10Y_EDU_CARD.title}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', background: 'var(--bg-subtle, #F2F4F6)', padding: '3px 7px', borderRadius: 6 }}>
          {asOfLabel}
        </span>
      </div>

      <div className="flex items-baseline" style={{ gap: 8, marginBottom: 8 }}>
        {/* 중립색 고정 — 손익색 금지 */}
        <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          {data.yield10y.toFixed(2)}%
        </span>
        {ppText && (
          <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #4E5968)' }}>
            {ppText}
          </span>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-primary, #191F28)', lineHeight: 1.65, wordBreak: 'keep-all', marginBottom: 4 }}>
        {US10Y_EDU_CARD.intro}
      </p>
      {expanded && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.65, wordBreak: 'keep-all', marginBottom: 4 }}>
          {US10Y_EDU_CARD.bothWays} {US10Y_EDU_CARD.unknowable}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          if (!expanded) logFeatureFirstUse('macro-rate-card');
          setExpanded(!expanded);
        }}
        style={{ minHeight: 32, fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer' }}
      >
        {expanded ? '접기' : US10Y_EDU_CARD.expandLabel}
      </button>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #8B95A1)', marginTop: 2, lineHeight: 1.5 }}>
        {US10Y_EDU_CARD.footnote}
      </div>
    </div>
  );
}
