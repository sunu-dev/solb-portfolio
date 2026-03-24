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
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#191F28]">이벤트 비교 분석</h1>
        <p className="text-[13px] text-[#8B95A1] mt-1">과거 이벤트 시기의 포트폴리오 성과를 비교해보세요</p>
      </div>

      {/* Event tabs */}
      <div className="flex gap-2 overflow-x-auto pb-5 scrollbar-hide">
        {events.map(ev => (
          <button
            key={ev.id}
            onClick={() => setCurrentEventId(ev.id)}
            className={`
              shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap cursor-pointer
              ${currentEventId === ev.id
                ? 'bg-[#191F28] text-white shadow-sm'
                : 'bg-white text-[#4E5968] ring-1 ring-black/[0.06] hover:bg-[#F7F8FA]'
              }
            `}
          >
            {ev.emoji} {ev.name}
          </button>
        ))}
        <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 flex items-center gap-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-white text-[#3182F6] ring-1 ring-[#3182F6]/20 hover:bg-[#3182F6]/[0.04] transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          추가
        </button>
      </div>

      {/* Event detail card */}
      {currentEvent && (
        <div className="bg-white rounded-2xl border border-[#E5E8EB] overflow-hidden">
          {/* Event header */}
          <div className="p-5 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[18px] font-bold text-[#191F28]">
                {currentEvent.emoji} {currentEvent.name}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                currentEvent.endDate
                  ? 'bg-[#8B95A1]/10 text-[#8B95A1]'
                  : 'bg-[#EF4452]/10 text-[#EF4452]'
              }`}>
                {currentEvent.endDate ? '종료' : '진행중'}
              </span>
            </div>
            <div className="text-[12px] text-[#8B95A1] mb-1">
              {fmtDate(currentEvent.startDate)} ~ {currentEvent.endDate ? fmtDate(currentEvent.endDate) : '현재'}
            </div>
            <div className="text-[13px] text-[#4E5968] leading-relaxed">
              {currentEvent.description}
            </div>
          </div>

          {/* Event table */}
          {loading ? (
            <div className="flex items-center justify-center h-40 text-[13px] text-[#8B95A1]">
              데이터를 불러오는 중...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#F2F4F6] bg-[#F9FAFB]">
                    <th className="text-left px-5 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">종목</th>
                    <th className="text-right px-3 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">기준가</th>
                    <th className="text-right px-3 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">현재가</th>
                    <th className="text-right px-3 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">최대 하락</th>
                    <th className="text-right px-3 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">현재 변동</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-[#8B95A1] text-[11px] uppercase tracking-wider">회복</th>
                  </tr>
                </thead>
                <tbody>
                  {syms.map((s, idx) => {
                    const ed = eventData[s] as EventCacheEntry | undefined;
                    const kr = STOCK_KR[s] || '';
                    const cprice = (macroData[s] as QuoteData)?.c;

                    if (ed) {
                      const cc = cprice ? ((cprice - ed.basePrice) / ed.basePrice * 100) : ed.currentChange;
                      const ccGain = cc >= 0;

                      return (
                        <tr key={s} className={`border-b border-[#F2F4F6] hover:bg-[#F9FAFB] transition-colors ${idx === syms.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#191F28]">{s}</span>
                              {kr && <span className="text-[11px] text-[#8B95A1]">{kr}</span>}
                            </div>
                          </td>
                          <td className="text-right px-3 py-3.5 tabular-nums text-[#4E5968]">${ed.basePrice.toFixed(2)}</td>
                          <td className="text-right px-3 py-3.5 tabular-nums font-semibold text-[#191F28]">{cprice ? `$${cprice.toFixed(2)}` : '--'}</td>
                          <td className="text-right px-3 py-3.5">
                            <span className="font-bold text-[#3182F6] tabular-nums">{ed.maxDrop.toFixed(1)}%</span>
                          </td>
                          <td className="text-right px-3 py-3.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-bold tabular-nums ${
                              ccGain ? 'bg-[#EF4452]/[0.06] text-[#EF4452]' : 'bg-[#3182F6]/[0.06] text-[#3182F6]'
                            }`}>
                              {cc >= 0 ? '+' : ''}{cc.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center px-5 py-3.5">
                            {ed.recovered ? (
                              <span className="inline-flex items-center gap-1 text-[12px] text-[#34C759] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {ed.recoveryDays ? `${ed.recoveryDays}일` : '회복'}
                              </span>
                            ) : currentEvent.endDate ? (
                              <span className="inline-flex items-center gap-1 text-[12px] text-[#EF4452] font-semibold">
                                <XCircle className="w-3.5 h-3.5" />
                                미회복
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[12px] text-[#FF9500] font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                진행중
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={s} className="border-b border-[#F2F4F6]">
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-[#191F28]">{s}</span>
                            {kr && <span className="text-[11px] text-[#8B95A1] ml-2">{kr}</span>}
                          </td>
                          <td colSpan={5} className="text-center text-[#B0B8C1] py-3.5">데이터 없음</td>
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
            <div className="px-5 py-4 bg-[#F7F8FA] border-t border-[#F2F4F6]">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#3182F6] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-bold text-[#3182F6] mb-1">초보자를 위한 해석</div>
                  <div className="text-[12px] text-[#4E5968] leading-relaxed">
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
        <div className="mt-4 bg-white rounded-2xl border border-[#E5E8EB] p-5">
          <div className="text-[14px] font-bold text-[#191F28] mb-3">매크로 지표 비교</div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(currentEvent.baseMacro).map(([label, baseVal]) => {
              const current = macroData[label] as { value?: number | null } | undefined;
              const currentVal = current?.value;
              const changeVal = currentVal && baseVal ? ((currentVal - baseVal) / baseVal * 100) : null;
              const isUp = changeVal !== null ? changeVal >= 0 : true;

              return (
                <div key={label} className="p-3 bg-[#F7F8FA] rounded-xl text-center">
                  <div className="text-[11px] text-[#8B95A1] mb-1">{label}</div>
                  <div className="text-[12px] text-[#B0B8C1] mb-0.5 tabular-nums">{baseVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                  {changeVal !== null && (
                    <div className={`text-[12px] font-bold tabular-nums ${isUp ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
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
      <div className="fixed inset-0 bg-black/20 z-50 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-[480px] mx-auto bg-white rounded-2xl z-50 p-6 shadow-xl animate-fade-in">
        <h3 className="text-[18px] font-bold text-[#191F28] mb-5">이벤트 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">이벤트명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
              placeholder="예: 미중 무역 분쟁"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">시작일 *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">종료일 (선택)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
              placeholder="이벤트 설명"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-[#4E5968] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={() => onSave({ name, startDate, endDate, description })}
            className="flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors cursor-pointer"
          >
            저장
          </button>
        </div>
      </div>
    </>
  );
}
