'use client';

import { useEffect, useState } from 'react';
import { computeChapterTime } from '@/utils/monthlyChapter';

/**
 * Chapter Keyword Prompt — 매월 1~3일 첫 진입 시 한 번 노출.
 *
 * 사용자에게 "이번 달의 키워드는?" 한 줄 입력 요청.
 * 입력값은 localStorage solb_chapter_keyword_{YYYY-MM}에 저장.
 * 회고 모달(Wrapped)과 책장(ChapterShelf)에서 표시.
 *
 * 한 번 입력하거나 "건너뛰기"하면 그 달은 다시 안 뜸.
 */
const SEEN_KEY = 'solb_chapter_keyword_prompted';

export default function ChapterKeywordPrompt() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [chapterId, setChapterId] = useState('');

  useEffect(() => {
    try {
      const time = computeChapterTime();
      // 1~3일이 아니거나 이미 키워드 있거나 이미 prompted한 챕터면 skip
      if (time.dayOfMonth > 3) return;
      const existing = localStorage.getItem(`solb_chapter_keyword_${time.chapterId}`);
      if (existing) return;
      const seenList = (localStorage.getItem(SEEN_KEY) || '').split(',');
      if (seenList.includes(time.chapterId)) return;
      setChapterId(time.chapterId);
      // 진입 후 약간 딜레이 — 다른 모달과 충돌 방지
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    } catch { /* ignore */ }
  }, []);

  const handleSave = () => {
    if (!chapterId) return;
    try {
      const trimmed = keyword.trim();
      if (trimmed) {
        localStorage.setItem(`solb_chapter_keyword_${chapterId}`, trimmed);
      }
      // prompted 표시 (저장 또는 스킵 모두)
      const seenList = (localStorage.getItem(SEEN_KEY) || '').split(',').filter(Boolean);
      if (!seenList.includes(chapterId)) {
        seenList.push(chapterId);
        localStorage.setItem(SEEN_KEY, seenList.join(','));
      }
    } catch { /* ignore */ }
    setOpen(false);
  };

  const handleSkip = () => {
    if (!chapterId) return;
    try {
      const seenList = (localStorage.getItem(SEEN_KEY) || '').split(',').filter(Boolean);
      if (!seenList.includes(chapterId)) {
        seenList.push(chapterId);
        localStorage.setItem(SEEN_KEY, seenList.join(','));
      }
    } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  // 이번 달 라벨
  const now = new Date();
  const monthLabel = now.toLocaleDateString('ko-KR', { month: 'long' });

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'keyword-fade 0.25s ease',
      }}
    >
      <style>{`
        @keyframes keyword-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes keyword-slide { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{
        background: 'var(--surface, #FFFFFF)',
        borderRadius: 20,
        padding: '28px 24px',
        width: '100%', maxWidth: 380,
        boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
        animation: 'keyword-slide 0.3s ease',
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-tertiary, #B0B8C1)',
            letterSpacing: 0.5,
          }}>
            NEW CHAPTER
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: 'var(--text-primary, #191F28)',
            marginTop: 4,
          }}>
            {monthLabel} 챕터 시작
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-secondary, #4E5968)',
            marginTop: 8, lineHeight: 1.5, wordBreak: 'keep-all',
          }}>
            이번 달의 한 줄 키워드를 적어보세요.<br/>
            월말 회고에서 다시 만나요.
          </div>
        </div>

        {/* 입력 */}
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value.slice(0, 24))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="예: 분할 매수의 달 / 손절 연습"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1.5px solid var(--border-light, #F2F4F6)',
            background: 'var(--bg-subtle, #F8F9FA)',
            fontSize: 14, fontWeight: 600,
            color: 'var(--text-primary, #191F28)',
            outline: 'none',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
          maxLength={24}
        />
        <div style={{
          fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)',
          textAlign: 'right', marginTop: 4,
        }}>
          {keyword.length}/24
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              color: 'var(--text-secondary, #8B95A1)',
              background: 'var(--bg-subtle, #F8F9FA)',
              border: 'none', cursor: 'pointer',
            }}
          >
            건너뛰기
          </button>
          <button
            onClick={handleSave}
            disabled={!keyword.trim()}
            style={{
              flex: 2,
              padding: '12px 0',
              borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              color: '#FFFFFF',
              background: keyword.trim()
                ? 'linear-gradient(135deg, #AF52DE 0%, #3182F6 100%)'
                : 'var(--text-tertiary, #B0B8C1)',
              border: 'none',
              cursor: keyword.trim() ? 'pointer' : 'default',
              transition: 'background 0.2s',
            }}
          >
            챕터 시작 →
          </button>
        </div>
      </div>
    </div>
  );
}
