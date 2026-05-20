'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { StockItem } from '@/config/constants';
import { logApiCall } from '@/lib/apiLogger';
import OcrImportModal from '@/components/portfolio/OcrImportModal';

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

const SAMPLE_PORTFOLIO = [
  { symbol: '005930.KS', avgCost: 71000, shares: 10, fallback: { c: 75000,  d: 200,  dp: 0.27 } },
  { symbol: 'AAPL',      avgCost: 178,   shares: 5,  fallback: { c: 195,    d: 1.5,  dp: 0.78 } },
  { symbol: 'SPY',       avgCost: 480,   shares: 3,  fallback: { c: 540,    d: 2.8,  dp: 0.52 } },
];

// 정적 AI 촉 미리보기 (실 API 호출 X — free 한도 보존)
const CHOK_PREVIEW = [
  { symbol: 'NVDA', krName: '엔비디아',  sector: '반도체',   reason: 'AI 학습 수요 지속, 데이터센터 매출 +112%',     keyMetric: 'PER 38 · 52주 82% 위치' },
  { symbol: 'JNJ',  krName: '존슨앤존슨', sector: '헬스케어', reason: '경기 방어주 + 배당주, 시장 변동성 헤지 후보',  keyMetric: 'PER 22 · 배당수익률 3.1%' },
  { symbol: 'XOM',  krName: '엑손모빌',   sector: '에너지',   reason: '유가 강세 수혜 + 자사주 매입 강화',              keyMetric: 'PER 12 · 52주 65% 위치' },
];

const VALUE_CARDS = [
  {
    emoji: '📊',
    title: '매일 내 종목 한 줄 요약',
    desc: '오늘 가장 큰 움직임, 52주 위치, 멘토 평가까지 한 화면에.',
    color: 'var(--brand-primary)',
  },
  {
    emoji: '🎯',
    title: 'AI 촉 — 매일 새 종목 추천',
    desc: '시장 상황과 내 포트폴리오 약점을 분석해 매일 3종목 추천.',
    color: '#16A34A',
  },
  {
    emoji: '🧑‍🏫',
    title: '멘토 6명의 분석',
    desc: '버핏·린치·달리오 등 6명의 관점으로 종목별 분석 보고서.',
    color: '#FF9500',
  },
];

export default function OnboardingFlow({ userName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showOcr, setShowOcr] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const { addStock } = usePortfolioStore();

  const TOTAL_STEPS = 4;

  // Funnel 추적
  useEffect(() => {
    logApiCall('onboarding_step_view', String(step));
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      logApiCall('onboarding_complete');
      // 본 화면 진입 시 자동 투어 시작 마커
      try { localStorage.setItem('solb_tour_pending', '1'); } catch { /* ignore */ }
      onComplete();
    }
  }, [step, onComplete]);

  const handleSkip = useCallback(() => {
    logApiCall('onboarding_skip', String(step));
    try { localStorage.setItem('solb_tour_pending', '1'); } catch { /* ignore */ }
    onComplete();
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
        overflowY: 'auto',
      }}
    >
      {/* Skip 버튼 (우상단) */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute', top: 20, right: 20,
          fontSize: 13, color: '#8B95A1', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 10px',
        }}
      >
        건너뛰기
      </button>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '36px' }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            style={{
              width: step === i ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: step === i ? 'var(--brand-primary)' : 'var(--border-strong, #E5E8EB)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>

        {/* ── Step 0 — 가치 약속 ─────────────────────────── */}
        {step === 0 && (
          <>
            <div style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-0.04em', margin: '0 auto 12px', lineHeight: 1 }}>
              <span style={{ background: 'linear-gradient(135deg, #1B6B3A, var(--brand-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>주</span><span style={{ color: 'var(--text-primary, #191F28)' }}>비</span>
            </div>
            <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 28 }}>
              {userName}님의 <strong style={{ color: '#191F28' }}>주</strong>식 <strong style={{ color: '#191F28' }}>비</strong>서
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 24, lineHeight: 1.4 }}>
              주비가 매일 해드리는 3가지
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {VALUE_CARDS.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    background: 'var(--bg-subtle, #F8F9FA)', textAlign: 'left',
                    borderLeft: `3px solid ${v.color}`,
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{v.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 2 }}>
                      {v.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.55 }}>
                      {v.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Step 1 — 종목 추가 ─────────────────────────── */}
        {step === 1 && (
          <>
            {showOcr && <OcrImportModal onClose={() => setShowOcr(false)} />}
            <div style={{ fontSize: '40px', marginBottom: 16 }}>&#x1F4CA;</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8, lineHeight: 1.4 }}>
              관심 있는 종목을 추가해주세요
            </h1>
            <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 24 }}>
              샘플로 둘러봐도 좋고, 본인 종목을 가져와도 좋아요
            </p>

            {/* 샘플 종목 — '관심' 목록에 sandbox로 추가 (보유 아님)
                9인 패널 BLOCKER #7 — 페르소나 함정: "체험인 줄 알았다가 본 화면에 안 산 종목 있음" 해결
            */}
            <button
              onClick={() => {
                if (sampleLoaded) { onComplete(); return; }
                // 시세 캐시 즉시 주입 — 본 화면 진입 시 빈 화면 없이 즉시 가격 표시
                try {
                  const cacheData: Record<string, { c: number; d: number; dp: number }> = {};
                  SAMPLE_PORTFOLIO.forEach(s => { cacheData[s.symbol] = s.fallback; });
                  localStorage.setItem('solb_quote_cache', JSON.stringify({ data: cacheData, ts: Date.now() }));
                } catch { /* storage full */ }
                // 'watching' 카테고리에 추가 — 실제 보유가 아닌 관심 종목으로 명확히 분리.
                // avgCost·shares는 시뮬레이션 데이터로 유지 (둘러보기용).
                SAMPLE_PORTFOLIO.forEach(s => {
                  const ns: StockItem = { symbol: s.symbol, avgCost: s.avgCost, shares: s.shares, targetReturn: 0, buyBelow: 0 };
                  addStock('watching', ns);
                });
                setSampleLoaded(true);
                logApiCall('onboarding_sample_portfolio');
                setStep(2); // 샘플 추가 후에도 미리보기 step 보여줌
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', maxWidth: 320, margin: '0 auto 10px',
                padding: '14px 20px',
                borderRadius: 14, background: '#059669', color: '#fff',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18 }}>🐘</span>
              샘플 종목 둘러보기 (관심 목록)
            </button>
            <p style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', marginTop: 2, marginBottom: 12 }}>
              실제 보유 X · 관심 목록에 추가됩니다. 언제든 삭제 가능.
            </p>

            {/* OCR 가져오기 */}
            <button
              onClick={() => setShowOcr(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', maxWidth: 320, margin: '0 auto 18px',
                padding: '14px 20px',
                borderRadius: 14, background: 'var(--text-primary, #191F28)', color: '#fff',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18 }}>📸</span>
              증권앱 스크린샷으로 한번에 가져오기
            </button>

            <p style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', marginBottom: 14 }}>
              또는 인기 종목 추가
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: 12 }}>
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
                      display: 'inline-block', padding: '10px 18px', borderRadius: 20,
                      background: isAdded ? 'var(--brand-primary)' : 'var(--bg-subtle, #F2F4F6)',
                      fontSize: 13, fontWeight: 600,
                      color: isAdded ? '#fff' : 'var(--text-primary, #333D4B)',
                      border: 'none', cursor: isAdded ? 'default' : 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {isAdded ? `✓ ${s.label}` : s.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Step 2 — AI 촉 미리보기 ──────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ fontSize: '40px', marginBottom: 12 }}>🎯</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8, lineHeight: 1.4 }}>
              내일 아침, 주비가 보여드릴 것
            </h1>
            <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 22 }}>
              매일 시장 상황을 분석해 새 종목 3개를 추천해드려요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {CHOK_PREVIEW.map(p => (
                <div
                  key={p.symbol}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #F2F4F6)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{p.symbol}</code>
                    <span style={{ fontSize: 11, color: '#8B95A1' }}>{p.krName}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#F2F4F6', color: '#4E5968', marginLeft: 'auto' }}>{p.sector}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>{p.reason}</div>
                  <div style={{ fontSize: 11, color: 'var(--brand-primary)', background: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: 4, alignSelf: 'flex-start' }}>{p.keyMetric}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,149,0,0.08)', fontSize: 11, color: '#FF9500', lineHeight: 1.55, marginBottom: 8 }}>
              ⚠️ 위는 예시예요. 실제 추천은 본 화면 진입 후 1번 받을 수 있어요 (무료 한도)
            </div>
          </>
        )}

        {/* ── Step 3 — 시작 ──────────────────────────────── */}
        {step === 3 && (
          <>
            <img src="/mentors/safe.svg" alt="" style={{ width: 88, height: 88, margin: '0 auto 14px', display: 'block' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 10, lineHeight: 1.4 }}>
              준비 완료!
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6, marginBottom: 18 }}>
              본 화면에서 빠른 투어로<br />
              주요 기능 위치를 안내해드릴게요
            </p>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-subtle, #F8F9FA)', fontSize: 12, color: '#4E5968', lineHeight: 1.6, borderLeft: '3px solid #1B6B3A', marginBottom: 30, textAlign: 'left' }}>
              <strong style={{ color: '#1B6B3A' }}>주</strong>비 = <strong>주</strong>식 <strong>비</strong>서 ·
              화투의 <strong style={{ color: '#1B6B3A' }}>솔</strong>(松)은 사계절 흔들리지 않는 소나무.<br />
              <span style={{ fontSize: 11, color: '#8B95A1' }}>내 주식, 매일 한 줄로 읽어드릴게요.</span>
            </div>
          </>
        )}

        {/* Button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%', height: 52, borderRadius: 12,
            background: 'var(--brand-primary)', color: '#fff',
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
          }}
        >
          {step < TOTAL_STEPS - 1 ? '다음' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
