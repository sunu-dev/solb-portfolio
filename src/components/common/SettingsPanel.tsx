'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData } from '@/hooks/useStockData';
import { X, Key, RefreshCw, Trash2, Timer } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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
    if (confirm('전체 초기화할까요? 모든 데이터가 삭제됩니다.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/10 z-50 backdrop-blur-xs" onClick={() => setIsOpen(false)} />

      {/* Panel - slides from right */}
      <div
        data-settings-panel
        className="fixed top-0 right-0 bottom-0 w-[380px] max-w-full bg-white z-50 shadow-2xl animate-slide-in flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#E5E8EB] shrink-0">
          <h3 className="text-[16px] font-bold text-[#191F28]">설정</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg hover:bg-[#F2F4F6] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#4E5968]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* API Key */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-[#8B95A1]" />
              <label className="text-[13px] font-bold text-[#191F28]">Finnhub API Key</label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={apiKey ? '변경 시 새 키 입력' : 'API Key 입력'}
                className="flex-1 px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white bg-[#3182F6] hover:bg-[#1B64DA] transition-colors shrink-0"
              >
                저장
              </button>
            </div>
            {apiKey && (
              <div className="mt-1.5 text-[11px] text-[#B0B8C1]">
                현재: {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
              </div>
            )}
          </div>

          <div className="h-px bg-[#F2F4F6]" />

          {/* Auto refresh toggle */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#8B95A1]" />
                <label className="text-[13px] font-bold text-[#191F28]">자동 새로고침</label>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${autoRefresh ? 'bg-[#3182F6]' : 'bg-[#E5E8EB]'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform
                    ${autoRefresh ? 'translate-x-[22px]' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>
            <p className="text-[11px] text-[#8B95A1] mt-1 ml-6">활성화 시 주기적으로 시세를 업데이트합니다</p>
          </div>

          {/* Refresh interval */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-[#8B95A1]" />
              <label className="text-[13px] font-bold text-[#191F28]">새로고침 간격</label>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                  min="10"
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F6] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#3182F6]/30 transition-all pr-10 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#B0B8C1]">초</span>
              </div>
              <button
                onClick={handleUpdateInterval}
                className="px-4 py-2.5 rounded-xl text-[12px] font-semibold text-[#3182F6] bg-[#3182F6]/10 hover:bg-[#3182F6]/20 transition-colors shrink-0"
              >
                적용
              </button>
            </div>
          </div>

          <div className="h-px bg-[#F2F4F6]" />

          {/* Danger zone */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-4 h-4 text-[#EF4452]" />
              <label className="text-[13px] font-bold text-[#EF4452]">위험 구역</label>
            </div>
            <button
              onClick={handleClearAll}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-[#EF4452] bg-[#EF4452]/[0.05] hover:bg-[#EF4452]/10 ring-1 ring-[#EF4452]/10 transition-colors"
            >
              전체 데이터 초기화
            </button>
            <p className="text-[11px] text-[#B0B8C1] mt-1.5 text-center">
              모든 종목, 설정, 캐시 데이터가 삭제됩니다
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
