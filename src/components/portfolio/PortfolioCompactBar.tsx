'use client';

import { useState, useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData } from '@/config/constants';

/**
 * 포트폴리오 한눈에 — 가로 스택 바(비중) + 손익 분포 막대(±편차).
 *
 * 디자인 철학 (전문가 회의 결론):
 * - NASDAQ 트리맵은 500종목 시장 도구. 5~20종목 포트폴리오엔 부적합 ("코스프레")
 * - 트리맵의 면적/색 이중 인코딩을 → 선형 공간(가로 폭 + 세로 높이)로 풀어쓰기
 * - 총 56px(24px + 32px) — 트리맵 288px의 19%
 * - 5종목이든 20종목이든 자연스럽게 확장
 *
 * 이중 인코딩:
 *   상단 24px 바: 비중(가로 폭)
 *   하단 32px 바: 손익(세로 높이 + 색)
 *
 * "확대 →" 버튼 → 분석 탭의 풀 트리맵 (전문 도구로서의 가치는 거기 보존)
 */

const OTHERS = '__OTHERS__';
const TOP_N = 8;

// 손익률 → 색 (한국식 빨강=수익, 파랑=손실, 0% 차콜)
function pnlColor(pct: number): string {
  if (pct >= 7)    return '#B71C1C';
  if (pct >= 5)   return '#D32F2F';
  if (pct >= 3)   return '#E84549';
  if (pct >= 1.5) return '#C95C5F';
  if (pct >= 0.3) return '#A85A5E';
  if (pct > -0.3) return '#5A6470';
  if (pct > -1.5) return '#5A6E8C';
  if (pct > -3)   return '#3071C7';
  if (pct > -5)   return '#1B64DA';
  if (pct > -7)   return '#1454C4';
  return '#0D47A1';
}

// 비중 바는 PnL과 분리 — 보유량에 따른 차콜 음영(중복 인코딩 방지)
function weightColor(rank: number, total: number): string {
  // 큰 순서대로 진한 차콜, 작아질수록 옅게
  const t = total > 1 ? rank / (total - 1) : 0;
  // #2D3340 (큰) → #5C6473 (작은)
  const r = Math.round(45 + (92 - 45) * t);
  const g = Math.round(51 + (100 - 51) * t);
  const b = Math.round(64 + (115 - 64) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

interface Item {
  symbol: string;
  value: number;
  pnlPct: number;
  todayPct: number;
  isOthers?: boolean;
  childrenSymbols?: string[];
}

interface Props {
  onExpand?: () => void;
}

export default function PortfolioCompactBar({ onExpand }: Props) {
  const { stocks, macroData, setAnalysisSymbol } = usePortfolioStore();
  const [mode, setMode] = useState<'pnl' | 'today'>('pnl');
  const [hovered, setHovered] = useState<number | null>(null);

  const { items, totalValue } = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
    const built: Item[] = [];
    let total = 0;
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const price = q?.c || 0;
      if (price <= 0) continue;
      const value = price * s.shares;
      total += value;
      const pnlPct = ((price - s.avgCost) / s.avgCost) * 100;
      const todayPct = q?.dp || 0;
      built.push({ symbol: s.symbol, value, pnlPct, todayPct });
    }
    built.sort((a, b) => b.value - a.value);

    if (built.length <= TOP_N) return { items: built, totalValue: total };

    const top = built.slice(0, TOP_N - 1);
    const rest = built.slice(TOP_N - 1);
    const restValue = rest.reduce((s, i) => s + i.value, 0);
    if (restValue > 0) {
      const wPnl = rest.reduce((s, i) => s + i.pnlPct * i.value, 0) / restValue;
      const wToday = rest.reduce((s, i) => s + i.todayPct * i.value, 0) / restValue;
      top.push({
        symbol: OTHERS,
        value: restValue,
        pnlPct: wPnl,
        todayPct: wToday,
        isOthers: true,
        childrenSymbols: rest.map(r => r.symbol),
      });
    }
    return { items: top, totalValue: total };
  }, [stocks.investing, macroData]);

  if (items.length === 0 || totalValue === 0) return null;

  // 손익 분포 바 스케일링용 max |pct|
  const maxAbsPct = Math.max(
    1,
    ...items.map(i => Math.abs(mode === 'pnl' ? i.pnlPct : i.todayPct))
  );

  const focused = hovered !== null ? items[hovered] : null;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 헤더 — 라벨 + 모드 토글 + 확대 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-tertiary, #B0B8C1)',
          letterSpacing: 0.4,
        }}>
          한눈에 · 비중과 손익
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex',
            gap: 1,
            padding: 1,
            borderRadius: 5,
            background: 'var(--bg-subtle, #F2F4F6)',
          }}>
            {(['pnl', 'today'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: mode === m ? 700 : 500,
                  color: mode === m ? 'var(--text-primary, #191F28)' : 'var(--text-tertiary, #B0B8C1)',
                  background: mode === m ? 'var(--surface, #FFFFFF)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {m === 'pnl' ? '수익률' : '오늘'}
              </button>
            ))}
          </div>
          {onExpand && (
            <button
              onClick={onExpand}
              aria-label="분석 탭에서 풀 히트맵 보기"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-tertiary, #B0B8C1)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '3px 4px',
              }}
            >
              확대 →
            </button>
          )}
        </div>
      </div>

      {/* 상단: 비중 stacked bar (24px) */}
      <div style={{
        display: 'flex',
        height: 24,
        borderRadius: 4,
        overflow: 'hidden',
        gap: 1,
        background: 'var(--bg-subtle, #F2F4F6)',
      }}>
        {items.map((item, idx) => {
          const widthPct = (item.value / totalValue) * 100;
          const isFocus = hovered === idx;
          const tickerLabel = item.isOthers ? '기타' : item.symbol;
          const showLabel = widthPct >= 12;
          const showTickerOnly = widthPct >= 6 && widthPct < 12;
          const fillColor = item.isOthers ? '#7A8294' : weightColor(idx, items.length);
          return (
            <button
              key={item.symbol}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !item.isOthers && setAnalysisSymbol(item.symbol)}
              aria-label={`${tickerLabel} 비중 ${widthPct.toFixed(1)}%`}
              style={{
                width: `${widthPct}%`,
                minWidth: 6,
                height: '100%',
                background: fillColor,
                opacity: isFocus ? 1 : 0.92,
                border: 'none',
                cursor: item.isOthers ? 'default' : 'pointer',
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s',
              }}
            >
              {showLabel
                ? `${tickerLabel} ${widthPct.toFixed(0)}%`
                : showTickerOnly
                ? tickerLabel
                : ''}
            </button>
          );
        })}
      </div>

      {/* 하단: 손익 분포 (32px) — ± 편차 막대, 0 base line 중앙 */}
      <div style={{
        display: 'flex',
        height: 32,
        marginTop: 4,
        gap: 1,
        position: 'relative',
      }}>
        {/* 0 base line */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: '50%',
          height: 1,
          background: 'var(--border-light, rgba(0,0,0,0.08))',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        {items.map((item, idx) => {
          const widthPct = (item.value / totalValue) * 100;
          const pct = mode === 'pnl' ? item.pnlPct : item.todayPct;
          // 막대 높이 — 컬럼 절반(16px) 안에서 |pct|/maxAbsPct 비례. cap 96%.
          const heightPct = Math.min(96, (Math.abs(pct) / maxAbsPct) * 96);
          const isUp = pct >= 0;
          const color = pnlColor(pct);
          const isFocus = hovered === idx;
          const tickerLabel = item.isOthers ? '기타' : item.symbol;
          return (
            <div
              key={item.symbol}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !item.isOthers && setAnalysisSymbol(item.symbol)}
              role={item.isOthers ? undefined : 'button'}
              aria-label={`${tickerLabel} ${mode === 'pnl' ? '수익률' : '오늘'} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
              tabIndex={item.isOthers ? -1 : 0}
              style={{
                width: `${widthPct}%`,
                minWidth: 6,
                height: '100%',
                position: 'relative',
                cursor: item.isOthers ? 'default' : 'pointer',
              }}
            >
              {/* 위 또는 아래로 자란 막대 */}
              <div style={{
                position: 'absolute',
                left: 1, right: 1,
                ...(isUp
                  ? { bottom: '50%', height: `${heightPct / 2}%` }
                  : { top: '50%',    height: `${heightPct / 2}%` }),
                background: color,
                opacity: isFocus ? 1 : 0.88,
                borderRadius: 1,
                transition: 'opacity 0.15s',
              }} />
            </div>
          );
        })}
      </div>

      {/* 호버 / 기본 라벨 한 줄 */}
      <div style={{
        marginTop: 6,
        fontSize: 11,
        color: 'var(--text-secondary, #4E5968)',
        minHeight: 16,
        lineHeight: 1.4,
      }}>
        {focused ? (
          <FocusLabel item={focused} totalValue={totalValue} mode={mode} />
        ) : (
          <DefaultLabel items={items} mode={mode} />
        )}
      </div>
    </div>
  );
}

// ─── 호버 시 한 종목 상세 라벨 ──────────────────────────────────────────────
function FocusLabel({ item, totalValue, mode }: { item: Item; totalValue: number; mode: 'pnl' | 'today' }) {
  const widthPct = (item.value / totalValue) * 100;
  const pct = mode === 'pnl' ? item.pnlPct : item.todayPct;
  const name = item.isOthers ? `기타 ${item.childrenSymbols?.length || 0}개` : (STOCK_KR[item.symbol] || item.symbol);
  const tickerStr = item.isOthers ? '기타' : item.symbol;
  return (
    <span>
      <strong style={{ color: 'var(--text-primary, #191F28)', fontFamily: "'SF Mono', monospace" }}>
        {tickerStr}
      </strong>
      {' · '}
      <span style={{ opacity: 0.7 }}>{name}</span>
      {' · '}
      <span style={{ fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
        비중 {widthPct.toFixed(1)}% · {mode === 'pnl' ? '수익률' : '오늘'}{' '}
        <span style={{
          color: pct >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          fontWeight: 700,
        }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
      </span>
    </span>
  );
}

// ─── 기본(호버 없을 때): 가중 평균 + best/worst ─────────────────────────────
function DefaultLabel({ items, mode }: { items: Item[]; mode: 'pnl' | 'today' }) {
  if (items.length === 0) return null;
  // 비중 가중 평균
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  const weighted = items.reduce(
    (s, i) => s + (mode === 'pnl' ? i.pnlPct : i.todayPct) * i.value,
    0,
  ) / (totalValue || 1);
  // best/worst (real items, OTHERS 제외)
  const realItems = items.filter(i => !i.isOthers);
  const sorted = [...realItems].sort((a, b) =>
    (mode === 'pnl' ? b.pnlPct - a.pnlPct : b.todayPct - a.todayPct)
  );
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const bestPct = best ? (mode === 'pnl' ? best.pnlPct : best.todayPct) : 0;
  const worstPct = worst ? (mode === 'pnl' ? worst.pnlPct : worst.todayPct) : 0;

  return (
    <span style={{ fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ opacity: 0.7 }}>가중 평균</span>{' '}
      <span style={{
        fontWeight: 700,
        color: weighted >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
      }}>
        {weighted >= 0 ? '+' : ''}{weighted.toFixed(2)}%
      </span>
      {best && best !== worst && (
        <>
          <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>
          <span style={{ opacity: 0.7 }}>최고</span>{' '}
          <span style={{ color: 'var(--color-gain, #EF4452)' }}>
            {best.symbol} {bestPct >= 0 ? '+' : ''}{bestPct.toFixed(1)}%
          </span>
          <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>
          <span style={{ opacity: 0.7 }}>최저</span>{' '}
          <span style={{ color: 'var(--color-loss, #3182F6)' }}>
            {worst.symbol} {worstPct >= 0 ? '+' : ''}{worstPct.toFixed(1)}%
          </span>
        </>
      )}
    </span>
  );
}
