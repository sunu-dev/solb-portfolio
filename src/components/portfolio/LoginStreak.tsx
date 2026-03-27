'use client';

import { useEffect, useState } from 'react';

const STREAK_KEY = 'solb_streak';
const BADGES = [
  { days: 7, emoji: '🔥', label: '1주' },
  { days: 30, emoji: '⭐', label: '1개월' },
  { days: 100, emoji: '💎', label: '100일' },
  { days: 365, emoji: '👑', label: '1년' },
];

interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { count: 0, lastDate: '' };
}

function saveStreak(data: StreakData) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export default function LoginStreak() {
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastDate: '' });
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    const today = getToday();
    const saved = loadStreak();

    if (saved.lastDate === today) {
      // 이미 오늘 기록됨
      setStreak(saved);
      return;
    }

    // 어제인지 확인
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newCount: number;
    if (saved.lastDate === yesterdayStr) {
      newCount = saved.count + 1;
    } else {
      newCount = 1; // 스트릭 끊김, 리셋
    }

    const newData = { count: newCount, lastDate: today };
    saveStreak(newData);
    setStreak(newData);

    // 뱃지 달성 시 잠깐 하이라이트
    if (BADGES.some(b => b.days === newCount)) {
      setShowBadge(true);
      setTimeout(() => setShowBadge(false), 3000);
    }
  }, []);

  if (streak.count <= 0) return null;

  const currentBadge = [...BADGES].reverse().find(b => streak.count >= b.days);
  const nextBadge = BADGES.find(b => streak.count < b.days);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: '6px 12px',
      padding: '8px 16px',
      borderRadius: 10,
      background: showBadge ? 'rgba(239,68,82,0.06)' : '#F8F9FA',
      marginBottom: 8,
      transition: 'background 0.3s',
    }}>
      <span style={{ fontSize: 16 }}>{currentBadge?.emoji || '🔥'}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#191F28' }}>
        {streak.count}일 연속
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {BADGES.map(b => (
          <span
            key={b.days}
            style={{
              fontSize: 14,
              opacity: streak.count >= b.days ? 1 : 0.2,
              transition: 'opacity 0.5s',
            }}
            title={`${b.label} 달성`}
          >
            {b.emoji}
          </span>
        ))}
      </div>
      {nextBadge && (
        <span style={{ fontSize: 11, color: '#B0B8C1', marginLeft: 'auto' }}>
          {nextBadge.emoji} {nextBadge.days - streak.count}일 후
        </span>
      )}
    </div>
  );
}
