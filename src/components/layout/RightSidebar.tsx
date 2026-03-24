'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, StockItem } from '@/config/constants';
import { Plus } from 'lucide-react';

function generateInsight(
  investingStocks: StockItem[],
  watchingStocks: StockItem[],
  macroData: Record<string, unknown>
): { text: string; type: 'insight' | 'risk' }[] {
  const allStocks = [...investingStocks, ...watchingStocks];
  const insights: { text: string; type: 'insight' | 'risk' }[] = [];

  let biggestLoss = { symbol: '', dp: 0, price: 0, avgCost: 0 };
  let biggestGain = { symbol: '', dp: 0 };

  for (const s of allStocks) {
    const q = macroData[s.symbol] as QuoteData | undefined;
    if (!q?.dp) continue;
    if (q.dp > biggestGain.dp) biggestGain = { symbol: s.symbol, dp: q.dp };
    if (q.dp < biggestLoss.dp) biggestLoss = { symbol: s.symbol, dp: q.dp, price: q.c, avgCost: s.avgCost };
  }

  // Risk alerts for stocks below avg cost
  for (const s of investingStocks) {
    const q = macroData[s.symbol] as QuoteData | undefined;
    if (!q?.c || !s.avgCost || s.avgCost <= 0) continue;
    if (q.c < s.avgCost) {
      const kr = STOCK_KR[s.symbol] || s.symbol;
      insights.push({
        text: `${kr} 평단가($${s.avgCost})보다 현재가($${q.c.toFixed(2)})가 낮아요. 추가 매수 또는 손절 기준을 점검하세요.`,
        type: 'risk',
      });
    }
  }

  // Big drop insight
  if (biggestLoss.dp < -5) {
    const kr = STOCK_KR[biggestLoss.symbol] || biggestLoss.symbol;
    insights.unshift({
      text: `${kr}이(가) ${biggestLoss.dp.toFixed(2)}% 급락했어요. 손절 라인에 가까워지고 있는지 확인하세요.`,
      type: 'insight',
    });
  } else if (biggestGain.dp > 3) {
    const kr = STOCK_KR[biggestGain.symbol] || biggestGain.symbol;
    insights.unshift({
      text: `${kr}이(가) +${biggestGain.dp.toFixed(1)}% 상승 중이에요. 목표가를 확인해보세요.`,
      type: 'insight',
    });
  }

  if (insights.length === 0) {
    insights.push({
      text: '현재 포트폴리오에 특별한 알림이 없어요. 안정적인 상태예요.',
      type: 'insight',
    });
  }

  return insights.slice(0, 2);
}

export default function RightSidebar() {
  const { stocks, macroData, setAnalysisSymbol } = usePortfolioStore();

  const watchingStocks = stocks.watching || [];
  const investingStocks = stocks.investing || [];
  const insights = generateInsight(investingStocks, watchingStocks, macroData);

  return (
    <div>
      {/* 관심 종목 header */}
      <div className="flex items-center gap-1.5">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#191F28' }}>관심 종목</h3>
        <span className="text-[13px] text-[#B0B8C1] font-normal">{watchingStocks.length}</span>
      </div>

      {/* Watching stock list */}
      <div className="mt-6">
        {watchingStocks.map((stock, idx) => {
          const q = macroData[stock.symbol] as QuoteData | undefined;
          const price = q?.c || 0;
          const dp = q?.dp || 0;
          const isGain = dp >= 0;
          const kr = STOCK_KR[stock.symbol] || stock.symbol;
          const avatarColor = getAvatarColor(stock.symbol);

          return (
            <button
              key={stock.symbol}
              onClick={() => setAnalysisSymbol(stock.symbol)}
              className={`w-full flex items-center gap-2.5 py-2.5 cursor-pointer hover:bg-[#F9FAFB] transition-colors text-left rounded-lg ${
                idx > 0 ? 'border-t border-[#F7F8FA]' : ''
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                <span className="text-[13px] font-bold text-white">
                  {stock.symbol.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#191F28] truncate">{kr}</div>
                <div className="text-[11px] text-[#B0B8C1]">
                  {stock.symbol}
                  {stock.buyBelow ? ` · 목표 $${stock.buyBelow}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold text-[#191F28] tabular-nums">
                  {price ? `$${price.toFixed(2)}` : '--'}
                </div>
                <div className={`text-[11px] font-medium tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {price ? `${isGain ? '▲' : '▼'} ${isGain ? '+' : ''}${dp.toFixed(2)}%` : '--'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add button */}
      <button
        onClick={() => {
          const searchBtn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
          if (searchBtn) searchBtn.click();
        }}
        className="w-full flex items-center justify-center gap-1.5 mt-4 py-2.5 border-[1.5px] border-dashed border-[#D5DAE0] rounded-[10px] text-[13px] text-[#8B95A1] cursor-pointer hover:bg-[#F9FAFB] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        관심 종목 추가
      </button>

      {/* SOLB AI section */}
      <div className="mt-10">
        <h3 className="text-[16px] font-bold text-[#191F28]">SOLB AI</h3>

        {insights.map((ins, idx) => (
          <div
            key={idx}
            style={{
              marginTop: '20px',
              padding: '20px',
              borderRadius: '16px',
              background: ins.type === 'insight'
                ? 'linear-gradient(135deg, rgba(49,130,246,0.04), rgba(175,82,222,0.04))'
                : 'rgba(255,149,0,0.04)',
              border: ins.type === 'insight'
                ? '1px solid rgba(49,130,246,0.08)'
                : '1px solid rgba(255,149,0,0.08)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '14px' }}>{ins.type === 'insight' ? '✨' : '⚠️'}</span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: ins.type === 'insight' ? '#3182F6' : '#FF9500',
                }}
              >
                {ins.type === 'insight' ? 'AI 포트폴리오 인사이트' : '리스크 알림'}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#4E5968', lineHeight: 1.6 }}>
              {ins.text}
            </div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                marginTop: '10px',
                cursor: 'pointer',
                color: ins.type === 'insight' ? '#3182F6' : '#FF9500',
              }}
            >
              {ins.type === 'insight' ? '자세히 보기 ›' : '점검하기 ›'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
