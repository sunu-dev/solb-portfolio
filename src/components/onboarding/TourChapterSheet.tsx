'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import BottomSheet from '@/components/common/BottomSheet';
import { TOUR_CHAPTERS, getChapterSteps, type TourChapterId } from '@/lib/tourRegistry';
import { getDoneChapters } from '@/lib/tourProgress';

/**
 * 둘러보기 챕터 선택 시트 — 주제별 가이드 재진입(목표 A: 전 기능 학습).
 *
 * 'open-tour' 이벤트(메뉴 '둘러보기')로 열린다. 챕터 선택 시 시트를 닫고 'solb-tour-run' {chapter}를
 * dispatch → CoachMark가 해당 챕터를 실행. 완료한 챕터는 ✓(solb_tour_chapters_done).
 */

const CHAPTER_EMOJI: Record<TourChapterId, string> = {
  home: '🏠',
  insights: '🎯',
  news: '📰',
  events: '📅',
  customize: '🎛️',
};

export default function TourChapterSheet() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const handler = () => { setDone(getDoneChapters()); setOpen(true); };
    window.addEventListener('open-tour', handler);
    return () => window.removeEventListener('open-tour', handler);
  }, []);

  const pick = (chapter: TourChapterId) => {
    setOpen(false);
    // 시트 닫힘 애니메이션 후 투어 실행
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('solb-tour-run', { detail: { chapter } }));
    }, 280);
  };

  return (
    <BottomSheet isOpen={open} onClose={() => setOpen(false)} desktopVariant>
      <div style={{ padding: '4px 4px 8px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          🧭 둘러보기
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          주제를 골라 기능을 60초 안에 익혀보세요.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TOUR_CHAPTERS.map((ch) => {
            const count = getChapterSteps(ch.id).length;
            const isDone = done.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => pick(ch.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', textAlign: 'left',
                  padding: '14px 16px', borderRadius: 14,
                  background: 'var(--bg-subtle)', border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{CHAPTER_EMOJI[ch.id]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{ch.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                      background: ch.tier === 'core' ? 'var(--brand-primary-light)' : 'var(--bg)',
                      color: ch.tier === 'core' ? 'var(--brand-primary)' : 'var(--text-tertiary)',
                    }}>
                      {ch.tier === 'core' ? '기본' : '심화'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{count}단계</div>
                </div>
                {isDone && (
                  <span aria-label="완료" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                    background: 'var(--brand-primary)', color: 'var(--on-brand-fg)',
                  }}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
