'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData } from '@/hooks/useStockData';

export default function SettingsPanel() {
  const {
    apiKey, setApiKey,
    autoRefresh, setAutoRefresh,
    refreshInterval, setRefreshInterval,
  } = usePortfolioStore();
  const { refreshAll } = useStockData();

  const [isOpen, setIsOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [intervalSec, setIntervalSec] = useState(String(refreshInterval / 1000));

  // Listen for toggle event from Header
  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-settings', handler);
    return () => window.removeEventListener('toggle-settings', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-settings-panel]') && !target.closest('[title="Settings"]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isOpen]);

  const handleSaveApiKey = () => {
    const k = newApiKey.trim();
    if (k) {
      setApiKey(k);
      alert('저장됨');
      setNewApiKey('');
      refreshAll();
    }
  };

  const handleUpdateInterval = () => {
    const sec = parseInt(intervalSec);
    if (sec >= 10) {
      setRefreshInterval(sec * 1000);
    }
  };

  const handleClearAll = () => {
    if (confirm('전체 초기화할까요?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/10 z-40" onClick={() => setIsOpen(false)} />

      {/* Panel */}
      <div
        data-settings-panel
        className="fixed top-14 right-0 w-[320px] max-h-[calc(100vh-56px)] bg-white rounded-bl-[14px] shadow-lg border-l border-b border-black/[0.06] z-50 overflow-y-auto animate-fade-in"
      >
        <div className="p-5">
          <h3 className="text-[16px] font-bold text-[#191F28] mb-5">설정</h3>

          {/* API Key */}
          <div className="mb-5">
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">
              Finnhub API Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={apiKey ? '•••••••• (변경 시 입력)' : 'API Key 입력'}
                className="flex-1 px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors"
              >
                저장
              </button>
            </div>
          </div>

          {/* Auto refresh toggle */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#4E5968]">자동 새로고침</label>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${autoRefresh ? 'bg-[#3182F6]' : 'bg-[#E5E8EB]'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                    ${autoRefresh ? 'translate-x-[22px]' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Refresh interval */}
          <div className="mb-5">
            <label className="text-[12px] font-semibold text-[#4E5968] block mb-1.5">
              새로고침 간격 (초)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                min="10"
                className="flex-1 px-3 py-2 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-1 focus:ring-[#3182F6]/30"
              />
              <button
                onClick={handleUpdateInterval}
                className="px-3 py-2 rounded-xl text-[12px] font-semibold text-[#3182F6] bg-[#3182F6]/10 hover:bg-[#3182F6]/20 transition-colors"
              >
                적용
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-black/[0.06] my-4" />

          {/* Clear data */}
          <button
            onClick={handleClearAll}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-[#EF4452] bg-[#EF4452]/5 hover:bg-[#EF4452]/10 transition-colors"
          >
            전체 데이터 초기화
          </button>
        </div>
      </div>
    </>
  );
}
