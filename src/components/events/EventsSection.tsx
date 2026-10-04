'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore, fmtDate } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { PresetEvent, QuoteData, EventCacheEntry } from '@/config/constants';
import { Plus, Info, X } from 'lucide-react';
import UndoToast from '@/components/common/UndoToast';
import EmptyState from '@/components/common/EmptyState';
import { useNow } from '@/hooks/useNow';
import EventStockImpactCard from './EventStockImpactCard';
import BottomSheet from '@/components/common/BottomSheet';
import controlStyles from './EventControls.module.css';
import { changeColor, signedChange } from '@/utils/stockTrendPresentation';
import { eventPriceComparison } from '@/utils/eventPriceComparison';
import { useShallow } from 'zustand/react/shallow';

// ─── EventTimeline ───────────────────────────────────────────────────────────
function EventTimeline({ event }: { event: PresetEvent }) {
  const currentTime = useNow();
  const startMs = new Date(event.startDate).getTime();
  const endMs   = event.endDate ? new Date(event.endDate).getTime() : (currentTime || startMs);
  const nowMs   = Math.min(currentTime || startMs, endMs);
  const total   = Math.max(1, Math.round((endMs - startMs) / 86400000));
  const elapsed = Math.round((nowMs - startMs) / 86400000);
  const pct     = Math.max(0, Math.min(Math.round((elapsed / total) * 100), 100));
  const ongoing = !event.endDate;

  // 구간 마커: 90일 초과 → 3개월 단위, 365일 초과 → 6개월 단위
  const stepDays = total > 365 ? 182 : total > 90 ? 91 : 0;
  const markers: { pct: number; label: string }[] = [];
  if (stepDays > 0) {
    for (let d = stepDays; d < total - stepDays * 0.3; d += stepDays) {
      const markerPct = Math.round((d / total) * 100);
      const months    = Math.round(d / 30.5);
      markers.push({ pct: markerPct, label: `+${months}개월` });
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      {ongoing && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
          비교 구간 {elapsed}일째
        </div>
      )}

      {/* Track */}
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--border-light, #F2F4F6)' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`,
          background: 'var(--text-secondary)',
          borderRadius: 2, transition: 'width 0.5s ease',
        }} />

        {/* Interval tick marks */}
        {markers.map((m, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${m.pct}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2, height: 8,
            background: m.pct <= pct ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary, #B0B8C1)',
            borderRadius: 1,
          }} />
        ))}

        {/* Current position dot */}
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10, height: 10, borderRadius: 5,
          background: 'var(--text-secondary)',
          border: '2px solid var(--surface)',
        }} />
      </div>

      {/* Labels row */}
      <div style={{ position: 'relative', height: 18, marginTop: 4 }}>
        <span style={{ position: 'absolute', left: 0, fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap' }}>
          {fmtDate(event.startDate)}
        </span>
        {markers.map((m, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${m.pct}%`,
            transform: 'translateX(-50%)',
            fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap',
          }}>
            {m.label}
          </span>
        ))}
        <span style={{ position: 'absolute', right: 0, fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap' }}>
          {event.endDate ? fmtDate(event.endDate) : '현재'}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function StockCardSkeleton({ symbol, name }: { symbol: string; name?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-light, #F2F4F6)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--bg-subtle)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{STOCK_KR[symbol] || name || symbol}</span>
        </div>
        <div style={{ width: 64, height: 20, borderRadius: 10, background: 'var(--bg-subtle)' }} />
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle)', marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 38, borderRadius: 8, background: 'var(--bg-subtle)' }} />)}
      </div>
    </div>
  );
}

// ─── No data card ────────────────────────────────────────────────────────────
function NoDataCard({ symbol, name }: { symbol: string; name?: string }) {
  const kr = STOCK_KR[symbol] || name || symbol;
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12, marginBottom: 8,
      border: '1px solid var(--border-light)', background: 'var(--bg-subtle)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14, flexShrink: 0,
        background: 'var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
      }}>{kr.charAt(0)}</div>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{STOCK_KR[symbol] || name || symbol}</span>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>이 이벤트 시기 데이터 없음</div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function EventsSection({ embedded = false }: { embedded?: boolean } = {}) {
  const {
    currentEventId, setCurrentEventId,
    getAllEvents, getAllSymbols, stocks,
    macroData, eventCache,
    updateEventCache, updateEventCacheEntry,
    addCustomEvent, deleteCustomEvent, restoreCustomEvent,
  } = usePortfolioStore(useShallow(state => ({
    currentEventId: state.currentEventId, setCurrentEventId: state.setCurrentEventId,
    getAllEvents: state.getAllEvents, getAllSymbols: state.getAllSymbols, stocks: state.stocks,
    macroData: state.macroData, eventCache: state.eventCache, updateEventCache: state.updateEventCache,
    updateEventCacheEntry: state.updateEventCacheEntry, addCustomEvent: state.addCustomEvent,
    deleteCustomEvent: state.deleteCustomEvent, restoreCustomEvent: state.restoreCustomEvent,
  })));

  const [loadingSyms, setLoadingSyms] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [undoToast, setUndoToast] = useState<{ event: PresetEvent } | null>(null);

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
              const entry = eventPriceComparison(d, !ev.endDate, (macroData[s] as QuoteData)?.c);
              if (entry) updateEventCacheEntry(ev.id, s, entry);
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
          const entry = eventPriceComparison(d, !ev.endDate, (macroData[s] as QuoteData)?.c);
          if (entry) updateEventCacheEntry(ev.id, s, entry);
        }
        markDone(s);
      }
    } catch {
      setLoadingSyms(new Set());
    }
  }, [eventCache, macroData, getAllSymbols, updateEventCache, updateEventCacheEntry]);

  useEffect(() => {
    if (!currentEvent) return;
    const frame = requestAnimationFrame(() => {
      void fetchEventData(currentEvent);
    });
    return () => cancelAnimationFrame(frame);
  }, [currentEvent, fetchEventData]);

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
  const stockMap = new Map([...stocks.sold, ...stocks.watching, ...stocks.investing].map(stock => [stock.symbol, stock]));
  const avgCostMap: Record<string, number> = {};
  for (const st of stocks.investing || []) avgCostMap[st.symbol] = st.avgCost;

  return (
    <div>
      {/* Page title */}
      {!embedded && <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>이벤트 비교 분석</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>과거 이벤트 시기의 포트폴리오 성과를 비교해보세요</p>
      </div>}

      {/* Event pill tabs */}
      <div className="scrollbar-hide" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 20 }}>
        {events.map(ev => {
          const isActive = currentEventId === ev.id;
          const isCustom = ev.id.startsWith('c-');
          return (
            <div
              key={ev.id}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'stretch',
                borderRadius: 20,
                overflow: 'hidden',
                border: isActive ? '1px solid var(--text-primary, #191F28)' : '1px solid var(--border-strong, #E5E8EB)',
                background: isActive ? 'var(--pill-active-bg, #191F28)' : 'var(--surface, #FFFFFF)',
                transition: 'all 0.15s',
              }}
            >
              <button
                aria-pressed={isActive}
                onClick={() => setCurrentEventId(ev.id)}
                style={{
                  padding: isCustom ? '8px 4px 8px 14px' : '8px 16px',
                  fontSize: 13, fontWeight: 500, minHeight: 44, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  color: isActive ? 'var(--pill-active-fg, #FFFFFF)' : 'var(--text-secondary, #4E5968)',
                }}
              >
                {ev.emoji} {ev.name}
              </button>
              {isCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const removed = deleteCustomEvent(ev.id);
                    if (!removed) return;
                    // 현재 선택된 이벤트를 삭제한 경우 첫 프리셋으로 이동
                    if (isActive) {
                      const firstPreset = events.find(x => !x.id.startsWith('c-') && x.id !== ev.id);
                      if (firstPreset) setCurrentEventId(firstPreset.id);
                    }
                    setUndoToast({ event: removed });
                  }}
                  aria-label={`${ev.name} 삭제`}
                  title="삭제"
                  className="cursor-pointer"
                  style={{
                    padding: '0 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none',
                    color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary, #B0B8C1)',
                    borderLeft: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border-light, #F2F4F6)',
                  }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>
          );
        })}
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
                {currentEvent.endDate ? '비교 구간 종료' : '비교 진행 중'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 4 }}>
              비교 기간 · {fmtDate(currentEvent.startDate)} ~ {currentEvent.endDate ? fmtDate(currentEvent.endDate) : '현재'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.6 }}>
              {currentEvent.description}
            </div>
            {currentEvent.periodNote && <p style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8, color: 'var(--text-secondary)' }}>
              {currentEvent.periodNote}{' '}
              {currentEvent.periodSource && <a href={currentEvent.periodSource} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>기간 기준 출처</a>}
            </p>}
            {currentEvent.keyFacts && currentEvent.keyFacts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {currentEvent.keyFacts.map((fact, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '3px 9px', borderRadius: 20,
                    background: 'var(--bg-subtle, #F2F4F6)',
                    color: 'var(--text-secondary, #4E5968)',
                  }}>
                    {fact}
                  </span>
                ))}
              </div>
            )}
            <EventTimeline event={currentEvent} />
          </div>

          {/* Stock Impact Cards — 세로 스택 → 와이드 멀티컬럼(표준 .fill-grid) */}
          <div className="fill-grid fill-grid--md" style={{ padding: '16px 16px 8px' }}>
            {syms.length === 0 ? (
              <EmptyState
                variant="compact"
                icon="📊"
                title="분석할 종목이 없어요"
                description="포트폴리오에 종목을 추가하면 비교 기간 동안 내 종목의 가격이 얼마나 달라졌는지 보여드려요."
                primaryAction={{
                  label: '종목 추가하기',
                  onClick: () => {
                    const btn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
                    if (btn) btn.click();
                  },
                }}
              />
            ) : syms.map(s => {
              const ed        = eventData[s] as EventCacheEntry | undefined;
              const isLoading = loadingSyms.has(s) || (!ed && loadingSyms.size > 0);
              const cp        = (macroData[s] as QuoteData)?.c;
              if (isLoading) return <StockCardSkeleton key={s} symbol={s} name={stockMap.get(s)?.name} />;
              if (!ed) return <NoDataCard key={s} symbol={s} name={stockMap.get(s)?.name} />;
              return (
                <EventStockImpactCard key={s} symbol={s} entry={ed} event={currentEvent}
                  name={stockMap.get(s)?.name} currency={stockMap.get(s)?.currency}
                  currentPrice={cp} quoteTime={(macroData[s] as QuoteData)?.t} avgCost={avgCostMap[s]} />
              );
            })}
          </div>

          {/* Insight card */}
          {currentEvent.insight && (
            <div style={{ margin: '0 16px 20px', padding: '16px 20px', background: 'var(--bg-subtle)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Info style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>이 기간을 살펴보는 방법</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{currentEvent.insight}</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) repeat(2, minmax(0, .9fr)) minmax(0, .75fr)', gap: 6, marginBottom: 4 }}>
            {['', '이벤트 당시', '현재', '변동'].map((h, i) => (
              <span key={i} style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
            ))}
          </div>
          {Object.entries(currentEvent.baseMacro).map(([label, baseVal], idx, arr) => {
            const cur      = macroData[label] as { value?: number | null } | undefined;
            const curVal   = cur?.value;
            const chg      = curVal != null && baseVal ? (curVal - baseVal) / baseVal * 100 : null;

            const isLast   = idx === arr.length - 1;
            return (
              <div key={label} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) repeat(2, minmax(0, .9fr)) minmax(0, .75fr)',
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
                <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: chg !== null ? changeColor(chg) : 'var(--text-secondary)' }}>
                  {chg !== null ? `${signedChange(chg)}%` : '--'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddEventModal onClose={() => setShowAddModal(false)} onSave={handleSaveEvent} />}

      {/* 커스텀 이벤트 삭제 Undo 토스트 */}
      {undoToast && (
        <UndoToast
          message={`${undoToast.event.emoji} ${undoToast.event.name} 삭제됨`}
          onUndo={() => {
            restoreCustomEvent(undoToast.event);
            setCurrentEventId(undoToast.event.id);
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
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

  return <BottomSheet isOpen onClose={onClose} ariaLabel="비교할 이벤트 추가" desktopVariant maxHeight="90dvh">
    <form className={controlStyles.form} onSubmit={event => {
      event.preventDefault();
      onSave({ name: name.trim(), startDate, endDate, description: description.trim() });
    }}>
      <header><h2>비교할 이벤트 추가</h2><button type="button" onClick={onClose} aria-label="이벤트 추가 닫기"><X size={20} aria-hidden="true" /></button></header>
      <p>비교하고 싶은 기간을 고르면 그때의 종목 가격을 확인해요.</p>
      <div className={controlStyles.quick} role="group" aria-label="기간 예시">
        {QUICK_EVENTS.map(quick => <button type="button" key={quick.name} aria-pressed={name === quick.name} onClick={() => applyQuick(quick)}>{quick.name}</button>)}
      </div>
      <label htmlFor="event-name">이벤트 이름</label>
      <input id="event-name" required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="예: 미중 무역 분쟁" />
      <div className={controlStyles.dates}>
        <div><label htmlFor="event-start">시작일</label><input id="event-start" required type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></div>
        <div><label htmlFor="event-end">종료일 · 선택</label><input id="event-end" type="date" min={startDate || undefined} value={endDate} onChange={event => setEndDate(event.target.value)} /></div>
      </div>
      <p className={controlStyles.help}>종료일을 비워두면 현재까지 비교해요.</p>
      <label htmlFor="event-description">설명 · 선택</label>
      <input id="event-description" value={description} maxLength={300} onChange={event => setDescription(event.target.value)} placeholder="어떤 일이 있었는지 짧게 남겨보세요" />
      <div className={controlStyles.actions}><button type="button" onClick={onClose}>취소</button><button type="submit" disabled={!name.trim() || !startDate}>저장하기</button></div>
    </form>
  </BottomSheet>;
}
