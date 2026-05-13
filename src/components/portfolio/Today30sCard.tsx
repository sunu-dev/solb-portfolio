'use client';

/**
 * "오늘의 30초" — 사용자가 매일 켜는 이유
 *
 * docs/BUSINESS_REVIEW.md (충돌 4 합의) 대응:
 * 모닝브리프 1줄 + 챕터 진척 + AI 촉 한 줄을 한 카드에 통합해
 * 2분 안에 모든 핵심을 전달.
 *
 * MVP — 정적 정보 + 시간 인사 + CTA 1개. 데이터 연결은 후속.
 */

import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { useMemo } from 'react';

interface Quote { c?: number; d?: number; dp?: number }

function greetByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤 인사드려요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '오후 안부 드려요';
  return '저녁 인사드려요';
}

function chapterProgress(): { dayN: number; total: number } {
  const now = new Date();
  const dayN = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { dayN, total: lastDay };
}

export default function Today30sCard() {
  const { stocks, macroData } = usePortfolioStore();

  const summary = useMemo(() => {
    const investing = stocks.investing || [];
    if (investing.length === 0) return null;

    let totalPnL = 0;
    let upCount = 0;
    let downCount = 0;
    for (const s of investing) {
      const q = macroData[s.symbol] as Quote | MacroEntry | undefined;
      const cp = (q as Quote)?.dp;
      if (typeof cp === 'number') {
        if (cp > 0) upCount++;
        else if (cp < 0) downCount++;
        totalPnL += cp * (s.avgCost && s.shares ? 1 : 0);  // 정확 손익은 별도, 여기는 단순 카운트
      }
    }
    return { investing: investing.length, upCount, downCount, totalPnL };
  }, [stocks, macroData]);

  const greet = greetByHour();
  const chap = chapterProgress();
  const month = new Date().getMonth() + 1;

  return (
    <div style={{
      marginBottom: 16,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(49,130,246,0.06), rgba(22,163,74,0.04))',
      border: '1px solid rgba(49,130,246,0.12)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#3182F6', letterSpacing: 0.5 }}>
          ⏱ 오늘의 30초
        </div>
        <div style={{ fontSize: 10, color: '#8B95A1' }}>
          {month}월 챕터 {chap.dayN}/{chap.total}일째
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', lineHeight: 1.4 }}>
        {greet}
      </div>

      {summary ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
          보유 <strong>{summary.investing}종목</strong>
          {' · '}
          오늘 <span style={{ color: '#EF4452', fontWeight: 600 }}>↑{summary.upCount}</span>
          {' '}<span style={{ color: '#3182F6', fontWeight: 600 }}>↓{summary.downCount}</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>
          아직 보유 종목이 없어요. 종목을 추가하면 매일 한 줄로 상태를 보여드려요.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => {
            const el = document.querySelector('[data-tour="ai-chok"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 700,
            color: '#fff', background: '#3182F6', border: 'none', borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          🎯 AI 촉 보기
        </button>
        <button
          onClick={() => {
            const el = document.querySelector('[data-tour="portfolio-section"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#3182F6', background: 'rgba(49,130,246,0.08)', border: 'none', borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          📊 내 종목
        </button>
      </div>
    </div>
  );
}
