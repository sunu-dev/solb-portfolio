'use client';

import { useState, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { MacroEntry } from '@/config/constants';
import { getMarketStatus } from '@/utils/marketStatus';
import { isTodayHoliday, getUpcomingHolidays } from '@/config/marketHolidays';

type MarketKey = 'KR' | 'US';

function MarketPopover({ market, ms, onClose }: { market: MarketKey; ms: ReturnType<typeof getMarketStatus>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const dst = new Date().getMonth() >= 2 && new Date().getMonth() <= 9;
  const isKR = market === 'KR';
  const status = isKR ? ms.kr : ms.us;

  const sessions = isKR ? [
    { label: '동시호가', time: '08:30 – 09:00', note: '매수·매도 주문 접수' },
    { label: '정규장', time: '09:00 – 15:20', note: '일반 거래' },
    { label: '종가단일가', time: '15:20 – 15:30', note: '종가 결정' },
    { label: '시간외 종가', time: '15:40 – 16:00', note: '전일 종가로 거래' },
    { label: '시간외 대량', time: '16:00 – 18:00', note: '대량 매매' },
  ] : [
    { label: '프리마켓', time: dst ? '17:00 – 22:30' : '18:00 – 23:30', note: '한국시간 기준' },
    { label: '본장', time: dst ? '22:30 – 05:00' : '23:30 – 06:00', note: '한국시간 기준 (자정 경과)' },
    { label: '애프터마켓', time: dst ? '05:00 – 09:00' : '06:00 – 10:00', note: '한국시간 기준' },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 1000,
      background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      border: '1px solid #F2F4F6', padding: '16px 20px', minWidth: 240,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: status.color }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>
          {isKR ? '한국 주식시장' : '미국 주식시장'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: status.color, marginLeft: 4 }}>
          {status.labelSimple}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#8B95A1', marginBottom: 10 }}>
        다음 이벤트: <span style={{ fontWeight: 600, color: '#191F28' }}>{status.nextEvent}</span>
      </div>
      <div style={{ borderTop: '1px solid #F2F4F6', paddingTop: 10 }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#191F28' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#B0B8C1' }}>{s.note}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#8B95A1', whiteSpace: 'nowrap' }}>{s.time}</div>
          </div>
        ))}
      </div>
      {!isKR && (
        <div style={{ fontSize: 10, color: '#B0B8C1', borderTop: '1px solid #F2F4F6', paddingTop: 8, marginTop: 4 }}>
          서머타임 {dst ? '적용 중' : '미적용'}
        </div>
      )}
    </div>
  );
}

export default function MarketSummary() {
  const { macroData } = usePortfolioStore();
  const [activeMarket, setActiveMarket] = useState<MarketKey | null>(null);
  const marketStatusRef = useRef<HTMLDivElement>(null);

  const sp = macroData['S&P 500'] as MacroEntry | undefined;
  const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;

  const TICKER_LABELS = ['S&P 500', 'NASDAQ', '다우존스', '코스피', '코스닥', 'WTI', 'VIX', 'USD/KRW'];

  const tickerItems = TICKER_LABELS.map(label => {
    const entry = macroData[label] as MacroEntry | undefined;
    if (!entry?.value) return null;
    const cp = entry.changePercent || 0;
    const val = entry.value;
    const isUSDKRW = label === 'USD/KRW';
    const isVIX = label === 'VIX';
    const displayVal = isUSDKRW
      ? val.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : isVIX
      ? val.toFixed(2)
      : val >= 1000
      ? val.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : val.toFixed(2);
    return { label, displayVal, cp, isUSDKRW };
  }).filter(Boolean) as { label: string; displayVal: string; cp: number; isUSDKRW: boolean }[];

  // No data yet
  if (!sp?.value && !nasdaq?.value) {
    return (
      <div style={{ background: 'var(--surface, white)', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
        <div
          className="flex items-center mx-auto market-summary-bar"
          style={{ maxWidth: '1200px', padding: '10px 48px', gap: '8px' }}
        >
          <div className="skeleton-shimmer" style={{ width: '120px', height: '24px', borderRadius: '12px' }} />
          <div className="skeleton-shimmer" style={{ width: '120px', height: '24px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  const ms = getMarketStatus();
  const isUSPreMarket = ms.us.labelSimple === '프리장';
  const krHoliday = isTodayHoliday('KR');
  const usHoliday = isTodayHoliday('US');
  const upcoming = getUpcomingHolidays(3);


  return (
    <div style={{ background: 'var(--surface, white)', borderBottom: '1px solid var(--border-light, #F2F4F6)', position: 'relative', zIndex: 10 }}>
      <div
        className="flex items-center mx-auto market-summary-bar"
        style={{ maxWidth: '1200px', padding: '10px 48px', gap: '12px' }}
      >
        <style>{`
          @media (max-width: 1024px) {
            .market-summary-bar { padding: 8px 24px !important; gap: 8px !important; }
          }
          @media (max-width: 768px) {
            .market-summary-bar { padding: 6px 16px !important; }
            .market-status-next { display: none !important; }
          }
          @keyframes marquee-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            animation: marquee-scroll 18s linear infinite;
          }
          .marquee-track:hover {
            animation-play-state: paused;
          }
        `}</style>

        {/* 휴장 뱃지 */}
        {(krHoliday || usHoliday) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px',
            borderRadius: '100px', background: 'rgba(239,68,82,0.08)',
            border: '1px solid rgba(239,68,82,0.15)', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span style={{ fontSize: '10px' }}>🚫</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#EF4452' }}>
              {krHoliday && usHoliday ? `KR·US 휴장 — ${krHoliday.label}` :
               krHoliday ? `KR 휴장 — ${krHoliday.label}` :
               `US 휴장 — ${usHoliday!.label}`}
            </span>
          </div>
        )}

        {/* 다가오는 휴장 (오늘 아닌 경우) */}
        {!krHoliday && !usHoliday && upcoming.length > 0 && (
          <div className="hidden lg:flex" style={{
            alignItems: 'center', gap: '4px', padding: '3px 8px',
            borderRadius: '100px', background: 'var(--bg-subtle, #F8F9FA)',
            border: '1px solid var(--border-light, #F2F4F6)', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span style={{ fontSize: '10px' }}>📅</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 500 }}>
              {upcoming[0].date.slice(5).replace('-', '/')} {upcoming[0].label} ({upcoming[0].market}) 휴장
            </span>
          </div>
        )}

        {/* Indices Marquee Ticker */}
        {tickerItems.length > 0 && (
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <div className="marquee-track">
              {[...tickerItems, ...tickerItems].map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 14px 3px 0', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A1' }}>{item.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#191F28' }}>{item.displayVal}</span>
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    color: item.isUSDKRW
                      ? (item.cp > 0 ? '#EF4452' : '#3182F6')
                      : (item.cp >= 0 ? '#EF4452' : '#3182F6'),
                  }}>
                    {item.cp >= 0 ? '+' : ''}{item.cp.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#E5E8EB', margin: '0 4px' }}>|</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Status (Right) */}
        <div ref={marketStatusRef} className="flex items-center gap-3 shrink-0 ml-auto" style={{ fontSize: '11px', fontWeight: 500, position: 'relative' }}>
          <button
            onClick={() => setActiveMarket(activeMarket === 'KR' ? null : 'KR')}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s', ...(activeMarket === 'KR' ? { background: '#F2F4F6' } : {}) }}
          >
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: krHoliday ? '#8B95A1' : ms.kr.color }} />
            <span style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600 }}>국내장</span>
            <span className="market-status-next" style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>
              {krHoliday ? '휴장' : ms.kr.nextEvent}
            </span>
          </button>
          <div style={{ width: '1px', height: '10px', background: 'var(--border-light, #F2F4F6)' }} />
          <button
            onClick={() => setActiveMarket(activeMarket === 'US' ? null : 'US')}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s', ...(activeMarket === 'US' ? { background: '#F2F4F6' } : {}) }}
          >
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: usHoliday ? '#8B95A1' : ms.us.color }} />
            <span style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600 }}>미장</span>
            <span className="market-status-next" style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>
              {usHoliday ? '휴장' : isUSPreMarket ? `프리장 · ${ms.us.nextEvent}` : ms.us.nextEvent}
            </span>
          </button>
          <div className="hidden lg:flex items-center gap-1.5" style={{ color: 'var(--text-tertiary, #B0B8C1)', fontSize: '10px' }}>
            <span>15분 지연</span>
          </div>
          {activeMarket && (
            <MarketPopover market={activeMarket} ms={ms} onClose={() => setActiveMarket(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
