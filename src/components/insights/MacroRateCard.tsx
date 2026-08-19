'use client';

import { useEffect, useState } from 'react';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import {
  US10Y_EDU_CARD, FED_EDU_CARD, CPI_EDU_CARD, JOBS_EDU_CARD, MACRO_CARD_HEADER,
} from '@/config/macroContextCopy';
import { nextEconRelease, formatReleaseKst } from '@/config/econCalendar';
import type { MacroIndicatorsResponse } from '@/app/api/macro-indicators/route';

/**
 * 주요 시장 지표 카드 — 사실 표시 + 교육 (방향0).
 * 설계 근거: docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md §4·§5 + 1단계 확장(기준금리·CPI·실업률)
 *  - 숫자·변화는 **중립색 고정** — 지표 등락에 손익색을 입히면 좋음/나쁨 신호가 된다
 *  - 카피는 macroContextCopy SSOT만 렌더 — 이 컴포넌트는 어떤 문장도 생성하지 않는다
 *  - 기준일·기준월 상시 표시, '다음 발표'는 econCalendar 정적 일정(미래분 없으면 숨김)
 *  - 로딩 스켈레톤으로 자리 예약(pop-in 방지), 전 소스 실패 시 카드 숨김
 */

interface EduCopy {
  readonly title: string;
  readonly intro: string;
  readonly bothWays: string;
  readonly unknowable: string;
}

interface Row {
  key: string;
  edu: EduCopy;
  /** 주 수치 */
  value: string;
  /** 부가(전월·전일 등) — 중립색 */
  sub: string | null;
  /** 기준 시점 배지 */
  asOf: string;
}

function monthLabel(refMonth: string): string {
  const m = Number(refMonth.split('-')[1]);
  return `${m}월 기준`;
}

function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(m)}.${Number(d)} 기준`;
}

function buildRows(data: MacroIndicatorsResponse): Row[] {
  const rows: Row[] = [];
  if (data.us10y) {
    const t = data.us10y;
    rows.push({
      key: 'us10y', edu: US10Y_EDU_CARD,
      value: `${t.yield10y.toFixed(2)}%`,
      sub: t.changePp == null ? null : `전일 대비 ${t.changePp >= 0 ? '+' : ''}${t.changePp.toFixed(2)}%p`,
      asOf: dayLabel(t.asOfDate),
    });
  }
  if (data.fed) {
    rows.push({
      key: 'fed', edu: FED_EDU_CARD,
      value: `${data.fed.lower.toFixed(2)}~${data.fed.upper.toFixed(2)}%`,
      sub: null,
      asOf: dayLabel(data.fed.asOfDate),
    });
  }
  if (data.cpi) {
    rows.push({
      key: 'cpi', edu: CPI_EDU_CARD,
      value: `전년 대비 ${data.cpi.yoy >= 0 ? '+' : ''}${data.cpi.yoy.toFixed(1)}%`,
      sub: data.cpi.prevYoy == null ? null : `전월 ${data.cpi.prevYoy >= 0 ? '+' : ''}${data.cpi.prevYoy.toFixed(1)}%`,
      asOf: monthLabel(data.cpi.refMonth),
    });
  }
  if (data.jobs) {
    rows.push({
      key: 'jobs', edu: JOBS_EDU_CARD,
      value: `${data.jobs.rate.toFixed(1)}%`,
      sub: data.jobs.prevRate == null ? null : `전월 ${data.jobs.prevRate.toFixed(1)}%`,
      asOf: monthLabel(data.jobs.refMonth),
    });
  }
  return rows;
}

export default function MacroRateCard() {
  const [data, setData] = useState<MacroIndicatorsResponse | null | undefined>(undefined);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // 다음 발표는 데이터 도착 후(클라이언트 전용 상태)에만 그리므로 SSR 하이드레이션과 무관
  const [next] = useState(() => nextEconRelease(new Date()));

  useEffect(() => {
    fetch('/api/macro-indicators')
      .then(r => (r.ok ? r.json() : null))
      .then((d: MacroIndicatorsResponse | null) => setData(d && !('error' in d) ? d : null))
      .catch(() => setData(null));
  }, []);

  if (data === undefined) {
    return (
      <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #E5E8EB)' }}>
        <div style={{ height: 14, width: 110, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 14 }} />
        {[150, 130, 140, 120].map((w, i) => (
          <div key={i} style={{ height: 16, width: w, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 12 }} />
        ))}
        <div style={{ height: 10, width: '70%', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4 }} />
      </div>
    );
  }
  if (data === null) return null;

  const rows = buildRows(data);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #E5E8EB)' }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          {MACRO_CARD_HEADER.title}
        </span>
        {next && (
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', background: 'var(--bg-subtle, #F2F4F6)', padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            {MACRO_CARD_HEADER.nextReleasePrefix}: {next.label} {formatReleaseKst(next)}
          </span>
        )}
      </div>

      {rows.map(row => {
        const open = expandedKey === row.key;
        return (
          <div key={row.key} style={{ borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <button
              type="button"
              onClick={() => {
                if (!open) logFeatureFirstUse('macro-rate-card');
                setExpandedKey(open ? null : row.key);
              }}
              aria-expanded={open}
              className="flex items-center justify-between"
              style={{ width: '100%', minHeight: 44, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', gap: 8, textAlign: 'left' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary, #191F28)', fontWeight: 500, wordBreak: 'keep-all' }}>
                {row.edu.title}
              </span>
              <span className="flex items-baseline" style={{ gap: 6, whiteSpace: 'nowrap' }}>
                {/* 중립색 고정 — 손익색 금지 */}
                <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {row.value}
                </span>
                {row.sub && (
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #4E5968)' }}>
                    {row.sub}
                  </span>
                )}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary, #8B95A1)' }}>{row.asOf}</span>
              </span>
            </button>
            {open && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.65, wordBreak: 'keep-all', margin: '0 0 10px' }}>
                {row.edu.intro} {row.edu.bothWays} {row.edu.unknowable}{row.key === 'us10y' ? ` ${US10Y_EDU_CARD.ppNote}` : ''}
              </p>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #8B95A1)', marginTop: 8, lineHeight: 1.5 }}>
        {US10Y_EDU_CARD.footnote}
      </div>
    </div>
  );
}
