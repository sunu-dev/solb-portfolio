'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore, fmtDate, delay } from '@/store/portfolioStore';
import { fetchEventCandle } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { PresetEvent, QuoteData, EventCacheEntry } from '@/config/constants';

export default function EventsSection() {
  const {
    currentEventId, setCurrentEventId,
    getAllEvents, getAllSymbols,
    macroData, candleCache, eventCache, apiKey,
    updateEventCache, updateEventCacheEntry,
    customEvents, addCustomEvent,
  } = usePortfolioStore();

  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const events = getAllEvents();
  const currentEvent = events.find(e => e.id === currentEventId) || events[0];

  // Fetch event data
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

    // Fetch from API
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

  // Save new custom event
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
    <div className="mt-4">
      {/* Event tabs (pill style) */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
        {events.map(ev => (
          <button
            key={ev.id}
            onClick={() => setCurrentEventId(ev.id)}
            className={`
              shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap
              ${currentEventId === ev.id
                ? 'bg-[#191F28] text-white'
                : 'bg-white text-[#4E5968] border border-black/[0.06] hover:bg-[#F7F8FA]'
              }
            `}
          >
            {ev.emoji} {ev.name}
          </button>
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold bg-white text-[#3182F6] border border-[#3182F6]/20 hover:bg-[#3182F6]/5 transition-all"
        >
          + 추가
        </button>
      </div>

      {/* Event detail */}
      {currentEvent && (
        <div className="bg-white rounded-[14px] border border-black/[0.06] overflow-hidden">
          {/* Event header */}
          <div className="p-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[16px] font-bold text-[#191F28]">
                {currentEvent.emoji} {currentEvent.name}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                currentEvent.endDate
                  ? 'bg-[#8B95A1]/10 text-[#8B95A1]'
                  : 'bg-[#EF4452]/10 text-[#EF4452]'
              }`}>
                {currentEvent.endDate ? '종료' : '진행중'}
              </span>
            </div>
            <div className="text-[12px] text-[#8B95A1]">
              {fmtDate(currentEvent.startDate)} ~ {currentEvent.endDate ? fmtDate(currentEvent.endDate) : '현재'}
            </div>
            <div className="text-[13px] text-[#4E5968] mt-1">
              {currentEvent.description}
            </div>
          </div>

          {/* Event table */}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-[#8B95A1]">
              데이터를 불러오는 중...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    <th className="text-left px-4 py-2 font-semibold text-[#8B95A1]">종목</th>
                    <th className="text-right px-2 py-2 font-semibold text-[#8B95A1]">기준가</th>
                    <th className="text-right px-2 py-2 font-semibold text-[#8B95A1]">현재가</th>
                    <th className="text-right px-2 py-2 font-semibold text-[#8B95A1]">최대 하락</th>
                    <th className="text-right px-2 py-2 font-semibold text-[#8B95A1]">현재 변동</th>
                    <th className="text-right px-4 py-2 font-semibold text-[#8B95A1]">회복</th>
                  </tr>
                </thead>
                <tbody>
                  {syms.map(s => {
                    const ed = eventData[s] as EventCacheEntry | undefined;
                    const kr = STOCK_KR[s] || '';
                    const cprice = (macroData[s] as QuoteData)?.c;

                    if (ed) {
                      const cc = cprice ? ((cprice - ed.basePrice) / ed.basePrice * 100) : ed.currentChange;
                      const ccGain = cc >= 0;
                      const rec = ed.recovered
                        ? `✅ ${ed.recoveryDays || ''}일`
                        : (currentEvent.endDate ? '❌' : '⏳');
                      return (
                        <tr key={s} className="border-b border-black/[0.04] hover:bg-[#F7F8FA]">
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-[#191F28]">{s}</span>
                            {kr && <span className="text-[10px] text-[#8B95A1] ml-1">{kr}</span>}
                          </td>
                          <td className="text-right px-2 py-2.5">${ed.basePrice.toFixed(2)}</td>
                          <td className="text-right px-2 py-2.5">{cprice ? `$${cprice.toFixed(2)}` : '--'}</td>
                          <td className="text-right px-2 py-2.5 font-bold text-[#3182F6]">{ed.maxDrop.toFixed(1)}%</td>
                          <td className={`text-right px-2 py-2.5 font-bold ${ccGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                            {cc >= 0 ? '+' : ''}{cc.toFixed(1)}%
                          </td>
                          <td className="text-right px-4 py-2.5">{rec}</td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={s} className="border-b border-black/[0.04]">
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-[#191F28]">{s}</span>
                            {kr && <span className="text-[10px] text-[#8B95A1] ml-1">{kr}</span>}
                          </td>
                          <td colSpan={5} className="text-center text-[#8B95A1] py-2.5">데이터 없음</td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Insight */}
          {currentEvent.insight && (
            <div className="px-4 py-3 bg-[#F7F8FA] border-t border-black/[0.06]">
              <div className="text-[12px] text-[#4E5968] leading-relaxed">
                <strong>초보자를 위한 해석:</strong><br />
                {currentEvent.insight}
              </div>
            </div>
          )}
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

// --- Add Event Modal ---
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
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-[440px] mx-auto bg-white rounded-[14px] z-50 p-5 animate-fade-in">
        <h3 className="text-[16px] font-bold text-[#191F28] mb-4">이벤트 추가</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">이벤트명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
              placeholder="예: 미중 무역 분쟁"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">시작일 *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">종료일 (선택)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1">설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
              placeholder="이벤트 설명"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave({ name, startDate, endDate, description })}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
