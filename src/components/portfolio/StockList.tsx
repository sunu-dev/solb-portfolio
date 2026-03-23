'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { StockCategory, QuoteData } from '@/config/constants';

const TABS: { id: StockCategory; label: string }[] = [
  { id: 'short', label: '단기' },
  { id: 'long', label: '장기' },
  { id: 'watch', label: '관심' },
];

// Deterministic color for avatar based on symbol
const AVATAR_COLORS = ['#3182F6', '#EF4452', '#00C6BE', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#34C759'];
function getAvatarColor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function StockList() {
  const {
    stocks, currentTab, macroData,
    setCurrentTab, setAnalysisSymbol,
    deleteStock, setEditingCat, setEditingIdx,
  } = usePortfolioStore();

  const list = stocks[currentTab] || [];

  const handleDelete = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const stock = list[idx];
    const kr = STOCK_KR[stock.symbol] || stock.symbol;
    if (confirm(`${kr} (${stock.symbol})을(를) 삭제할까요?`)) {
      deleteStock(currentTab, idx);
    }
  };

  const handleEdit = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setEditingCat(currentTab);
    setEditingIdx(idx);
  };

  return (
    <div>
      {/* Section header with tabs */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-bold text-[#191F28]">보유 종목</h2>
        <div className="flex bg-[#F2F4F6] rounded-lg p-[3px]">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
              className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-all ${
                currentTab === tab.id
                  ? 'bg-white text-[#191F28] shadow-sm'
                  : 'text-[#8B95A1]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stock rows */}
      {list.length === 0 ? (
        <div className="bg-white rounded-2xl py-12 text-center">
          <div className="text-[32px] mb-2">📊</div>
          <div className="text-[14px] text-[#8B95A1]">종목이 없습니다</div>
          <div className="text-[12px] text-[#B0B8C1] mt-1">위 검색창에서 추가하세요</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden">
          {list.map((stock, i) => {
            const d = macroData[stock.symbol] as QuoteData | undefined;
            const price = d?.c || 0;
            const cp = d?.dp || 0;
            const kr = STOCK_KR[stock.symbol] || stock.symbol;
            const isGain = cp >= 0;
            const avatarColor = getAvatarColor(stock.symbol);

            return (
              <div key={`${stock.symbol}-${i}`}
                onClick={() => setAnalysisSymbol(stock.symbol)}
                className={`flex items-center px-4 py-[14px] cursor-pointer hover:bg-[#F9FAFB] active:bg-[#F2F4F6] transition-colors ${
                  i < list.length - 1 ? 'border-b border-[#F2F4F6]' : ''
                }`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-none mr-3"
                  style={{ backgroundColor: avatarColor + '18' }}>
                  <span className="text-[13px] font-bold" style={{ color: avatarColor }}>
                    {stock.symbol.charAt(0)}
                  </span>
                </div>

                {/* Name — Korean first, hide duplicate if no Korean name */}
                <div className="flex-1 min-w-0 mr-3">
                  <div className="text-[14px] font-semibold text-[#191F28] truncate">
                    {kr && kr !== stock.symbol ? kr : stock.symbol}
                  </div>
                  {kr && kr !== stock.symbol && (
                    <div className="text-[11px] text-[#B0B8C1]">{stock.symbol}</div>
                  )}
                </div>

                {/* Price + Change */}
                <div className="text-right mr-2 flex-none">
                  <div className="text-[14px] font-bold text-[#191F28] tabular-nums">
                    ${price ? price.toFixed(2) : '--'}
                  </div>
                  <div className={`text-[11px] font-semibold tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                    {isGain ? '+' : ''}{cp.toFixed(2)}%
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0 flex-none">
                  <button onClick={(e) => handleEdit(e, i)}
                    className="p-1.5 rounded-lg hover:bg-[#F2F4F6] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.5">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button onClick={(e) => handleDelete(e, i)}
                    className="p-1.5 rounded-lg hover:bg-[#FEE2E2] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0B8C1" strokeWidth="1.5">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}