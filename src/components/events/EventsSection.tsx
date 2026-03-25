'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore, fmtDate, delay } from '@/store/portfolioStore';
import { fetchEventCandle } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { PresetEvent, QuoteData, EventCacheEntry } from '@/config/constants';
import { Plus, CheckCircle2, Clock, XCircle, Info } from 'lucide-react';

export default function EventsSection() {
  const {
    currentEventId, setCurrentEventId,
    getAllEvents, getAllSymbols,
    macroData, candleCache, eventCache, apiKey,
    updateEventCache, updateEventCacheEntry,
    addCustomEvent,
  } = usePortfolioStore();

  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const events = getAllEvents();
  const currentEvent = events.find(e => e.id === currentEventId) || events[0];

  const fetchEventData = useCallback(async (ev: PresetEvent) => {
    if (eventCache[ev.id] && Object.keys(eventCache[ev.id]).length) return;
    setLoading(true);
    updateEventCache(ev.id, {});
    const syms = getAllSymbols();

    if (ev.basePrices && Object.keys(ev.basePrices).length) {
      for (const s of syms) {
        const bp = ev.basePrices[s];
        if (!bp) continue;
        const cp = (macroData[s] as QuoteData)?.c || 0;
        const cc = cp ? ((cp - bp) / bp * 100) : 0;
        const pre = ev.precomputed?.[s];
        if (pre) {
          updateEventCacheEntry(ev.id, s, {
            basePrice: bp,
            maxDrop: pre.maxDrop,
            currentChange: cc || pre.maxDrop * 0.5,
            recovered: pre.recovered,
            recoveryDays: pre.recoveryDays,
          });
        } else {
          const candle = candleCache[s];
          let md = cc;
          if (candle) {
            const vals = Object.values(candle).filter(v => v < 0);
            if (vals.length) md = Math.min(...vals, cc);
          }
          updateEventCacheEntry(ev.id, s, {
            basePrice: bp,
            maxDrop: Math.min(md, 0),
            currentChange: cc,
            recovered: cc >= 0,
            recoveryDays: null,
          });
        }
      }
      setLoading(false);
      return;
    }

    const baseTs = Math.floor(new Date(ev.baseDate).getTime() / 1000);
    const endTs = ev.endDate ? Math.floor(new Date(ev.endDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
    for (const s of syms) {
      const d = await fetchEventCandle(s, baseTs, endTs, apiKey);
      if (d && d.c.length > 1) {
        const bp = d.c[0], low = Math.min(...d.c), last = d.c[d.c.length - 1];
        const ri = d.c.findIndex((c, i) => i > d.c.indexOf(low) && c >= bp);
        updateEventCacheEntry(ev.id, s, {
          basePrice: bp,
          maxDrop: ((low - bp) / bp * 100),
          currentChange: ((last - bp) / bp * 100),
          recovered: ri !== -1,
          recoveryDays: ri !== -1 ? ri : null,
        });
      }
      await delay(200);
    }
    setLoading(false);
  }, [apiKey, eventCache, macroData, candleCache, getAllSymbols, updateEventCache, updateEventCacheEntry]);

  useEffect(() => {
    if (currentEvent) fetchEventData(currentEvent);
  }, [currentEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEvent = (formData: { name: string; startDate: string; endDate: string; description: string }) => {
    if (!formData.name || !formData.startDate) {
      alert('이름과 시작일은 필수입니다.');
      return;
    }
    const start = new Date(formData.startDate);
    start.setDate(start.getDate() - 1);
    const ne: PresetEvent = {
      id: 'c-' + Date.now(),
      name: formData.name,
      emoji: '📌',
      startDate: formData.startDate,
      baseDate: start.toISOString().split('T')[0],
      endDate: formData.endDate || null,
      description: formData.description || formData.name,
      insight: '',
      basePrices: {},
      baseMacro: {},
    };
    addCustomEvent(ne);
    setCurrentEventId(ne.id);
    setShowAddModal(false);
  };

  const syms = getAllSymbols();
  const eventData = eventCache[currentEventId] || {};

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#191F28', marginBottom: '4px' }}>이벤트 비교 분석</h1>
        <p style={{ fontSize: '13px', color: '#8B95A1' }}>과거 이벤트 시기의 포트폴리오 성과를 비교해보세요</p>
      </div>

      {/* Event pill tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '20px' }}>
        {events.map(ev => (
          <button
            key={ev.id}
            onClick={() => setCurrentEventId(ev.id)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s',
              border: currentEventId === ev.id ? '1px solid #191F28' : '1px solid #E5E8EB',
              background: currentEventId === ev.id ? '#191F28' : '#FFFFFF',
              color: currentEventId === ev.id ? '#FFFFFF' : '#4E5968',
            }}
          >
            {ev.emoji} {ev.name}
          </button>
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 500,
            background: '#FFFFFF',
            color: '#3182F6',
            border: '1px solid rgba(49, 130, 246, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Plus style={{ width: '14px', height: '14px' }} />
          추가
        </button>
      </div>

      {/* Event detail card */}
      {currentEvent && (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E8EB', overflow: 'hidden' }}>
          {/* Event header */}
          <div style={{ padding: '20px', borderBottom: '1px solid #F2F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#191F28' }}>
                {currentEvent.emoji} {currentEvent.name}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
                background: currentEvent.endDate ? 'rgba(139, 149, 161, 0.1)' : 'rgba(239, 68, 82, 0.1)',
                color: currentEvent.endDate ? '#8B95A1' : '#EF4452',
              }}>
                {currentEvent.endDate ? '종료' : '진행중'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#8B95A1', lineHeight: 1.6, marginBottom: '4px' }}>
              {fmtDate(currentEvent.startDate)} ~ {currentEvent.endDate ? fmtDate(currentEvent.endDate) : '현재'}
            </div>
            <div style={{ fontSize: '13px', color: '#8B95A1', lineHeight: 1.6 }}>
              {currentEvent.description}
            </div>
          </div>

          {/* Event table */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '13px', color: '#8B95A1' }}>
              데이터를 불러오는 중...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0 20px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>종목</th>
                    <th style={{ textAlign: 'right', padding: '0 12px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>기준가</th>
                    <th style={{ textAlign: 'right', padding: '0 12px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>현재가</th>
                    <th style={{ textAlign: 'right', padding: '0 12px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>최대 하락</th>
                    <th style={{ textAlign: 'right', padding: '0 12px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>현재 변동</th>
                    <th style={{ textAlign: 'center', padding: '0 20px 12px', fontSize: '12px', fontWeight: 600, color: '#B0B8C1', borderBottom: '1px solid #F2F4F6' }}>회복</th>
                  </tr>
                </thead>
                <tbody>
                  {syms.map((s) => {
                    const ed = eventData[s] as EventCacheEntry | undefined;
                    const kr = STOCK_KR[s] || '';
                    const cprice = (macroData[s] as QuoteData)?.c;

                    if (ed) {
                      const cc = cprice ? ((cprice - ed.basePrice) / ed.basePrice * 100) : ed.currentChange;
                      const ccGain = cc >= 0;

                      return (
                        <tr key={s} style={{ borderTop: '1px solid #F7F8FA' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#191F28' }}>{s}</span>
                              {kr && <span style={{ fontSize: '11px', color: '#8B95A1' }}>{kr}</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '14px 12px', fontSize: '14px', fontVariantNumeric: 'tabular-nums', color: '#4E5968' }}>${ed.basePrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '14px 12px', fontSize: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#191F28' }}>{cprice ? `$${cprice.toFixed(2)}` : '--'}</td>
                          <td style={{ textAlign: 'right', padding: '14px 12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#3182F6', fontVariantNumeric: 'tabular-nums' }}>{ed.maxDrop.toFixed(1)}%</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '14px 12px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              background: ccGain ? 'rgba(239, 68, 82, 0.06)' : 'rgba(49, 130, 246, 0.06)',
                              color: ccGain ? '#EF4452' : '#3182F6',
                            }}>
                              {cc >= 0 ? '+' : ''}{cc.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', padding: '14px 20px' }}>
                            {ed.recovered ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#34C759', fontWeight: 600 }}>
                                <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                                {ed.recoveryDays ? `${ed.recoveryDays}일` : '회복'}
                              </span>
                            ) : currentEvent.endDate ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#EF4452', fontWeight: 600 }}>
                                <XCircle style={{ width: '14px', height: '14px' }} />
                                미회복
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#FF9500', fontWeight: 600 }}>
                                <Clock style={{ width: '14px', height: '14px' }} />
                                진행중
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={s} style={{ borderTop: '1px solid #F7F8FA' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#191F28' }}>{s}</span>
                            {kr && <span style={{ fontSize: '11px', color: '#8B95A1', marginLeft: '8px' }}>{kr}</span>}
                          </td>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#B0B8C1', padding: '14px 0' }}>데이터 없음</td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Insight card */}
          {currentEvent.insight && (
            <div style={{
              margin: '0 20px 20px',
              marginTop: '24px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #EBF3FF, #F5EEFF)',
              borderRadius: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                <Info style={{ width: '16px', height: '16px', color: '#3182F6', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#3182F6', marginBottom: '8px' }}>초보자를 위한 해석</div>
                  <div style={{ fontSize: '14px', color: '#4E5968', lineHeight: 1.6 }}>
                    {currentEvent.insight}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Macro comparison */}
      {currentEvent && currentEvent.baseMacro && Object.keys(currentEvent.baseMacro).length > 0 && (
        <div style={{ marginTop: '16px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E8EB', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#191F28', marginBottom: '12px' }}>매크로 지표 비교</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {Object.entries(currentEvent.baseMacro).map(([label, baseVal]) => {
              const current = macroData[label] as { value?: number | null } | undefined;
              const currentVal = current?.value;
              const changeVal = currentVal && baseVal ? ((currentVal - baseVal) / baseVal * 100) : null;
              const isUp = changeVal !== null ? changeVal >= 0 : true;

              return (
                <div key={label} style={{ padding: '12px', background: '#F7F8FA', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8B95A1', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: '#B0B8C1', marginBottom: '2px', fontVariantNumeric: 'tabular-nums' }}>{baseVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                  {changeVal !== null && (
                    <div style={{ fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isUp ? '#EF4452' : '#3182F6' }}>
                      {isUp ? '+' : ''}{changeVal.toFixed(1)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <AddEventModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  );
}

function AddEventModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; startDate: string; endDate: string; description: string }) => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 50,
          backdropFilter: 'blur(1px)',
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', left: '16px', right: '16px', top: '50%', transform: 'translateY(-50%)',
        maxWidth: '480px', margin: '0 auto', background: '#FFFFFF', borderRadius: '16px',
        zIndex: 50, padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#191F28', marginBottom: '20px' }}>이벤트 추가</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4E5968', marginBottom: '6px' }}>이벤트명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 미중 무역 분쟁"
              style={{
                width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: '12px',
                fontSize: '14px', outline: 'none', border: 'none',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4E5968', marginBottom: '6px' }}>시작일 *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: '12px',
                  fontSize: '14px', outline: 'none', border: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4E5968', marginBottom: '6px' }}>종료일 (선택)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: '12px',
                  fontSize: '14px', outline: 'none', border: 'none',
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4E5968', marginBottom: '6px' }}>설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이벤트 설명"
              style={{
                width: '100%', padding: '10px 14px', background: '#F2F4F6', borderRadius: '12px',
                fontSize: '14px', outline: 'none', border: 'none',
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              color: '#4E5968', background: '#F2F4F6', border: 'none', cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => onSave({ name, startDate, endDate, description })}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
