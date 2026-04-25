'use client';

import { useEffect, useState } from 'react';
import { loadChapters, type ArchivedChapter } from '@/utils/chapterArchive';
import { STOCK_KR } from '@/config/constants';

/**
 * Chapter Shelf — 지난 챕터들을 책장처럼 시각화.
 *
 * 각 책의 색은 그 챕터 수익률 기반:
 *   진한 빨강 (큰 수익) → 차콜 (보합) → 진한 파랑 (큰 손실)
 * 책 두께는 메모 작성량 비례.
 * 책 클릭 시 해당 챕터 회고 모달 열기 (Phase 3 Wrapped 재사용 가능, 별도 history mode).
 */
interface Props {
  /** 책 클릭 시 해당 챕터 회고 보기 */
  onSelect?: (chapterId: string) => void;
}

function colorForReturn(pct: number): string {
  // pnlColor와 같은 계열, 책 색감
  if (pct >= 7)    return '#a01818';
  if (pct >= 5)   return '#b62828';
  if (pct >= 3)   return '#c83a3a';
  if (pct >= 1.5) return '#a45050';
  if (pct >= 0.3) return '#7d4044';
  if (pct > -0.3) return '#5A6470';
  if (pct > -1.5) return '#3e5572';
  if (pct > -3)   return '#3071C7';
  if (pct > -5)   return '#1B64DA';
  if (pct > -7)   return '#1454C4';
  return '#0D47A1';
}

function thicknessForNotes(notes: number): number {
  // 메모 0개 24px, 30개+ 64px
  return Math.min(64, 24 + Math.min(notes, 30) * 1.3);
}

export default function ChapterShelf({ onSelect }: Props) {
  const [chapters, setChapters] = useState<ArchivedChapter[]>([]);

  useEffect(() => {
    setChapters(loadChapters());
  }, []);

  if (chapters.length === 0) {
    return (
      <div style={{
        marginTop: 16, padding: '20px 16px',
        borderRadius: 12, background: 'var(--bg-subtle, #F8F9FA)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
          아직 책장이 비어있어요
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', lineHeight: 1.5 }}>
          매월 1일에 지난 달 챕터가 자동으로 책장에 꽂혀요.<br/>
          첫 챕터가 마감되면 여기에 책이 생깁니다.
        </div>
      </div>
    );
  }

  // 시간순 정렬 (최신이 오른쪽)
  const sorted = [...chapters].sort((a, b) => a.chapterId.localeCompare(b.chapterId));

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            CHAPTER SHELF
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #191F28)' }}>
            챕터 책장 · {chapters.length}권
          </span>
        </div>
      </div>

      {/* 책장 — 가로 스크롤 */}
      <div style={{
        display: 'flex', gap: 6, alignItems: 'flex-end',
        padding: '20px 12px 12px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, #2D3340 0%, #1F2331 100%)',
        boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.2)',
        overflowX: 'auto',
        minHeight: 140,
      }} className="scrollbar-hide">
        {sorted.map(ch => {
          const bookHeight = thicknessForNotes(ch.notesCount);
          const color = colorForReturn(ch.totalPctReturn);
          const championKr = ch.championSymbol ? STOCK_KR[ch.championSymbol] || ch.championSymbol : null;
          return (
            <button
              key={ch.chapterId}
              onClick={() => onSelect?.(ch.chapterId)}
              title={`${ch.monthLabel} ${ch.totalPctReturn >= 0 ? '+' : ''}${ch.totalPctReturn.toFixed(2)}%${championKr ? ` · 챔피언 ${championKr}` : ''}`}
              style={{
                flexShrink: 0,
                width: 36, height: bookHeight + 30,
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: onSelect ? 'pointer' : 'default',
                padding: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
              }}
            >
              {/* 책 본체 */}
              <div style={{
                width: 36, height: bookHeight,
                background: `linear-gradient(180deg, ${color}E0 0%, ${color} 100%)`,
                borderRadius: '3px 3px 0 0',
                position: 'relative',
                boxShadow: '1px 0 2px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {/* 책등 미세 디테일 */}
                <div style={{
                  position: 'absolute', top: 6, left: 6, right: 6, height: 1,
                  background: 'rgba(255,255,255,0.15)',
                }} />
                <div style={{
                  position: 'absolute', bottom: 6, left: 6, right: 6, height: 1,
                  background: 'rgba(255,255,255,0.15)',
                }} />
                {/* 세로 라벨 — 월명 */}
                <div style={{
                  writingMode: 'vertical-rl',
                  fontSize: 9, fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: 0.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}>
                  {ch.monthLabel.replace('월', '')}월
                </div>
              </div>
              {/* 책 아래 라벨 */}
              <div style={{
                fontSize: 8, fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                marginTop: 4,
                fontFamily: "'SF Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}>
                {ch.totalPctReturn >= 0 ? '+' : ''}{ch.totalPctReturn.toFixed(0)}%
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6, textAlign: 'center' }}>
        책 두께 = 메모 활동 · 색 = 챕터 수익률
      </div>
    </div>
  );
}
