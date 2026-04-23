'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { StockNote, QuoteData } from '@/config/constants';

type JournalEntry = StockNote & {
  symbol: string;
  category: 'investing' | 'watching' | 'sold';
  stockIdx: number;
  avgCost: number;
  currentPrice?: number;
};

/**
 * 모든 종목의 투자 메모를 시간순 통합 타임라인으로 보여주는 뷰.
 * 각 메모에 당시 매수가 대비 현재가 delta 표시 → "과거 결정의 복기"
 */
export default function InvestmentJournal() {
  const { stocks, macroData, setAnalysisSymbol } = usePortfolioStore();

  const entries = useMemo(() => {
    const all: JournalEntry[] = [];
    (['investing', 'watching', 'sold'] as const).forEach(cat => {
      (stocks[cat] || []).forEach((stock, idx) => {
        (stock.notes || []).forEach(note => {
          const q = macroData[stock.symbol] as QuoteData | undefined;
          all.push({
            ...note,
            symbol: stock.symbol,
            category: cat,
            stockIdx: idx,
            avgCost: stock.avgCost,
            currentPrice: q?.c,
          });
        });
      });
    });
    // 최신순 정렬 (date에 ISO + _id suffix)
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }, [stocks, macroData]);

  if (entries.length === 0) return null;

  return (
    <div style={{ marginBottom: 32, background: 'var(--surface, #FFFFFF)', borderRadius: 16, padding: '20px', border: '1px solid var(--border-light, #F2F4F6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          📝 나의 투자 일기
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', padding: '2px 8px', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 10 }}>
          {entries.length}개
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 14, lineHeight: 1.5 }}>
        그때의 판단을 지금 결과와 함께 복기해보세요
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.slice(0, 20).map(entry => {
          const dateRaw = entry.date.split('_')[0];
          const d = new Date(dateRaw);
          const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
          const daysSince = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
          const kr = STOCK_KR[entry.symbol] || entry.symbol;
          const avatarColor = getAvatarColor(entry.symbol);

          // 매수가 대비 현재가 delta (사용자가 언제 적었든 현재가 대비)
          let delta: number | null = null;
          if (entry.avgCost > 0 && entry.currentPrice != null) {
            delta = ((entry.currentPrice - entry.avgCost) / entry.avgCost) * 100;
          }

          return (
            <div
              key={`${entry.symbol}-${entry.date}`}
              onClick={() => setAnalysisSymbol(entry.symbol)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setAnalysisSymbol(entry.symbol); }}
              className="cursor-pointer"
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg-subtle, #F8F9FA)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #F2F4F6)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle, #F8F9FA)')}
            >
              {/* 아바타 */}
              <div
                style={{
                  flexShrink: 0,
                  width: 32, height: 32, borderRadius: '50%',
                  background: avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}
              >
                {entry.symbol.charAt(0)}
              </div>

              {/* 본문 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 헤더: 종목 · 날짜 · 감정 · delta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{kr}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>{entry.symbol}</span>
                  <span style={{ fontSize: 14 }}>{entry.emoji}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                    · {dateStr} {daysSince > 0 ? `(${daysSince}일 전)` : '(오늘)'}
                  </span>

                  {/* delta 뱃지 */}
                  {delta !== null && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 10,
                      color: delta >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
                      background: delta >= 0 ? 'var(--color-gain-bg, rgba(239,68,82,0.08))' : 'var(--color-loss-bg, rgba(49,130,246,0.08))',
                    }}>
                      현재 {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* 메모 내용 */}
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary, #4E5968)',
                  lineHeight: 1.55, wordBreak: 'break-word',
                }}>
                  {entry.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > 20 && (
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)' }}>
          최근 20개만 표시 · 나머지는 각 종목 분석 화면에서 확인하세요
        </div>
      )}
    </div>
  );
}
