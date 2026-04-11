'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import type { MacroEntry } from '@/config/constants';
import { getMarketStatus } from '@/utils/marketStatus';
import { isTodayHoliday, getUpcomingHolidays } from '@/config/marketHolidays';

export default function MarketSummary() {
  const { macroData } = usePortfolioStore();

  const sp = macroData['S&P 500'] as MacroEntry | undefined;
  const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;
  const usdkrw = macroData['USD/KRW'] as MacroEntry | undefined;

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

  const spCp = sp?.changePercent || 0;
  const nasdaqCp = nasdaq?.changePercent || 0;
  const krwVal = usdkrw?.value || 0;

  const ms = getMarketStatus();
  const isUSPreMarket = ms.us.labelSimple === '프리장';
  const krHoliday = isTodayHoliday('KR');
  const usHoliday = isTodayHoliday('US');
  const upcoming = getUpcomingHolidays(3);

  const avgChange = (spCp + nasdaqCp) / 2;
  let sentiment = '보합세';
  if (avgChange < -1) sentiment = '하락세';
  else if (avgChange < 0) sentiment = '소폭 하락';
  else if (avgChange > 1) sentiment = '상승세';
  else if (avgChange > 0) sentiment = '소폭 상승';

  return (
    <div style={{ background: 'var(--surface, white)', borderBottom: '1px solid var(--border-light, #F2F4F6)', position: 'relative', zIndex: 10 }}>
      <div
        className="flex items-center mx-auto market-summary-bar"
        style={{ maxWidth: '1200px', padding: '10px 48px', gap: '12px', overflow: 'hidden' }}
      >
        <style>{`
          @media (max-width: 1024px) {
            .market-summary-bar { padding: 8px 24px !important; gap: 8px !important; }
          }
          @media (max-width: 768px) {
            .market-summary-bar { padding: 6px 16px !important; }
            .market-sentiment-label { display: none !important; }
            .market-status-next { display: none !important; }
          }
          @media (max-width: 480px) {
            .market-usdkrw-chip { display: none !important; }
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

        {/* Indices Chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* S&P 500 Chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
            borderRadius: '100px', background: spCp >= 0 ? 'rgba(239, 68, 82, 0.06)' : 'rgba(49, 130, 246, 0.06)',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>S&P 500</span>
            <span className="market-summary-text" style={{ fontSize: '13px', fontWeight: 700, color: spCp >= 0 ? '#EF4452' : '#3182F6' }}>
              {spCp >= 0 ? '+' : ''}{spCp.toFixed(2)}%
            </span>
            {isUSPreMarket && <span style={{ fontSize: '10px', color: '#B0B8C1' }}>전일</span>}
          </div>

          {/* NASDAQ Chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
            borderRadius: '100px', background: nasdaqCp >= 0 ? 'rgba(239, 68, 82, 0.06)' : 'rgba(49, 130, 246, 0.06)',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>나스닥</span>
            <span className="market-summary-text" style={{ fontSize: '13px', fontWeight: 700, color: nasdaqCp >= 0 ? '#EF4452' : '#3182F6' }}>
              {nasdaqCp >= 0 ? '+' : ''}{nasdaqCp.toFixed(2)}%
            </span>
            {isUSPreMarket && <span style={{ fontSize: '10px', color: '#B0B8C1' }}>전일</span>}
          </div>

          {/* 환율 Chip */}
          {krwVal > 0 && (() => {
            const krwCp = usdkrw?.changePercent || 0;
            const krwWeakening = krwCp > 0;
            return (
              <div className="market-usdkrw-chip" style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                borderRadius: '100px', background: 'var(--bg-subtle, #F8F9FA)',
                whiteSpace: 'nowrap', border: '1px solid var(--border-light, #F2F4F6)'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>환율</span>
                <span className="market-usdkrw" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                  {krwVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: krwWeakening ? '#EF4452' : '#3182F6' }}>
                  {krwWeakening ? '▲' : '▼'}{Math.abs(krwCp).toFixed(1)}%
                </span>
              </div>
            );
          })()}

          {/* Sentiment Text */}
          <span className="market-sentiment market-sentiment-label" style={{ fontSize: '12px', color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 500, whiteSpace: 'nowrap', marginLeft: '4px' }}>
            &mdash; {sentiment}
          </span>
        </div>

        {/* Market Status (Right) */}
        <div className="flex items-center gap-3 shrink-0 ml-auto" style={{ fontSize: '11px', fontWeight: 500 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: krHoliday ? '#8B95A1' : ms.kr.color }} />
            <span style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600 }}>KR</span>
            <span className="market-status-next" style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>
              {krHoliday ? '휴장' : ms.kr.nextEvent}
            </span>
          </div>
          <div style={{ width: '1px', height: '10px', background: 'var(--border-light, #F2F4F6)' }} />
          <div className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: usHoliday ? '#8B95A1' : ms.us.color }} />
            <span style={{ color: 'var(--text-primary, #191F28)', fontWeight: 600 }}>US</span>
            <span className="market-status-next" style={{ color: 'var(--text-tertiary, #B0B8C1)' }}>
              {usHoliday ? '휴장' : isUSPreMarket ? `프리장 · ${ms.us.nextEvent}` : ms.us.nextEvent}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5" style={{ color: 'var(--text-tertiary, #B0B8C1)', fontSize: '10px' }}>
            <span>15분 지연</span>
          </div>
        </div>
      </div>
    </div>
  );
}
