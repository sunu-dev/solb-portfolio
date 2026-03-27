'use client';

import { useRef, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData } from '@/config/constants';

export default function ShareCard() {
  const { stocks, macroData } = usePortfolioStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const investingStocks = stocks.investing || [];

  // 계산
  let totalValue = 0, totalCost = 0, winCount = 0;
  investingStocks.forEach(s => {
    const q = macroData[s.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    if (s.avgCost > 0 && s.shares > 0 && price > 0) {
      totalValue += price * s.shares;
      totalCost += s.avgCost * s.shares;
      if (price > s.avgCost) winCount++;
    }
  });

  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const isGain = totalPL >= 0;
  const holdingCount = investingStocks.filter(s => s.avgCost > 0 && s.shares > 0).length;
  const winRate = holdingCount > 0 ? Math.round((winCount / holdingCount) * 100) : 0;

  const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  if (holdingCount === 0) return null;

  const handleShare = async () => {
    const text = `SOLB PORTFOLIO\n${dateStr}\n수익률 ${isGain ? '+' : ''}${totalPLPct.toFixed(1)}% | 승률 ${winRate}% | ${holdingCount}종목\n\nhttps://solb-portfolio.vercel.app`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SOLB PORTFOLIO', text });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 12,
          background: '#191F28',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          marginTop: 8,
        }}
      >
        📤 내 수익률 공유하기
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* 카드 미리보기 */}
      <div
        ref={cardRef}
        style={{
          background: 'linear-gradient(135deg, #1A1D2E 0%, #2D3250 100%)',
          borderRadius: 20,
          padding: '28px 24px',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 장식 원 */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(49,130,246,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,82,0.1)' }} />

        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#3182F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>S</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>SOLB PORTFOLIO</span>
        </div>

        {/* 수익률 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>총 수익률</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: isGain ? '#EF4452' : '#3182F6', lineHeight: 1.1 }}>
            {isGain ? '+' : ''}{totalPLPct.toFixed(1)}%
          </div>
        </div>

        {/* 지표들 */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>승률</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{winRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>종목 수</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{holdingCount}개</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>수익 종목</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{winCount}개</div>
          </div>
        </div>

        {/* 날짜 */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{dateStr}</div>
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setIsOpen(false)}
          style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#8B95A1', background: '#F2F4F6', border: 'none', cursor: 'pointer' }}
        >
          닫기
        </button>
        <button
          onClick={handleShare}
          style={{ flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}
        >
          {copied ? '✅ 복사됨!' : '📤 공유하기'}
        </button>
      </div>
    </div>
  );
}
