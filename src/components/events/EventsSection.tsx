'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore, fmtDate } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { PresetEvent, QuoteData, EventCacheEntry } from '@/config/constants';
import { Plus, CheckCircle2, Clock, XCircle, Info } from 'lucide-react';

// ─── Severity helper ────────────────────────────────────────────────────────
function getSeverity(maxDrop: number) {
  const d = Math.abs(maxDrop);
  if (d < 10) return { label: '경미', bg: 'rgba(52,199,89,0.1)',  color: '#34C759' };
  if (d < 30) return { label: '보통', bg: 'rgba(255,149,0,0.1)',  color: '#FF9500' };
  return         { label: '심각', bg: 'rgba(239,68,82,0.1)',  color: '#EF4452' };
}

// ─── EventTimeline ───────────────────────────────────────────────────────────
function EventTimeline({ event }: { event: PresetEvent }) {
  const startMs = new Date(event.startDate).getTime();
  const endMs   = event.endDate ? new Date(event.endDate).getTime() : Date.now();
  const nowMs   = Math.min(Date.now(), endMs);
  const total   = Math.max(1, Math.round((endMs - startMs) / 86400000));
  const elapsed = Math.round((nowMs - startMs) / 86400000);
  const pct     = Math.min(Math.round((elapsed / total) * 100), 100);
  const ongoing = !event.endDate;

  return (
    <div style={{ marginTop: 14 }}>
      {ongoing && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4452', marginBottom: 8 }}>
          진행중 {elapsed}일째
        </div>
      )}
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--border-light, #F2F4F6)' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`,
          background: ongoing ? 'linear-gradient(90deg, #3182F6, #EF4452)' : '#B0B8C1',
          borderRadius: 2, transition: 'width 0.5s ease',
        }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10, height: 10, borderRadius: 5,
          background: ongoing ? '#EF4452' : '#8B95A1',
          border: '2px solid white',
          boxShadow: ongoing ? '0 0 0 3px rgba(239,68,82,0.2)' : 'none',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6 }}>
        <span>{fmtDate(event.startDate)}</span>
        <span>{event.endDate ? fmtDate(event.endDate) : '현재'}</span>
      </div>
    </div>
  );
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function StockCardSkeleton({ symbol }: { symbol: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-light, #F2F4F6)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: '#F2F4F6' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{symbol}</span>
        </div>
        <div style={{ width: 64, height: 20, borderRadius: 10, background: '#F2F4F6' }} />
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#F2F4F6', marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 38, borderRadius: 8, background: '#F2F4F6' }} />)}
      </div>
    </div>
  );
}

// ─── No data card ────────────────────────────────────────────────────────────
function NoDataCard({ symbol }: { symbol: string }) {
  const kr = STOCK_KR[symbol] || '';
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, marginBottom: 8,
      border: '1px solid rgba(255,149,0,0.2)', background: 'rgba(255,149,0,0.03)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14, flexShrink: 0,
        background: getAvatarColor(symbol),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: 'white',
      }}>{symbol.slice(0, 2)}</div>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{symbol}</span>
        {kr && <span style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginLeft: 6 }}>{kr}</span>}
        <div style={{ fontSize: 11, color: '#FF9500', marginTop: 2 }}>이 이벤트 시기 데이터 없음</div>
      </div>
    </div>
  );
}

// ─── Stock Impact Card ───────────────────────────────────────────────────────
interface StockImpactCardProps {
  symbol: string;
  entry: EventCacheEntry;
  event: PresetEvent;
  currentPrice?: number;
  avgCost?: number;
}

function StockImpactCard({ symbol, entry, event, currentPrice, avgCost }: StockImpactCardProps) {
  const kr      = STOCK_KR[symbol] || '';
  const ongoing = !event.endDate;
  const sv      = getSeverity(entry.maxDrop);

  // Prefer live price for current change; for precomputed-only entries without live price → show maxDrop
  const cc: number | null = currentPrice && entry.basePrice > 0
    ? (currentPrice - entry.basePrice) / entry.basePrice * 100
    : entry.dataSource !== 'precomputed' ? entry.currentChange : null;
  const ccGain = cc !== null && cc >= 0;

  // Personal P&L from user's avg cost
  const personalPL = avgCost && currentPrice ? (currentPrice - avgCost) / avgCost * 100 : null;

  // Impact bar
  const drop    = Math.abs(entry.maxDrop);
  const barW    = Math.min(drop / 50 * 100, 100);
  const barCol  = drop < 10 ? '#34C759' : drop < 30 ? '#FF9500' : '#EF4452';

  // Recovery cell
  const RecoveryCellContent = () => {
    if (entry.recovered) return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>회복</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#34C759', display: 'flex', alignItems: 'center', gap: 3 }}>
          <CheckCircle2 style={{ width: 12, height: 12 }} />
          {entry.recoveryDays ? `${entry.recoveryDays}일` : '완료'}
        </div>
      </div>
    );
    if (ongoing) return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>회복</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FF9500', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock style={{ width: 12, height: 12 }} /> 진행중
        </div>
      </div>
    );
    return (
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>회복</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4452', display: 'flex', alignItems: 'center', gap: 3 }}>
          <XCircle style={{ width: 12, height: 12 }} /> 미회복
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: 16, borderRadius: 12, marginBottom: 8,
      border: '1px solid var(--border-light, #F2F4F6)',
      background: 'var(--surface, #FFFFFF)',
    }}>
      {/* Row 1: Symbol + severity badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14, flexShrink: 0,
            background: getAvatarColor(symbol),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: 'white',
          }}>{symbol.slice(0, 2)}</div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{symbol}</span>
            {kr && <span style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginLeft: 6 }}>{kr}</span>}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: sv.bg, color: sv.color }}>
          {sv.label} {entry.maxDrop.toFixed(1)}%
        </span>
      </div>

      {/* Impact bar */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border-light, #F2F4F6)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barW}%`, background: barCol, borderRadius: 3, transition: 'width 0.7s ease' }} />
      </div>

      {/* 3 micro-stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <div style={{ background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>기준가</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', fontVariantNumeric: 'tabular-nums' }}>
            ${entry.basePrice.toFixed(2)}
          </div>
        </div>
        <div style={{ background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>
            {cc !== null ? '현재 변동' : '최대 하락'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cc !== null ? (ccGain ? '#EF4452' : '#3182F6') : '#3182F6' }}>
            {cc !== null ? `${cc >= 0 ? '+' : ''}${cc.toFixed(1)}%` : `${entry.maxDrop.toFixed(1)}%`}
          </div>
        </div>
        <div style={{ background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 8, padding: '8px 10px' }}>
          <RecoveryCellContent />
        </div>
      </div>

      {/* Personal P&L row (only for investing stocks with live price) */}
      {personalPL !== null && (
        <div style={{ marginTop: 8, padding: '7px 10px', background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)' }}>내 평단 기준 현재</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: personalPL >= 0 ? '#EF4452' : '#3182F6' }}>
            {personalPL >= 0 ? '+' : ''}{personalPL.toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>(${avgCost?.toFixed(2)} 매수)</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function EventsSection() {
  const {
    currentEventId, setCurrentEventId,
    getAllEvents, getAllSymbols, stocks,
    macroData, eventCache,
    updateEventCache, updateEventCacheEntry,
    addCustomEvent,
  } = usePortfolioStore();

  const [loadingSyms, setLoadingSyms] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);

  const events      = getAllEvents();
  const currentEvent = events.find(e => e.id === currentEventId) || events[0];

  const fetchEventData = useCallback(async (ev: PresetEvent) => {
    if (eventCache[ev.id] && Object.keys(eventCache[ev.id]).length) return;

    const syms = getAllSymbols();
    updateEventCache(ev.id, {});
    setLoadingSyms(new Set(syms));

    const markDone = (s: string) =>
      setLoadingSyms(prev => { const n = new Set(prev); n.delete(s); return n; });

    // ── Preset events with basePrices ──────────────────────────────────────
    if (ev.basePrices && Object.keys(ev.basePrices).length) {
      // 1. Stocks that exist in basePrices
      const inBase    = syms.filter(s => ev.basePrices[s]);
      const notInBase = syms.filter(s => !ev.basePrices[s]);

      for (const s of inBase) {
        const bp  = ev.basePrices[s];
        const cp  = (macroData[s] as QuoteData)?.c;
        const cc  = cp ? (cp - bp) / bp * 100 : null;
        const pre = ev.precomputed?.[s];
        if (pre) {
          updateEventCacheEntry(ev.id, s, {
            basePrice: bp,
            maxDrop: pre.maxDrop,
            currentChange: cc ?? pre.maxDrop,
            recovered: pre.recovered,
            recoveryDays: pre.recoveryDays,
            dataSource: cc !== null ? 'actual' : 'precomputed',
          });
        } else {
          updateEventCacheEntry(ev.id, s, {
            basePrice: bp,
            maxDrop: cc !== null ? Math.min(cc, 0) : 0,
            currentChange: cc ?? 0,
            recovered: cc !== null ? cc >= 0 : false,
            recoveryDays: null,
            dataSource: cc !== null ? 'actual' : 'precomputed',
          });
        }
        markDone(s);
      }

      // 2. Fetch historical data for stocks NOT in basePrices
      if (notInBase.length) {
        const from = Math.floor(new Date(ev.baseDate).getTime() / 1000);
        const to   = ev.endDate ? Math.floor(new Date(ev.endDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
        try {
          const res = await fetch('/api/event-candles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: notInBase, from, to }),
          });
          const map: Record<string, { s: string; t?: number[]; c?: number[] }> = await res.json();
          for (const s of notInBase) {
            const d = map[s];
            if (d?.s === 'ok' && d.c && d.c.length > 1) {
              const bp    = d.c[0];
              const low   = Math.min(...d.c);
              const last  = d.c[d.c.length - 1];
              const lowI  = d.c.indexOf(low);
              const ri    = d.c.findIndex((v, i) => i > lowI && v >= bp);
              const cp    = (macroData[s] as QuoteData)?.c;
              updateEventCacheEntry(ev.id, s, {
                basePrice: bp,
                maxDrop: (low - bp) / bp * 100,
                currentChange: cp ? (cp - bp) / bp * 100 : (last - bp) / bp * 100,
                recovered: ri !== -1 || (cp ? cp >= bp : last >= bp),
                recoveryDays: ri !== -1 ? ri : null,
                dataSource: 'fetched',
              });
            }
            markDone(s);
          }
        } catch {
          notInBase.forEach(markDone);
        }
      }
      return;
    }

    // ── Custom events: batch fetch all symbols ──────────────────────────────
    const from = Math.floor(new Date(ev.baseDate).getTime() / 1000);
    const to   = ev.endDate ? Math.floor(new Date(ev.endDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
    try {
      const res = await fetch('/api/event-candles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: syms, from, to }),
      });
      const map: Record<string, { s: string; t?: number[]; c?: number[] }> = await res.json();
      for (const s of syms) {
        const d = map[s];
        if (d?.s === 'ok' && d.c && d.c.length > 1) {
          const bp   = d.c[0];
          const low  = Math.min(...d.c);
          const last = d.c[d.c.length - 1];
          const lowI = d.c.indexOf(low);
          const ri   = d.c.findIndex((v, i) => i > lowI && v >= bp);
          updateEventCacheEntry(ev.id, s, {
            basePrice: bp,
            maxDrop: (low - bp) / bp * 100,
            currentChange: (last - bp) / bp * 100,
            recovered: ri !== -1,
            recoveryDays: ri !== -1 ? ri : null,
            dataSource: 'fetched',
          });
        }
        markDone(s);
      }
    } catch {
      setLoadingSyms(new Set());
    }
  }, [eventCache, macroData, getAllSymbols, updateEventCache, updateEventCacheEntry]);

  useEffect(() => {
    if (currentEvent) fetchEventData(currentEvent);
  }, [currentEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEvent = (data: { name: string; startDate: string; endDate: string; description: string }) => {
    if (!data.name || !data.startDate) { alert('이름과 시작일은 필수입니다.'); return; }
    const start = new Date(data.startDate);
    start.setDate(start.getDate() - 1);
    const ne: PresetEvent = {
      id: 'c-' + Date.now(), name: data.name, emoji: '📌',
      startDate: data.startDate, baseDate: start.toISOString().split('T')[0],
      endDate: data.endDate || null,
      description: data.description || data.name, insight: '', basePrices: {}, baseMacro: {},
    };
    addCustomEvent(ne);
    setCurrentEventId(ne.id);
    setShowAddModal(false);
  };

  const syms      = getAllSymbols();
  const eventData = eventCache[currentEventId] || {};
  const avgCostMap: Record<string, number> = {};
  for (const st of stocks.investing || []) avgCostMap[st.symbol] = st.avgCost;

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>이벤트 비교 분석</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>과거 이벤트 시기의 포트폴리오 성과를 비교해보세요</p>
      </div>

      {/* Event pill tabs */}
      <div className="scrollbar-hide" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 20 }}>
        {events.map(ev => (
          <button key={ev.id} onClick={() => setCurrentEventId(ev.id)} style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: 20,
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
            transition: 'all 0.15s',
            border: currentEventId === ev.id ? '1px solid var(--text-primary, #191F28)' : '1px solid var(--border-strong, #E5E8EB)',
            background: currentEventId === ev.id ? 'var(--text-primary, #191F28)' : 'var(--surface, #FFFFFF)',
            color: currentEventId === ev.id ? '#FFFFFF' : 'var(--text-secondary, #4E5968)',
          }}>
            {ev.emoji} {ev.name}
          </button>
        ))}
        <button onClick={() => setShowAddModal(true)} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          background: 'var(--surface, #FFFFFF)', color: '#3182F6',
          border: '1px solid rgba(49,130,246,0.2)', cursor: 'pointer', transition: 'all 0.15s',
        }}>
          <Plus style={{ width: 14, height: 14 }} /> 추가
        </button>
      </div>

      {/* Event detail card */}
      {currentEvent && (
        <div style={{ background: 'var(--surface, #FFFFFF)', borderRadius: 16, border: '1px solid var(--border-strong, #E5E8EB)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                {currentEvent.emoji} {currentEvent.name}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                background: currentEvent.endDate ? 'rgba(139,149,161,0.1)' : 'rgba(239,68,82,0.1)',
                color: currentEvent.endDate ? '#8B95A1' : '#EF4452',
              }}>
                {currentEvent.endDate ? '종료' : '진행중'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 4 }}>
              {fmtDate(currentEvent.startDate)} ~ {currentEvent.endDate ? fmtDate(currentEvent.endDate) : '현재'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.6 }}>
              {currentEvent.description}
            </div>
            <EventTimeline event={currentEvent} />
          </div>

          {/* Stock Impact Cards */}
          <div style={{ padding: '16px 16px 8px' }}>
            {syms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary, #B0B8C1)', fontSize: 14 }}>
                포트폴리오에 종목을 추가하면 이벤트 영향을 분석해드려요
              </div>
            ) : syms.map(s => {
              const ed        = eventData[s] as EventCacheEntry | undefined;
              const isLoading = loadingSyms.has(s) || (!ed && loadingSyms.size > 0);
              const cp        = (macroData[s] as QuoteData)?.c;
              if (isLoading) return <StockCardSkeleton key={s} symbol={s} />;
              if (!ed) return <NoDataCard key={s} symbol={s} />;
              return (
                <StockImpactCard key={s} symbol={s} entry={ed} event={currentEvent}
                  currentPrice={cp} avgCost={avgCostMap[s]} />
              );
            })}
          </div>

          {/* Insight card */}
          {currentEvent.insight && (
            <div style={{ margin: '0 16px 20px', padding: '16px 20px', background: 'linear-gradient(135deg, #EBF3FF, #F5EEFF)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Info style={{ width: 16, height: 16, color: '#3182F6', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3182F6', marginBottom: 6 }}>초보자를 위한 해석</div>
                  <div style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.7 }}>{currentEvent.insight}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Macro comparison — vertical row layout */}
      {currentEvent?.baseMacro && Object.keys(currentEvent.baseMacro).length > 0 && (
        <div style={{ marginTop: 16, background: 'var(--surface, #FFFFFF)', borderRadius: 16, border: '1px solid var(--border-strong, #E5E8EB)', padding: '20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 14 }}>매크로 지표 비교</div>
          {/* Column header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 76px 56px', gap: 6, marginBottom: 4 }}>
            {['', '이벤트 당시', '현재', '변동'].map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
            ))}
          </div>
          {Object.entries(currentEvent.baseMacro).map(([label, baseVal], idx, arr) => {
            const cur      = macroData[label] as { value?: number | null } | undefined;
            const curVal   = cur?.value;
            const chg      = curVal != null && baseVal ? (curVal - baseVal) / baseVal * 100 : null;
            const isUp     = chg !== null ? chg >= 0 : true;
            const isLast   = idx === arr.length - 1;
            return (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: '1fr 76px 76px 56px',
                alignItems: 'center', gap: 6, padding: '10px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-light, #F2F4F6)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{label}</span>
                <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--text-tertiary, #B0B8C1)', fontVariantNumeric: 'tabular-nums' }}>
                  {baseVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--text-primary, #191F28)', fontVariantNumeric: 'tabular-nums' }}>
                  {curVal != null ? curVal.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '--'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: chg !== null ? (isUp ? '#EF4452' : '#3182F6') : 'var(--text-tertiary, #B0B8C1)' }}>
                  {chg !== null ? `${isUp ? '+' : ''}${chg.toFixed(1)}%` : '--'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddEventModal onClose={() => setShowAddModal(false)} onSave={handleSaveEvent} />}
    </div>
  );
}

// ─── Add Event Modal ─────────────────────────────────────────────────────────
const QUICK_EVENTS = [
  { name: '미중 무역전쟁', emoji: '🇺🇸', startDate: '2018-03-22', endDate: '2019-01-15', description: '미중 관세 전쟁. 기술주 중심 급락.' },
  { name: '금리인상 쇼크', emoji: '📈', startDate: '2022-01-01', endDate: '2023-06-30', description: '연준 급격한 금리인상. 나스닥 -35%.' },
  { name: 'SVB 파산', emoji: '🏦', startDate: '2023-03-08', endDate: '2023-05-01', description: '실리콘밸리뱅크 파산. 은행권 패닉.' },
  { name: '엔캐리 청산', emoji: '🇯🇵', startDate: '2024-07-31', endDate: '2024-09-01', description: '일본 금리인상발 엔캐리 청산 급락.' },
  { name: '트럼프 관세', emoji: '🔒', startDate: '2025-04-02', endDate: '2025-06-01', description: '트럼프 상호관세 발표. 글로벌 증시 급락.' },
];

function AddEventModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; startDate: string; endDate: string; description: string }) => void;
}) {
  const [name, setName]               = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [description, setDescription] = useState('');

  const applyQuick = (q: typeof QUICK_EVENTS[0]) => {
    setName(q.name); setStartDate(q.startDate);
    setEndDate(q.endDate); setDescription(q.description);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 50, backdropFilter: 'blur(1px)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
        maxWidth: 480, margin: '0 auto', background: '#FFFFFF', borderRadius: 16,
        zIndex: 51, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#191F28', marginBottom: 16 }}>이벤트 추가</h3>

        {/* Quick picks */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 8 }}>빠른 선택</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_EVENTS.map(q => (
              <button key={q.name} onClick={() => applyQuick(q)} style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: name === q.name ? '#191F28' : '#F2F4F6',
                color: name === q.name ? '#FFFFFF' : '#4E5968',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {q.emoji} {q.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6 }}>이벤트명 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 미중 무역 분쟁"
              style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: 12, fontSize: 14, outline: 'none', border: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6 }}>시작일 *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: 12, fontSize: 14, outline: 'none', border: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6 }}>종료일 (선택)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: 12, fontSize: 14, outline: 'none', border: 'none' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6 }}>설명</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="이벤트 설명"
              style={{ width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: 12, fontSize: 14, outline: 'none', border: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#4E5968', background: '#F2F4F6', border: 'none', cursor: 'pointer' }}>취소</button>
          <button onClick={() => onSave({ name, startDate, endDate, description })} style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </>
  );
}
