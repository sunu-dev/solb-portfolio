'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData } from '@/config/constants';

export default function PortfolioHero() {
  const { stocks, macroData } = usePortfolioStore();

  // Calculate total portfolio value
  const allStocks = [...(stocks.short || []), ...(stocks.long || []), ...(stocks.watch || [])];
  let totalValue = 0;
  let totalCost = 0;
  let hasLivePrice = false;

  allStocks.forEach(stock => {
    const d = macroData[stock.symbol] as QuoteData | undefined;
    const price = d?.c || 0;
    if (price > 0) hasLivePrice = true;
    if (stock.avgCost && stock.shares && price > 0) {
      totalValue += price * stock.shares;
      totalCost += stock.avgCost * stock.shares;
    }
  });

  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const isGain = totalPL >= 0;
  const hasInvestment = totalCost > 0 && hasLivePrice;

  return (
    <div className="mt-5 mb-4">
      <div className="bg-white rounded-2xl px-6 py-6">
        <div className="text-[13px] text-[#8B95A1] font-medium mb-1">내 투자</div>

        {hasInvestment ? (
          <>
            <div className="text-[28px] font-bold text-[#191F28] tracking-tight leading-tight">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className={`text-[15px] font-semibold mt-1 ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
              {isGain ? '+' : ''}{totalPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
              ({isGain ? '+' : ''}{totalPLPercent.toFixed(1)}%)
            </div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-[#F2F4F6]">
              <div>
                <div className="text-[11px] text-[#B0B8C1]">투자금</div>
                <div className="text-[13px] font-semibold text-[#4E5968]">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#B0B8C1]">수익</div>
                <div className={`text-[13px] font-semibold ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                  {isGain ? '+' : ''}${Math.abs(totalPL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#B0B8C1]">종목 수</div>
                <div className="text-[13px] font-semibold text-[#4E5968]">{allStocks.length}개</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[28px] font-bold text-[#191F28] tracking-tight leading-tight">
              {!hasLivePrice && allStocks.length > 0
                ? '데이터 불러오는 중...'
                : allStocks.length > 0
                  ? `${allStocks.length}개 종목 모니터링 중`
                  : '종목을 추가해보세요'}
            </div>
            <div className="text-[13px] text-[#8B95A1] mt-1">
              {!hasLivePrice && allStocks.length > 0
                ? '잠시만 기다려주세요'
                : '종목 설정에서 매수 단가와 수량을 입력하면 수익률을 확인할 수 있어요'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
