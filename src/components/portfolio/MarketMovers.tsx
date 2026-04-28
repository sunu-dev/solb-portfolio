'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';

/**
 * 오늘 시장이 주목한 종목 — 회의 결과 옵션 C UI.
 *
 * 디자인 원칙:
 *   - "급등 TOP" 랭킹 ❌ → "주목한 종목" 컨텍스트
 *   - 빨간색 도파민 펌프 자제, 차분한 톤
 *   - 매수 버튼 직결 ❌ → "관심 추가" 1단계 쿠션
 *   - 한미 탭 분리
 */

interface MoverItem {
  symbol: string;
  krName: string;
  market: 'US' | 'KR';
  currentPrice: number | null;
  todayChange: number | null;
  todayChangePct: number | null;
}

interface MoversResp {
  ok: boolean;
  ranAt: string;
  cached: boolean;
  us: { gainers: MoverItem[]; losers: MoverItem[] };
  kr: { gainers: MoverItem[]; losers: MoverItem[] };
}

export default function MarketMovers() {
  const { setAnalysisSymbol, addStock, stocks } = usePortfolioStore();
  const [data, setData] = useState<MoversResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState<'US' | 'KR'>('KR');
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  useEffect(() => {
    fetch('/api/market-movers')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section style={{ marginTop: 28, marginBottom: 28 }}>
        <div style={{ height: 100, background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 12 }} />
      </section>
    );
  }

  if (!data?.ok) return null;

  const list = data[market === 'US' ? 'us' : 'kr'][tab];
  if (list.length === 0) return null;

  return (
    <section style={{ marginTop: 28, marginBottom: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          오늘 시장이 주목한 종목
        </h2>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 14 }}>
        시총 상위 universe 내 변동 · 정보 제공 · 추천 아님
      </p>

      {/* 시장 + 등락 토글 (한 줄) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)' }}>
          {(['KR', 'US'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12,
                fontWeight: market === m ? 700 : 500,
                color: market === m ? '#191F28' : 'var(--text-tertiary, #B0B8C1)',
                background: market === m ? '#FFFFFF' : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              {m === 'KR' ? '한국' : '미국'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)' }}>
          {(['gainers', 'losers'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12,
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#191F28' : 'var(--text-tertiary, #B0B8C1)',
                background: tab === t ? '#FFFFFF' : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              {t === 'gainers' ? '상승' : '하락'}
            </button>
          ))}
        </div>
      </div>

      {/* 카드 리스트 — 가로 스크롤 (모바일) / 그리드 (PC) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 8,
      }}>
        {list.map(item => {
          const isUp = (item.todayChangePct ?? 0) >= 0;
          // 한국 핀테크 톤다운 — 진한 빨강/파랑 자제, 채도 낮춤
          const accentColor = isUp ? '#E08585' : '#7AA0E5';
          const accentBg = isUp ? 'rgba(224,133,133,0.06)' : 'rgba(122,160,229,0.06)';
          const inWatching = watchingSet.has(item.symbol);

          return (
            <div
              key={item.symbol}
              onClick={() => setAnalysisSymbol(item.symbol)}
              role="button"
              tabIndex={0}
              style={{
                padding: 14,
                borderRadius: 12,
                border: '1px solid var(--border-light, #F2F4F6)',
                background: 'var(--surface, #FFFFFF)',
                cursor: 'pointer',
                transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* 종목명 */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.krName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', fontFamily: "'SF Mono', monospace" }}>
                {item.symbol}
              </div>

              {/* 변동 */}
              <div style={{
                marginTop: 4,
                padding: '6px 10px',
                borderRadius: 8,
                background: accentBg,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)' }}>오늘</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>
                  {isUp ? '+' : ''}{item.todayChangePct?.toFixed(2)}%
                </span>
              </div>

              {/* 관심 추가 — 매수 버튼 NO */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (inWatching) return;
                  addStock('watching', {
                    symbol: item.symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0,
                  });
                }}
                disabled={inWatching}
                style={{
                  marginTop: 4,
                  padding: '6px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: inWatching ? 'var(--bg-subtle, #F2F4F6)' : 'rgba(49,130,246,0.08)',
                  color: inWatching ? 'var(--text-tertiary, #B0B8C1)' : '#3182F6',
                  border: 'none',
                  cursor: inWatching ? 'default' : 'pointer',
                }}
              >
                {inWatching ? '✓ 관심' : '관심 추가'}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 10, textAlign: 'right' }}>
        15분 지연 · 158종 universe · {data.cached ? '캐시' : '신규'} · {new Date(data.ranAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </section>
  );
}
