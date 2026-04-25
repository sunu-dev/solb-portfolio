'use client';

import { useEffect, useState, useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatKRW } from '@/utils/formatKRW';
import { STOCK_KR } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';
import { computeChapterTime, buildChapterStats } from '@/utils/monthlyChapter';

/**
 * Monthly Wrapped — Spotify Wrapped 스타일 풀스크린 회고 모달.
 *
 * 7개 슬라이드 자동 진행:
 *   1. 표지 — "○월 챕터" 타이틀
 *   2. 누적 손익 — 빅 숫자 임팩트
 *   3. 베스트 종목 — 챔피언 강조
 *   4. 최고의 하루 — 그날 무슨 일?
 *   5. 메모 통계 — Streak + 작성 일수
 *   6. 시간 비교 — 30일 전 vs 지금
 *   7. 챕터 키워드 + 공유 CTA
 *
 * 닫으면 onClose. 자동 트리거: 말일 첫 진입 시 (Phase 6 cron 푸시 연동 가능).
 */
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MonthlyWrapped({ isOpen, onClose }: Props) {
  const { stocks, macroData, rawCandles, currency, dailySnapshots } = usePortfolioStore();
  const [slideIdx, setSlideIdx] = useState(0);

  const data = useMemo(() => {
    const time = computeChapterTime();
    const stats = buildChapterStats({
      stocks, macroData, rawCandles, snapshots: dailySnapshots,
    });
    return stats ? { time, stats } : null;
  }, [stocks, macroData, rawCandles, dailySnapshots]);

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setSlideIdx(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 모달 닫혀있거나 데이터 없으면 렌더 안 함
  if (!isOpen || !data) return null;
  const { time, stats } = data;

  const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;
  const isGain = stats.totalAbsReturn >= 0;
  const fmt = (usd: number) => currency === 'KRW'
    ? formatKRW(Math.round(Math.abs(usd) * usdKrw))
    : `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // 30일 전 비교
  const prev30Snap = dailySnapshots.find(s => {
    const ts = new Date(s.date).getTime();
    const target = Date.now() - 30 * 86400 * 1000;
    return Math.abs(ts - target) < 2 * 86400 * 1000;
  });
  const prev30Pct = prev30Snap && prev30Snap.totalCost > 0
    ? ((prev30Snap.totalValue - prev30Snap.totalCost) / prev30Snap.totalCost) * 100
    : null;

  // 챕터 키워드 (Phase 5 연동 — localStorage)
  let chapterKeyword: string | null = null;
  try {
    chapterKeyword = localStorage.getItem(`solb_chapter_keyword_${time.chapterId}`);
  } catch { /* ignore */ }

  // 공유 텍스트 빌드
  const shareText = `${time.monthLabel} 챕터 회고
누적 ${isGain ? '+' : ''}${stats.totalPctReturn.toFixed(2)}%
${stats.champion ? `🏆 챔피언: ${STOCK_KR[stats.champion.symbol] || stats.champion.symbol} ${stats.champion.pctReturn >= 0 ? '+' : ''}${stats.champion.pctReturn.toFixed(1)}%` : ''}
🔥 메모 streak ${stats.memoStreak}일`;

  // 슬라이드 정의
  const slides: Slide[] = [
    {
      id: 'cover',
      bgGradient: 'linear-gradient(135deg, #AF52DE 0%, #3182F6 100%)',
      content: (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>
            CHAPTER WRAPPED
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#FFFFFF', marginTop: 8, letterSpacing: '-0.02em' }}>
            {time.monthLabel}
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 12 }}>
            {time.dayOfMonth}일째의 회고
          </div>
        </>
      ),
    },
    {
      id: 'pnl',
      bgGradient: isGain
        ? 'linear-gradient(135deg, #EF4452 0%, #B71C1C 100%)'
        : 'linear-gradient(135deg, #3182F6 0%, #0D47A1 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            이번 챕터 누적
          </div>
          <div style={{
            fontSize: 60, fontWeight: 800, color: '#FFFFFF',
            marginTop: 8, letterSpacing: '-0.03em',
            fontFamily: "'SF Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {isGain ? '+' : '-'}{fmt(stats.totalAbsReturn)}
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
            marginTop: 6, fontFamily: "'SF Mono', monospace",
          }}>
            {isGain ? '+' : ''}{stats.totalPctReturn.toFixed(2)}%
          </div>
        </>
      ),
    },
    stats.champion ? {
      id: 'champion',
      bgGradient: 'linear-gradient(135deg, #FFA500 0%, #FF6B35 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            챕터 챔피언 🏆
          </div>
          <div style={{
            fontSize: 48, fontWeight: 800, color: '#FFFFFF',
            marginTop: 8, fontFamily: "'SF Mono', monospace",
          }}>
            {stats.champion.symbol}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
            {STOCK_KR[stats.champion.symbol] || stats.champion.symbol}
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: '#FFFFFF',
            marginTop: 16, fontFamily: "'SF Mono', monospace",
          }}>
            {stats.champion.pctReturn >= 0 ? '+' : ''}{stats.champion.pctReturn.toFixed(2)}%
          </div>
        </>
      ),
    } : null,
    stats.bestDay ? {
      id: 'bestDay',
      bgGradient: 'linear-gradient(135deg, #16A34A 0%, #064E3B 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            이번 챕터 최고의 하루
          </div>
          <div style={{
            fontSize: 32, fontWeight: 800, color: '#FFFFFF',
            marginTop: 12, fontFamily: "'SF Mono', monospace",
          }}>
            {new Date(stats.bestDay.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </div>
          <div style={{
            fontSize: 36, fontWeight: 800, color: '#FFFFFF',
            marginTop: 16, fontFamily: "'SF Mono', monospace",
          }}>
            +{stats.bestDay.pctChange.toFixed(2)}%
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
            +{fmt(stats.bestDay.absChange)}
          </div>
        </>
      ),
    } : null,
    {
      id: 'memo',
      bgGradient: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            메모 STREAK 🔥
          </div>
          <div style={{
            fontSize: 64, fontWeight: 800, color: '#FFFFFF',
            marginTop: 12, fontFamily: "'SF Mono', monospace",
          }}>
            {stats.memoStreak}일
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
            이번 챕터 작성한 메모 {stats.notesThisMonth}개
          </div>
        </>
      ),
    },
    prev30Pct !== null ? {
      id: 'compare',
      bgGradient: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            30일 전 vs 지금
          </div>
          <div style={{
            display: 'flex', gap: 24, alignItems: 'center', marginTop: 16,
            fontFamily: "'SF Mono', monospace",
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>30일 전</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                {prev30Pct >= 0 ? '+' : ''}{prev30Pct.toFixed(2)}%
              </div>
            </div>
            <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>지금</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF' }}>
                {isGain ? '+' : ''}{stats.totalPctReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </>
      ),
    } : null,
    {
      id: 'wrap',
      bgGradient: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
      content: (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.6 }}>
            {time.monthLabel} 챕터 마무리
          </div>
          {chapterKeyword && (
            <div style={{
              fontSize: 24, fontWeight: 800, color: '#FFFFFF',
              marginTop: 16, fontStyle: 'italic',
            }}>
              「{chapterKeyword}」
            </div>
          )}
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 24, lineHeight: 1.5 }}>
            한 달이 모여 한 챕터가 됩니다.<br/>
            챕터들이 모여 당신의 투자 인생이 됩니다.
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.share) {
                navigator.share({ text: shareText }).catch(() => {});
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText).catch(() => {});
              }
            }}
            style={{
              marginTop: 32, padding: '12px 28px',
              borderRadius: 24, fontSize: 13, fontWeight: 700,
              background: '#FFFFFF', color: '#111827',
              border: 'none', cursor: 'pointer',
            }}
          >
            카톡으로 공유 →
          </button>
        </>
      ),
    },
  ].filter(Boolean) as Slide[];

  const slide = slides[Math.min(slideIdx, slides.length - 1)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'wrapped-fade-in 0.25s ease',
      }}
    >
      <style>{`
        @keyframes wrapped-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wrapped-slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* 슬라이드 카드 */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          // 클릭으로 다음 슬라이드 진행
          if (slideIdx < slides.length - 1) setSlideIdx(slideIdx + 1);
        }}
        style={{
          position: 'relative',
          width: '100%', maxWidth: 420, aspectRatio: '9 / 16',
          maxHeight: '92vh',
          borderRadius: 20,
          background: slide.bgGradient,
          padding: '40px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          textAlign: 'center',
          cursor: slideIdx < slides.length - 1 ? 'pointer' : 'default',
          overflow: 'hidden',
          animation: 'wrapped-slide-in 0.3s ease',
        }}
        key={slideIdx}
      >
        {/* 진행 바 (Stories 스타일) */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          display: 'flex', gap: 4,
        }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i < slideIdx
                  ? 'rgba(255,255,255,0.85)'
                  : i === slideIdx
                  ? 'rgba(255,255,255,0.85)'
                  : 'rgba(255,255,255,0.25)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* 닫기 X */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="회고 닫기"
          style={{
            position: 'absolute', top: 22, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.2)',
            border: 'none', color: '#FFFFFF',
            fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* 슬라이드 내용 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          {slide.content}
        </div>

        {/* 슬라이드 진행 힌트 */}
        {slideIdx < slides.length - 1 && (
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.6)',
          }}>
            탭해서 다음 →
          </div>
        )}
      </div>
    </div>
  );
}

interface Slide {
  id: string;
  bgGradient: string;
  content: React.ReactNode;
}
