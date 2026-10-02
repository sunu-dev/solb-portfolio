'use client';

import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { MacroEntry } from '@/config/constants';
import { getMarketStatus } from '@/utils/marketStatus';
import { useNow } from '@/hooks/useNow';
import { isTodayHoliday, getUpcomingHolidaysForMarket } from '@/config/marketHolidays';
import type { MacroIndicatorsResponse } from '@/app/api/macro-indicators/route';

type MarketKey = 'KR' | 'US';

type TickerItem = {
  label: string;
  displayVal: string;
  /** null이면 변동 표시 생략 (비교 대상 없음 — 0으로 위장하지 않는다) */
  cp: number | null;
  isUSDKRW: boolean;
  /** true면 변동값을 손익색 대신 중립 회색으로 — 금리 등락은 손익이 아니다 (§6 valence) */
  neutral?: boolean;
  /** 변동값 단위. 기본 '%'. 금리는 '%p'(퍼센트포인트 차이) */
  unit?: string;
};

type TickerExplanation = {
  title: string;
  description: string;
};

const TICKER_EXPLANATIONS: Record<string, TickerExplanation> = {
  'S&P 500': {
    title: 'S&P 500',
    description: '미국을 대표하는 대형 상장기업 500곳의 주가 흐름을 모아 보여주는 지수예요. 미국 증시 전반의 분위기를 볼 때 많이 사용해요.',
  },
  NASDAQ: {
    title: '나스닥 종합지수',
    description: '나스닥 시장에 상장된 기업들의 주가 흐름을 모은 지수예요. 기술기업 비중이 커서 성장주 분위기를 살펴볼 때 자주 봐요.',
  },
  '다우존스': {
    title: '다우존스 산업평균지수',
    description: '미국의 대표적인 우량기업 30곳의 주가 흐름을 보여주는 지수예요. 역사가 길고 전통 산업과 대형주의 움직임을 살펴보기 좋아요.',
  },
  '코스피': {
    title: '코스피',
    description: '유가증권시장에 상장된 국내 기업들의 주가 흐름을 나타내는 대표 지수예요. 국내 대형주와 전체 시장 분위기를 볼 때 사용해요.',
  },
  '코스닥': {
    title: '코스닥',
    description: '코스닥 시장에 상장된 국내 기업들의 주가 흐름을 나타내는 지수예요. 성장기업과 중소형 기술주의 움직임이 비교적 크게 반영돼요.',
  },
  WTI: {
    title: 'WTI 원유',
    description: '미국 서부 텍사스산 원유의 기준 가격이에요. 국제 유가와 에너지 비용, 물가 흐름을 살펴볼 때 대표적으로 사용해요.',
  },
  VIX: {
    title: 'VIX 변동성지수',
    description: 'S&P 500 옵션 가격으로 앞으로 약 30일간 예상되는 시장 변동성을 계산한 지수예요. 수치가 높을수록 시장의 불안이 큰 편으로 해석해요.',
  },
  'USD/KRW': {
    title: '원·달러 환율',
    description: '미국 1달러를 사는 데 필요한 원화 금액이에요. 숫자가 오르면 원화 약세, 내리면 원화 강세를 뜻해요.',
  },
  '미 국채 10년': {
    title: '미국 국채 10년물 금리',
    description: '미국 정부가 발행한 만기 10년 국채의 시장 금리예요. 장기 금리와 경기·물가 기대를 보여주며 주식 가치 평가에도 영향을 줘요.',
  },
};

// ─── RAF 기반 마퀴 — 재렌더링에도 위치 유지 ────────────────────────────────
const MarqueeTicker = memo(function MarqueeTicker({ items }: { items: TickerItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const dialogOpenRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [activeItem, setActiveItem] = useState<TickerItem | null>(null);

  const closeExplanation = useCallback(() => {
    dialogOpenRef.current = false;
    setActiveItem(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openExplanation = useCallback((item: TickerItem, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    dialogOpenRef.current = true;
    setActiveItem(item);
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeExplanation();
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, closeExplanation]);

  useEffect(() => {
    const speed = 0.5; // px/frame @ 60fps ≈ 30px/s

    const tick = () => {
      const track = trackRef.current;
      if (track && !pausedRef.current && !dialogOpenRef.current) {
        posRef.current -= speed;
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && Math.abs(posRef.current) >= halfWidth) {
          posRef.current += halfWidth;
        }
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // 한 번만 — 데이터 업데이트에도 루프 재시작 없음

  return (
    <div
      ref={trackRef}
      style={{ display: 'flex', willChange: 'transform' }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {[...items, ...items].map((item, idx) => (
        <button
          key={`${item.label}-${idx}`}
          type="button"
          aria-haspopup="dialog"
          aria-label={`${TICKER_EXPLANATIONS[item.label]?.title ?? item.label} 설명 보기`}
          onClick={event => openExplanation(item, event.currentTarget)}
          onFocus={() => { pausedRef.current = true; }}
          onBlur={() => { pausedRef.current = false; }}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 14px 5px 0', whiteSpace: 'nowrap', flexShrink: 0,
            background: 'transparent', border: 0, cursor: 'help', font: 'inherit',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#8B95A1' }}>{item.label}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#191F28' }}>{item.displayVal}</span>
          {item.cp != null && (
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: item.neutral ? '#8B95A1' : item.cp >= 0 ? '#EF4452' : '#3182F6',
            }}>
              {item.cp >= 0 ? '+' : ''}{item.cp.toFixed(2)}{item.unit ?? '%'}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#E5E8EB', margin: '0 4px' }}>|</span>
        </button>
      ))}
      {activeItem && TICKER_EXPLANATIONS[activeItem.label] && createPortal(
        <div
          role="presentation"
          onPointerDown={closeExplanation}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, background: 'rgba(25,31,40,0.28)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-term-title"
            aria-describedby="market-term-description"
            onPointerDown={event => event.stopPropagation()}
            style={{
              width: 'min(340px, calc(100vw - 32px))', padding: '20px 20px 18px',
              borderRadius: 18, background: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border-light, #F2F4F6)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)', color: 'var(--text-primary, #191F28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-body)', marginBottom: 5 }}>
                  시장 지표
                </div>
                <h2 id="market-term-title" style={{ margin: 0, fontSize: 17, lineHeight: 1.4, fontWeight: 750 }}>
                  {TICKER_EXPLANATIONS[activeItem.label].title}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="설명 닫기"
                onClick={closeExplanation}
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                  border: 0, background: 'var(--bg-subtle, #F2F4F6)',
                  color: 'var(--text-body, #4E5968)', fontSize: 22, lineHeight: 1, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <p id="market-term-description" style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.65, color: 'var(--text-body, #4E5968)' }}>
              {TICKER_EXPLANATIONS[activeItem.label].description}
            </p>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light, #F2F4F6)', fontSize: 11, lineHeight: 1.55, color: 'var(--text-tertiary, #8B95A1)' }}>
              옆의 등락률은 이전 거래일 종가와 비교한 변화예요.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
});

function MarketPopover({ market, ms, onClose }: { market: MarketKey; ms: ReturnType<typeof getMarketStatus>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const isKR = market === 'KR';
  const status = isKR ? ms.kr : ms.us;

  const sessions = isKR ? [
    { label: '동시호가', time: '08:30 – 09:00', note: '매수·매도 주문 접수' },
    { label: '정규장', time: '09:00 – 15:30', note: '종가 동시호가 포함 · KRX 기준' },
    { label: '종가단일가', time: '15:20 – 15:30', note: '종가 결정' },
    { label: '시간외 종가', time: '15:40 – 16:00', note: '당일 종가로 거래' },
    { label: '시간외 단일가', time: '16:00 – 18:00', note: '10분 단위 단일가 거래' },
  ] : [
    { label: '프리마켓', time: '04:00 – 09:30 ET', note: '미국 동부시간 · 증권사별 지원 상이' },
    { label: '정규장', time: '09:30 – 16:00 ET', note: '미국 동부시간 · 조기 종료일 제외' },
    { label: '애프터마켓', time: '16:00 – 20:00 ET', note: '미국 동부시간 · 조기 종료일 제외' },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 1000,
      background: 'white', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      border: '1px solid var(--border-light, #F2F4F6)', padding: '16px 20px', minWidth: 240,
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
        다음 일정: <span style={{ fontWeight: 600, color: '#191F28' }}>{status.nextEvent}</span>
      </div>

      {/* 휴장 일정 섹션 — 9인 패널 회의 결과 (D-30 시야, market별 자동 필터) */}
      {(() => {
        const upcoming = getUpcomingHolidaysForMarket(market, 30);
        if (upcoming.length === 0) return null;
        return (
          <section
            aria-label="휴장 일정"
            style={{ borderTop: '1px solid var(--border-light, #F2F4F6)', paddingTop: 10, marginBottom: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12 }}>📅</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8B95A1', letterSpacing: 0.3 }}>
                휴장 일정
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {upcoming.slice(0, 6).map(h => {
                const dn = h.isToday ? '오늘' : `D-${h.daysAhead}`;
                const md = h.date.slice(5).replace('-', '/');
                const isUrgent = h.isToday;
                return (
                  <div
                    key={h.date}
                    role="listitem"
                    aria-label={
                      h.isToday
                        ? `오늘, ${h.weekdayKr}요일, ${h.label} 휴장`
                        : `${h.daysAhead}일 뒤, ${h.weekdayKr}요일 ${md}, ${h.label} 휴장`
                    }
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: 6,
                      fontSize: 11, lineHeight: 1.5,
                    }}
                  >
                    <span style={{
                      fontWeight: 700, minWidth: 32,
                      color: isUrgent ? '#EF4452' : '#191F28',
                      fontFamily: "'SF Mono', monospace",
                    }}>
                      {dn}
                    </span>
                    <span style={{ color: '#8B95A1', minWidth: 50 }}>
                      {h.weekdayKr} {md}
                    </span>
                    <span style={{ color: isUrgent ? '#EF4452' : '#191F28', fontWeight: isUrgent ? 600 : 500 }}>
                      {h.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      <div style={{ borderTop: '1px solid var(--border-light, #F2F4F6)', paddingTop: 10 }}>
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
        <div style={{ fontSize: 10, color: '#B0B8C1', borderTop: '1px solid var(--border-light, #F2F4F6)', paddingTop: 8, marginTop: 4 }}>
          상태 배지는 정규장 기준이며, 휴장·조기 종료일에는 일정이 달라요.
        </div>
      )}
    </div>
  );
}

const TICKER_LABELS = ['S&P 500', 'NASDAQ', '다우존스', '코스피', '코스닥', 'WTI', 'VIX', 'USD/KRW'];

export default function MarketSummary() {
  const now = useNow();
  const { macroData } = usePortfolioStore();
  const [activeMarket, setActiveMarket] = useState<MarketKey | null>(null);
  const marketStatusRef = useRef<HTMLDivElement>(null);

  const sp = macroData['S&P 500'] as MacroEntry | undefined;
  const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;

  // 미 국채 10년물 — 리포트 탭 지표 카드와 **같은 엔드포인트**를 읽는다.
  // 각각 다른 URL을 쓰면 CDN 엔트리가 분리돼 같은 화면에 다른 기준일이 병존할 수 있다
  // (2026-08-19 재감사). 실패 시 항목 자체를 생략.
  const [us10y, setUs10y] = useState<MacroIndicatorsResponse['us10y']>(null);
  useEffect(() => {
    fetch('/api/macro-indicators')
      .then(r => (r.ok ? r.json() : null))
      .then((d: MacroIndicatorsResponse | null) => {
        if (d?.us10y && typeof d.us10y.yield10y === 'number') setUs10y(d.us10y);
      })
      .catch(() => {});
  }, []);

  const tickerItems = useMemo(() => {
    const items = TICKER_LABELS.map(label => {
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
    }).filter(Boolean) as TickerItem[];
    if (us10y) {
      items.push({
        label: '미 국채 10년',
        displayVal: `${us10y.yield10y.toFixed(2)}%`,
        cp: us10y.changePp,
        isUSDKRW: false,
        neutral: true,
        unit: '%p',
      });
    }
    return items;
  }, [macroData, us10y]);

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

  const ms = getMarketStatus(new Date(now));
  const isUSPreMarket = ms.us.labelSimple === '프리장';
  const krHoliday = isTodayHoliday('KR');
  const usHoliday = isTodayHoliday('US');
  // 다가오는 휴장은 KR/US popover 내부로 이동 (9인 패널 회의 결과)
  // 상단 바엔 당일 휴장 빨간 뱃지만 노출.

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
        `}</style>

        {/* 당일 휴장 뱃지 — 가장 시급한 정보, 상단 바에 유지 */}
        {(krHoliday || usHoliday) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px',
              borderRadius: '100px', background: 'rgba(239,68,82,0.08)',
              border: '1px solid rgba(239,68,82,0.15)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '10px' }}>🚫</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#EF4452' }}>
              {krHoliday && usHoliday ? `KR·US 휴장 — ${krHoliday.label}` :
               krHoliday ? `KR 휴장 — ${krHoliday.label}` :
               `US 휴장 — ${usHoliday!.label}`}
            </span>
          </div>
        )}

        {/* 다가오는 휴장 정보는 KR/US popover 내부 "휴장 일정" 섹션으로 이동
            (9인 패널 회의 결과 — 한국 휴장은 KR popover에, 미국 휴장은 US popover에) */}

        {/* Indices Marquee Ticker */}
        {tickerItems.length > 0 && (
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <MarqueeTicker items={tickerItems} />
          </div>
        )}

        {/* Market Status (Right) */}
        <div ref={marketStatusRef} className="flex items-center gap-3 shrink-0 ml-auto" style={{ fontSize: '11px', fontWeight: 500, position: 'relative' }}>
          <button
            onClick={() => setActiveMarket(activeMarket === 'KR' ? null : 'KR')}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s', ...(activeMarket === 'KR' ? { background: 'var(--bg-subtle, #F2F4F6)' } : {}) }}
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'background 0.15s', ...(activeMarket === 'US' ? { background: 'var(--bg-subtle, #F2F4F6)' } : {}) }}
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
