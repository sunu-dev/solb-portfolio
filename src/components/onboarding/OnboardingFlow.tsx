'use client';

import { useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { StockItem } from '@/config/constants';
import { logApiCall } from '@/lib/apiLogger';

interface OnboardingFlowProps {
  userName: string;
  onComplete: () => void;
}

const POPULAR_STOCKS = [
  { symbol: '005930.KS', label: '삼성전자' },
  { symbol: 'NVDA', label: 'NVDA' },
  { symbol: 'AAPL', label: 'AAPL' },
  { symbol: 'MSFT', label: 'MSFT' },
  { symbol: 'TSLA', label: 'TSLA' },
];

export default function OnboardingFlow({ userName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const { addStock } = usePortfolioStore();

  const TOTAL_STEPS = 4;
  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  }, [step, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'var(--bg, #fff)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '48px' }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              width: step === i ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: step === i ? '#3182F6' : 'var(--border-strong, #E5E8EB)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        {step === 0 && (
          <>
            <img src="/logo-solb.svg" alt="솔비서" style={{ width: 64, height: 64, margin: '0 auto 20px' }} />
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary, #191F28)',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ background: 'linear-gradient(135deg, #1B6B3A, #3182F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>솔비서</span>에 오신 걸 환영해요
            </h1>
            <p
              style={{
                fontSize: '15px',
                color: 'var(--text-secondary, #8B95A1)',
                lineHeight: 1.7,
                marginBottom: '32px',
              }}
            >
              화투에서 <strong style={{ color: '#1B6B3A' }}>솔(松)</strong>은 소나무,{' '}
              <strong style={{ color: '#3182F6' }}>비(雨)</strong>는 폭풍우.<br />
              소나무는 사계절 흔들리지 않는 유일한 나무예요.
            </p>
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: 'var(--bg-subtle, #F8F9FA)',
                fontSize: '14px',
                color: 'var(--text-primary, #191F28)',
                fontWeight: 600,
                lineHeight: 1.6,
                marginBottom: '32px',
                borderLeft: '3px solid #1B6B3A',
              }}
            >
              폭풍우에도 흔들리지 않는<br />내 투자 비서, 솔비서.
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '24px' }}>&#x1F44B;</div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary, #191F28)',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              환영합니다, {userName}님!
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary, #8B95A1)',
                lineHeight: 1.6,
                marginBottom: '48px',
              }}
            >
              6가지 투자 관점으로 내 종목을
              <br />
              쉽게 읽어드릴게요.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '24px' }}>&#x1F4CA;</div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary, #191F28)',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              관심 있는 종목을 추가해보세요
            </h1>
            <p
              style={{
                fontSize: '15px',
                color: 'var(--text-secondary, #8B95A1)',
                lineHeight: 1.6,
                marginBottom: '28px',
              }}
            >
              인기 종목
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              {POPULAR_STOCKS.map((s) => {
                const isAdded = added.has(s.symbol);
                return (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      if (isAdded) return;
                      const ns: StockItem = { symbol: s.symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 };
                      addStock('watching', ns);
                      logApiCall('onboarding_stock_add', s.symbol);
                      setAdded(prev => new Set(prev).add(s.symbol));
                    }}
                    style={{
                      display: 'inline-block',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      background: isAdded ? '#3182F6' : 'var(--bg-subtle, #F2F4F6)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isAdded ? '#fff' : 'var(--text-primary, #333D4B)',
                      border: 'none',
                      cursor: isAdded ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isAdded ? `✓ ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                onComplete();
                // 온보딩 완료 후 검색창 열기
                setTimeout(() => window.dispatchEvent(new CustomEvent('open-search')), 300);
              }}
              style={{
                fontSize: '13px',
                color: '#3182F6',
                marginBottom: '48px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textUnderlineOffset: '3px',
                padding: '8px 0',
                minHeight: 36,
              }}
            >
              또는 검색으로 직접 추가
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '24px' }}>&#x1F389;</div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary, #191F28)',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              준비 완료!
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary, #8B95A1)',
                lineHeight: 1.6,
                marginBottom: '48px',
              }}
            >
              매일 내 종목의 상태를 확인하고
              <br />
              AI 분석을 받아보세요.
            </p>
          </>
        )}

        {/* Button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '12px',
            background: '#3182F6',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {step < 2 ? '다음' : '시작하기'}
        </button>
      </div>
    </div>
  );
}