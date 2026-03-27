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

  const handleNext = useCallback(() => {
    if (step < 2) {
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
        {[0, 1, 2].map((i) => (
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
              SOLB PORTFOLIO는 주식 초보자를 위한
              <br />
              투자 비서예요.
            </p>
          </>
        )}

        {step === 1 && (
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
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-tertiary, #B0B8C1)',
                marginBottom: '48px',
              }}
            >
              또는 검색으로 직접 추가
            </p>
          </>
        )}

        {step === 2 && (
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