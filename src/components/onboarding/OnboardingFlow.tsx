'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { StockItem } from '@/config/constants';
import { logApiCall } from '@/lib/apiLogger';
import CsvImportModal from '@/components/portfolio/CsvImportModal';
import OcrImportModal from '@/components/portfolio/OcrImportModal';
import { OCR_DISABLED_COPY, OCR_UI_ENABLED } from '@/config/ocrFeature';

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

const VALUE_CARDS = [
  {
    badge: '오늘',
    title: '내 종목 변화를 모아봐요',
    desc: '자산·손익과 보유·관심 종목을 한곳에서 확인해요.',
    color: 'var(--brand-primary)',
    background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))',
  },
  {
    badge: '설명',
    title: '시장과 내 종목을 연결해요',
    desc: '오늘의 시장 흐름, 내 종목 소식과 챙길 알림을 정리해요.',
    color: '#16A34A',
    background: 'rgba(22,163,74,0.08)',
  },
  {
    badge: '안전',
    title: '기록은 확인하고 반영해요',
    desc: '가져온 변경을 먼저 비교하고, 이전 상태에는 복구 지점을 남겨요.',
    color: '#FF9500',
    background: 'rgba(255,149,0,0.08)',
  },
];

export default function OnboardingFlow({ userName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showCsv, setShowCsv] = useState(false);
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
              주비가 내 주식을 챙기는 3가지
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
                  <span style={{ minWidth: 38, height: 25, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: v.background, color: v.color, fontSize: 10, fontWeight: 850 }}>{v.badge}</span>
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

        {/* ── Step 1 — 내 종목 연결 ─────────────────────────── */}
        {step === 1 && (
          <>
            {showCsv && <CsvImportModal onClose={() => setShowCsv(false)} />}
            {OCR_UI_ENABLED && showOcr && <OcrImportModal onClose={() => setShowOcr(false)} />}
            <div style={{ width: 54, height: 54, margin: '0 auto 16px', display: 'grid', placeItems: 'center', borderRadius: 18, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)', fontSize: 13, fontWeight: 900 }}>CSV</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8, lineHeight: 1.4 }}>
              내 종목을 알려주세요
            </h1>
            <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 24 }}>
              CSV는 브라우저에서 먼저 비교하고, 샘플 관심 종목으로 둘러볼 수도 있어요
            </p>

            <button
              onClick={() => setShowCsv(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', maxWidth: 320, margin: '0 auto 10px',
                padding: '14px 20px',
                borderRadius: 14, background: 'var(--brand-primary, #0E7C7B)', color: '#fff',
                fontSize: 14, fontWeight: 750, border: 'none', cursor: 'pointer',
              }}
            >
              CSV로 내 종목 가져오기
            </button>

            {/* 샘플 종목 — '관심' 목록에 sandbox로 추가 (보유 아님) */}
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
                // demo:true — savePortfolioToDB에서 strip돼 서버 미동기화. 샘플이 실제 계좌로 오염되는 것 차단.
                SAMPLE_PORTFOLIO.forEach(s => {
                  const ns: StockItem = { symbol: s.symbol, avgCost: s.avgCost, shares: s.shares, targetReturn: 0, buyBelow: 0, demo: true };
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
                borderRadius: 14, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-primary, #191F28)',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              샘플 종목 둘러보기 (관심 목록)
            </button>
            <p style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', marginTop: 2, marginBottom: 12 }}>
              실제 보유 X · 둘러보기 샘플(이 기기에서만). 언제든 삭제 가능.
            </p>

            {/* OCR 가져오기 — 무료 Gemini 환경에서는 개인정보 보호를 위해 비활성 */}
            {OCR_UI_ENABLED ? (
              <button
                onClick={() => setShowOcr(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', maxWidth: 320, margin: '0 auto 18px',
                  padding: '14px 20px',
                  borderRadius: 14, background: 'var(--text-primary, #191F28)', color: 'var(--text-inverse, #fff)',
                  fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                }}
              >
                증권앱 스크린샷으로 한번에 가져오기
              </button>
            ) : (
              <div role="note" style={{ maxWidth: 320, margin: '0 auto 18px', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)', color: 'var(--text-secondary, #4E5968)', fontSize: 12, lineHeight: 1.6, textAlign: 'left' }}>
                <strong style={{ display: 'block', color: 'var(--text-primary, #191F28)', marginBottom: 3 }}>{OCR_DISABLED_COPY.title}</strong>
                {OCR_DISABLED_COPY.detail}
              </div>
            )}

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

        {/* ── Step 2 — 안전한 가져오기 미리보기 ──────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 14px', display: 'grid', placeItems: 'center', borderRadius: 18, background: 'var(--brand-primary-bg, rgba(14,124,123,0.08))', color: 'var(--brand-primary, #0E7C7B)', fontSize: 11, fontWeight: 900 }}>확인</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8, lineHeight: 1.4 }}>
              가져올 때는 먼저 확인해요
            </h1>
            <p style={{ fontSize: 13, color: '#8B95A1', marginBottom: 22 }}>
              아래는 실제 보유 기록에 영향을 주지 않는 예시예요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { id: 'same', name: '삼성전자', status: '그대로', detail: '기존 기록과 같아서 반영하지 않아요' },
                { id: 'changed', name: '엔비디아', status: '변경', detail: '수량 2주 → 3주 · 선택됨' },
                { id: 'new', name: '애플', status: '새 항목', detail: '새 기록 1주 · 선택됨' },
              ].map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', borderRadius: 12,
                    background: row.id === 'same' ? 'var(--surface, #fff)' : 'var(--brand-primary-bg, rgba(14,124,123,0.05))',
                    border: `1px solid ${row.id === 'same' ? 'var(--border-light, #F2F4F6)' : 'rgba(14,124,123,0.25)'}`,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 21, height: 21, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 6, background: row.id === 'same' ? 'var(--bg-subtle, #F2F4F6)' : 'var(--brand-primary, #0E7C7B)', color: 'white', fontSize: 12 }}>
                    {row.id === 'same' ? '' : '✓'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary, #191F28)' }}>{row.name}</strong>
                      <span style={{ fontSize: 10, color: row.id === 'same' ? '#8B95A1' : 'var(--brand-primary, #0E7C7B)', fontWeight: 800 }}>{row.status}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>{row.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(52,199,89,0.08)', fontSize: 11, color: 'var(--color-success, #228B45)', lineHeight: 1.6, marginBottom: 8 }}>
              승인 직전 상태를 자동 보관해요. 변경 후에도 기록 화면에서 안전하게 복구할 수 있어요.
            </div>
          </>
        )}

        {/* ── Step 3 — 시작 ──────────────────────────────── */}
        {step === 3 && (
          <>
            <Image src="/mentors/safe.svg" alt="" width={88} height={88} style={{ width: 88, height: 88, margin: '0 auto 14px', display: 'block' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 10, lineHeight: 1.4 }}>
              준비 완료!
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6, marginBottom: 18 }}>
              본 화면에서 빠른 투어로<br />
              주요 기능 위치를 안내해드릴게요
            </p>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-subtle, #F8F9FA)', fontSize: 12, color: '#4E5968', lineHeight: 1.6, borderLeft: '3px solid #1B6B3A', marginBottom: 30, textAlign: 'left' }}>
              <strong style={{ color: '#1B6B3A' }}>주</strong>비 = <strong>주</strong>식 <strong>비</strong>서.<br />
              <span style={{ fontSize: 11, color: '#8B95A1' }}>판단은 내가 하고, 주비는 오늘의 변화와 챙길 일을 정리해요.</span>
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
