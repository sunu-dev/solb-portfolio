'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import {
  US10Y_EDU_CARD, FED_EDU_CARD, CPI_EDU_CARD, JOBS_EDU_CARD, JP_RATE_EDU_CARD,
  MACRO_CARD_HEADER, MACRO_VALUE_LABELS as L,
} from '@/config/macroContextCopy';
import type { MacroEduCopy } from '@/config/macroContextCopy';
import { nextEconRelease, formatReleaseKst, ECON_SHORT_LABEL } from '@/config/econCalendar';
import type { MacroIndicatorsResponse } from '@/app/api/macro-indicators/route';

/**
 * 주요 시장 지표 카드 — 사실 표시 + 교육 (방향0).
 * 설계: docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md §4·§5 + 1단계 확장
 *  - 숫자·변화는 **중립색 고정** — 지표 등락에 손익색을 입히면 좋음/나쁨 신호가 된다
 *  - 표시 문구는 macroContextCopy SSOT(L)에서만 온다 — 컴포넌트는 문장을 만들지 않는다
 *  - 기준 시점 상시 표시, '다음 발표'는 econCalendar 정적 일정(미래분 없으면 숨김)
 *
 * 레이아웃이 2단인 이유(2026-08-19 재감사): 값+부가+기준을 한 줄 nowrap으로 묶으면
 * CPI 행이 375px에서도 폭을 넘겨 라벨이 강제로 꺾이고 320px에서는 카드 밖으로 샌다.
 * 위 줄=이름+수치(축소 가능), 아래 줄=메타(전월·기준)로 나눠 좁은 폭에서도 안전하다.
 */

interface Row {
  key: string;
  edu: MacroEduCopy;
  /** 주 수치 — 순수 값만(다른 행과 시각 리듬 일치) */
  value: string;
  /** 메타 줄: 비교값·기준 시점 */
  meta: string;
}

const monthLabel = (refMonth: string) => `${Number(refMonth.split('-')[1])}월 기준`;
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(m)}.${Number(d)} 기준`;
};
const signed = (n: number, digits: number) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

function buildRows(data: MacroIndicatorsResponse): Row[] {
  const rows: Row[] = [];
  if (data.us10y) {
    const t = data.us10y;
    rows.push({
      key: 'us10y', edu: US10Y_EDU_CARD,
      value: `${t.yield10y.toFixed(2)}%`,
      meta: [t.changePp == null ? null : `${L.dayChange} ${signed(t.changePp, 2)}%p`, dayLabel(t.asOfDate)]
        .filter(Boolean).join(' · '),
    });
  }
  if (data.fed) {
    rows.push({
      key: 'fed', edu: FED_EDU_CARD,
      value: `${data.fed.lower.toFixed(2)}~${data.fed.upper.toFixed(2)}%`,
      meta: dayLabel(data.fed.asOfDate),
    });
  }
  if (data.cpi) {
    rows.push({
      key: 'cpi', edu: CPI_EDU_CARD,
      value: `${signed(data.cpi.yoy, 1)}%`,
      // '전년 대비'를 메타로 내려 값 컬럼을 순수 수치로 통일.
      // 전월치는 'MoM 3.5%' 오독을 막기 위해 '전월 발표'로 명시한다.
      meta: [
        L.yoyPrefix,
        data.cpi.prevYoy == null ? null : `${L.cpiPrev} ${signed(data.cpi.prevYoy, 1)}%`,
        monthLabel(data.cpi.refMonth),
      ].filter(Boolean).join(' · '),
    });
  }
  if (data.jpRate) {
    const j = data.jpRate;
    rows.push({
      key: 'jpRate', edu: JP_RATE_EDU_CARD,
      value: `${j.rate.toFixed(2)}%`,
      meta: [
        j.changePp == null || j.changePp === 0 ? null : `${L.dayChange} ${signed(j.changePp, 2)}%p`,
        dayLabel(j.asOfDate),
      ].filter(Boolean).join(' · '),
    });
  }
  if (data.jobs) {
    rows.push({
      key: 'jobs', edu: JOBS_EDU_CARD,
      value: `${data.jobs.rate.toFixed(1)}%`,
      meta: [
        data.jobs.prevRate == null ? null : `${L.prev} ${data.jobs.prevRate.toFixed(1)}%`,
        monthLabel(data.jobs.refMonth),
      ].filter(Boolean).join(' · '),
    });
  }
  return rows;
}

const CARD_STYLE: React.CSSProperties = {
  marginBottom: 14, padding: '14px 16px', borderRadius: 14,
  background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #F2F4F6)',
};

export default function MacroRateCard() {
  const [data, setData] = useState<MacroIndicatorsResponse | null | undefined>(undefined);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // 데이터 도착 시각 기준으로 재계산 — 발표 시각이 지난 예고가 세션 내내 남지 않는다
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const next = useMemo(() => (loadedAt == null ? null : nextEconRelease(new Date(loadedAt))), [loadedAt]);

  useEffect(() => {
    fetch('/api/macro-indicators')
      .then(r => (r.ok ? r.json() : null))
      .then((d: MacroIndicatorsResponse | null) => {
        setData(d && !('error' in d) ? d : null);
        setLoadedAt(Date.now());
      })
      .catch(() => { setData(null); setLoadedAt(Date.now()); });
  }, []);

  if (data === undefined) {
    // 자리 예약 — 실제 행 높이(44px)와 각주 2줄을 맞춰 CLS를 줄인다
    return (
      <div style={CARD_STYLE}>
        <div style={{ height: 20, width: 110, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 6 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 44, display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ height: 14, width: i % 2 ? 150 : 130, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4 }} />
          </div>
        ))}
        <div style={{ height: 26, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginTop: 8 }} />
      </div>
    );
  }
  if (data === null) return null;

  const rows = buildRows(data);
  if (rows.length === 0) return null;

  return (
    <div style={CARD_STYLE}>
      <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', whiteSpace: 'nowrap' }}>
          {MACRO_CARD_HEADER.title}
        </span>
        {next && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', background: 'var(--bg-subtle, #F2F4F6)', padding: '3px 7px', borderRadius: 6, textAlign: 'right', wordBreak: 'keep-all' }}>
            {MACRO_CARD_HEADER.nextReleasePrefix} {ECON_SHORT_LABEL[next.id]} {formatReleaseKst(next)}
          </span>
        )}
      </div>

      {rows.map(row => {
        const open = expandedKey === row.key;
        const panelId = `macro-panel-${row.key}`;
        const triggerId = `macro-trigger-${row.key}`;
        return (
          <div key={row.key} style={{ borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <button
              type="button"
              id={triggerId}
              onClick={() => {
                if (!open) logFeatureFirstUse('macro-rate-card');
                setExpandedKey(open ? null : row.key);
              }}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${row.edu.title} ${L.expandHint}`}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #F9FAFB)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              style={{
                width: '100%', minHeight: 44, padding: '8px 0', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', display: 'block', borderRadius: 8,
              }}
            >
              <span className="flex items-baseline justify-between" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary, #191F28)', fontWeight: 500, wordBreak: 'keep-all', minWidth: 0 }}>
                  {row.edu.title}
                </span>
                <span className="flex items-center shrink-0" style={{ gap: 4 }}>
                  {/* 중립색 고정 — 손익색 금지 */}
                  <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', whiteSpace: 'nowrap' }}>
                    {row.value}
                  </span>
                  <ChevronDown
                    size={13} aria-hidden="true" color="var(--text-tertiary, #8B95A1)"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                  />
                </span>
              </span>
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-tertiary, #8B95A1)', marginTop: 2, wordBreak: 'keep-all' }}>
                {row.meta}
              </span>
            </button>
            {open && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                style={{
                  minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere',
                  fontSize: 13, color: 'var(--text-secondary, #4E5968)',
                  lineHeight: 1.65, wordBreak: 'keep-all', padding: '2px 0 12px',
                }}
              >
                <p style={{ margin: '0 0 10px' }}>{row.edu.intro}</p>

                <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {L.mechanicsTitle}
                </p>
                {row.edu.mechanics.map(sentence => (
                  <p key={sentence} style={{ margin: '0 0 5px' }}>{sentence}</p>
                ))}

                <p style={{ margin: '10px 0 3px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {L.limitsTitle}
                </p>
                {row.edu.limits.map(sentence => (
                  <p key={sentence} style={{ margin: '0 0 5px' }}>{sentence}</p>
                ))}

                <p style={{ margin: '10px 0 3px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {L.contextTitle}
                </p>
                <p style={{ margin: '0 0 5px' }}>{row.edu.bothWays}</p>
                <p style={{ margin: 0 }}>{row.edu.unknowable}</p>

                {row.edu.dataNote && (
                  <>
                    <p style={{ margin: '10px 0 3px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                      {L.dataTitle}
                    </p>
                    <p style={{ margin: 0 }}>{row.edu.dataNote}</p>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #8B95A1)', marginTop: 8, lineHeight: 1.5, wordBreak: 'keep-all' }}>
        {MACRO_CARD_HEADER.footnote}
      </div>
    </div>
  );
}
