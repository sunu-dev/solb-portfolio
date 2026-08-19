'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { StockNote } from '@/config/constants';
import { createNoteDate } from '@/utils/noteId';

const EMOTION_TAGS = [
  { emoji: '🤔', label: '분석 후' },
  { emoji: '😤', label: '충동' },
  { emoji: '😱', label: '공포' },
  { emoji: '🎯', label: '목표 달성' },
  { emoji: '📰', label: '뉴스 보고' },
  { emoji: '💡', label: '인사이트' },
];

const REVIEW_PROMPTS = [
  '매수 이유: ',
  '매도 이유: ',
  '잘한 점: ',
  '아쉬운 점: ',
  '다음에는: ',
] as const;

interface Props {
  symbol: string;
  category: 'investing' | 'watching' | 'sold';
  stockIdx: number;
  notes: StockNote[];
}

export default function InvestmentNotes({ symbol, category, stockIdx, notes }: Props) {
  const updateStock = usePortfolioStore((state) => state.updateStock);
  const stocks = usePortfolioStore((state) => state.stocks);
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🤔');
  const recentPhrases = useMemo(() => {
    const seen = new Set<string>();
    return (Object.values(stocks).flatMap((items) =>
      items.flatMap((stock) => stock.notes || []))
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((note) => note.text.trim())
      .filter((phrase) => {
        if (!phrase || seen.has(phrase)) return false;
        seen.add(phrase);
        return true;
      })
      .slice(0, 3));
  }, [stocks]);

  const insertPrompt = (prompt: string) => {
    setText((current) => current.trim() ? `${current.trimEnd()}\n${prompt}` : prompt);
  };

  const handleAdd = () => {
    if (!text.trim()) return;
    const newNote: StockNote = {
      text: text.trim(),
      emoji: selectedEmoji,
      date: createNoteDate(),
    };
    const updated = [...(notes || []), newNote];
    updateStock(category, stockIdx, { notes: updated });
    setText('');
    setIsAdding(false);
  };

  const handleDelete = (noteDate: string) => {
    const updated = notes.filter(n => n.date !== noteDate);
    updateStock(category, stockIdx, { notes: updated });
  };

  const sortedNotes = [...(notes || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>투자 메모</span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            style={{ fontSize: 12, fontWeight: 600, color: '#3182F6', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            + 메모 추가
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ padding: 16, borderRadius: 16, background: 'var(--bg-subtle, #F8F9FA)', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {EMOTION_TAGS.map(tag => (
              <button
                key={tag.emoji}
                onClick={() => setSelectedEmoji(tag.emoji)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: selectedEmoji === tag.emoji ? 'rgba(49,130,246,0.1)' : 'var(--surface, #FFFFFF)',
                  border: selectedEmoji === tag.emoji ? '1px solid rgba(49,130,246,0.3)' : '1px solid var(--border-strong, #E5E8EB)',
                  color: selectedEmoji === tag.emoji ? '#3182F6' : 'var(--text-secondary, #8B95A1)',
                  cursor: 'pointer',
                  fontWeight: selectedEmoji === tag.emoji ? 600 : 400,
                }}
              >
                {tag.emoji} {tag.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 6, color: 'var(--text-tertiary, #8B95A1)', fontSize: 11, fontWeight: 600 }}>
              빠른 복기
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REVIEW_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => insertPrompt(prompt)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: 8,
                    border: '1px solid var(--border-light, #E5E8EB)',
                    background: 'var(--surface, #FFFFFF)',
                    color: 'var(--text-secondary, #4E5968)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {prompt.trim()}
                </button>
              ))}
            </div>
          </div>

          {recentPhrases.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ marginBottom: 6, color: 'var(--text-tertiary, #8B95A1)', fontSize: 11, fontWeight: 600 }}>
                최근 문구
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {recentPhrases.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setText(phrase)}
                    title={phrase}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      overflow: 'hidden',
                      borderRadius: 8,
                      border: 0,
                      background: 'var(--surface, #FFFFFF)',
                      color: 'var(--text-secondary, #4E5968)',
                      fontSize: 11,
                      textAlign: 'left',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label={`${symbol} 투자 메모`}
            placeholder="왜 이 종목을 매수/매도했나요? 나중에 복기할 수 있어요."
            style={{
              width: '100%',
              minHeight: 70,
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--surface, #FFFFFF)',
              color: 'var(--text-primary, #191F28)',
              fontSize: 16,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => { setIsAdding(false); setText(''); }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border-strong, #E5E8EB)', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              style={{ flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {sortedNotes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedNotes.map((note) => {
            const d = new Date(note.date.split('_')[0]); // ID suffix 제거
            const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
            return (
              <div
                key={note.date}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border-light, #F2F4F6)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{note.emoji}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>{dateStr}</span>
                  <button
                    onClick={() => handleDelete(note.date)}
                    aria-label={`${dateStr} 메모 삭제`}
                    style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6 }}>{note.text}</div>
              </div>
            );
          })}
        </div>
      ) : !isAdding && (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)' }}>
          매수/매도 이유를 기록하면 나중에 복기할 수 있어요
        </div>
      )}
    </div>
  );
}
