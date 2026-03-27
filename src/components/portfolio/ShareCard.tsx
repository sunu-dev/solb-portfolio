'use client';

import { useRef, useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData } from '@/config/constants';

declare global {
  interface Window {
    Kakao: any;
  }
}

export default function ShareCard() {
  const { stocks, macroData } = usePortfolioStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

  // 카카오 SDK 초기화
  useEffect(() => {
    const initKakao = () => {
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (window.Kakao && key && !window.Kakao.isInitialized()) {
        window.Kakao.init(key);
        setKakaoReady(true);
      } else if (window.Kakao?.isInitialized()) {
        setKakaoReady(true);
      }
    };
    // SDK 로드 대기
    if (window.Kakao) { initKakao(); return; }
    const timer = setInterval(() => {
      if (window.Kakao) { initKakao(); clearInterval(timer); }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const investingStocks = stocks.investing || [];

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

  const appUrl = 'https://solb-portfolio.vercel.app';
  const ogImageUrl = `${appUrl}/api/og?return=${totalPLPct.toFixed(1)}&winRate=${winRate}&holdings=${holdingCount}`;
  const shareText = `SOLB PORTFOLIO\n${dateStr}\n수익률 ${isGain ? '+' : ''}${totalPLPct.toFixed(1)}% | 승률 ${winRate}% | ${holdingCount}종목`;

  // 카카오톡 공유
  const handleKakaoShare = () => {
    if (!window.Kakao?.Share) return;
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: 'SOLB PORTFOLIO',
        description: `수익률 ${isGain ? '+' : ''}${totalPLPct.toFixed(1)}% | 승률 ${winRate}% | ${holdingCount}종목`,
        imageUrl: ogImageUrl,
        link: { mobileWebUrl: appUrl, webUrl: appUrl },
      },
      buttons: [
        { title: '나도 시작하기', link: { mobileWebUrl: appUrl, webUrl: appUrl } },
      ],
    });
  };

  // 일반 공유 (Web Share API / 클립보드)
  const handleGeneralShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'SOLB PORTFOLIO', text: shareText, url: appUrl }); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareText + '\n\n' + appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12,
          background: 'var(--text-primary, #191F28)', color: '#FFFFFF',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', marginTop: 8,
        }}
      >
        내 수익률 공유하기
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
          borderRadius: 20, padding: '28px 24px', color: '#FFFFFF',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(49,130,246,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,82,0.1)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#3182F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>S</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>SOLB PORTFOLIO</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>총 수익률</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: isGain ? '#EF4452' : '#3182F6', lineHeight: 1.1 }}>
            {isGain ? '+' : ''}{totalPLPct.toFixed(1)}%
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>승률</div><div style={{ fontSize: 16, fontWeight: 700 }}>{winRate}%</div></div>
          <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>종목 수</div><div style={{ fontSize: 16, fontWeight: 700 }}>{holdingCount}개</div></div>
          <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>수익 종목</div><div style={{ fontSize: 16, fontWeight: 700 }}>{winCount}개</div></div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{dateStr}</div>
      </div>

      {/* 공유 버튼들 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setIsOpen(false)}
          style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', cursor: 'pointer' }}
        >
          닫기
        </button>
        {kakaoReady && (
          <button
            onClick={handleKakaoShare}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#191F28', background: '#FEE500', border: 'none', cursor: 'pointer' }}
          >
            카카오톡
          </button>
        )}
        <button
          onClick={handleGeneralShare}
          style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}
        >
          {copied ? '복사됨!' : '공유하기'}
        </button>
      </div>
    </div>
  );
}
