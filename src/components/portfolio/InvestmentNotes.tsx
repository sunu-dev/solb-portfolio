'use client';

import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { StockNote } from '@/config/constants';

const EMOTION_TAGS = [
  { emoji: '🤔', label: '분석 후' },
  { emoji: '😤', label: '충동' },
  { emoji: '😱', label: '공포' },
  { emoji: '🎯', label: '목표 달성' },
  { emoji: '📰', label: '뉴스 보고' },
  { emoji: '💡', label: '인사이트' },
];

interface Props {
  symbol: string;
  category: 'investing' | 'watching' | 'sold';
  stockIdx: number;
  notes: StockNote[];
}

export default function InvestmentNotes({ symbol, category, stockIdx, notes }: Props) {
  const { updateStock } = usePortfolioStore();
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🤔');

  const handleAdd = () => {
    if (!text.trim()) return;
    const newNote: StockNote = {
      text: text.trim(),
      emoji: selectedEmoji,
      date: new Date().toISOString(),
    };
    const updated = [...(notes || []), newNote];
    updateStock(category, stockIdx, { notes: updated });
    setText('');
    setIsAdding(false);
  };

  const handleDelete = (idx: number) => {
    const updated = notes.filter((_, i) => i !== idx);
    updateStock(category, stockIdx, { notes: updated });
  };

  const sortedNotes = [...(notes || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#191F28' }}>📝 투자 메모</span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            style={{ fontSize: 12, fontWeight: 600, color: '#3182F6', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            + 메모 추가
          </button>
        )}
      </div>

      {/* 메모 입력 */}
      {isAdding && (
        <div style={{ padding: 16, borderRadius: 14, background: '#F8F9FA', marginBottom: 12 }}>
          {/* 감정 태그 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {EMOTION_TAGS.map(tag => (
              <button
                key={tag.emoji}
                onClick={() => setSelectedEmoji(tag.emoji)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  background: selectedEmoji === tag.emoji ? 'rgba(49,130,246,0.1)' : '#FFFFFF',
                  border: selectedEmoji === tag.emoji ? '1px solid rgba(49,130,246,0.3)' : '1px solid #E5E8EB',
                  color: selectedEmoji === tag.emoji ? '#3182F6' : '#8B95A1',
                  cursor: 'pointer',
                  fontWeight: selectedEmoji === tag.emoji ? 600 : 400,
                }}
              >
                {tag.emoji} {tag.label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="왜 이 종목을 매수/매도했나요? 나중에 복기할 수 있어요."
            style={{
              width: '100%',
              minHeight: 70,
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#FFFFFF',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => { setIsAdding(false); setText(''); }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#8B95A1', background: '#FFFFFF', border: '1px solid #E5E8EB', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 타임라인 */}
      {sortedNotes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedNotes.map((note, idx) => {
            const d = new Date(note.date);
            const dateStr = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
            return (
              <div
                key={idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  border: '1px solid #F2F4F6',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{note.emoji}</span>
                  <span style={{ fontSize: 11, color: '#B0B8C1' }}>{dateStr}</span>
                  <button
                    onClick={() => handleDelete(notes.indexOf(note))}
                    style={{ marginLeft: 'auto', fontSize: 12, color: '#B0B8C1', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6 }}>{note.text}</div>
              </div>
            );
          })}
        </div>
      ) : !isAdding && (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#B0B8C1' }}>
          매수/매도 이유를 기록하면 나중에 복기할 수 있어요
        </div>
      )}
    </div>
  );
}
