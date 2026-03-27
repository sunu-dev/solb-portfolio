'use client';

import { useEffect, useState, useRef } from 'react';

const STREAK_KEY = 'solb_streak';
const BADGES = [
  { days: 7, emoji: '🔥', label: '1주' },
  { days: 30, emoji: '⭐', label: '1개월' },
  { days: 100, emoji: '💎', label: '100일' },
  { days: 365, emoji: '👑', label: '1년' },
];

interface StreakData {
  count: number;
  lastDate: string;
}

function getToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
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
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const today = getToday();
    const saved = loadStreak();

    if (saved.lastDate === today) {
      setStreak(saved);
      return;
    }

    const now = new Date();
    const kstYesterday = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    kstYesterday.setDate(kstYesterday.getDate() - 1);
    const yesterdayStr = kstYesterday.toISOString().split('T')[0];

    const newCount = saved.lastDate === yesterdayStr ? saved.count + 1 : 1;
    const newData = { count: newCount, lastDate: today };
    saveStreak(newData);
    setStreak(newData);

    if (BADGES.some(b => b.days === newCount)) {
      setShowBadge(true);
      badgeTimerRef.current = setTimeout(() => setShowBadge(false), 3000);
    }

    return () => {
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    };
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
      background: showBadge ? 'rgba(239,68,82,0.06)' : 'var(--bg-subtle, #F8F9FA)',
      marginBottom: 8,
      transition: 'background 0.3s',
    }}>
      <span style={{ fontSize: 16 }}>{currentBadge?.emoji || '🔥'}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
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
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto' }}>
          {nextBadge.emoji} {nextBadge.days - streak.count}일 후
        </span>
      )}
    </div>
  );
}
