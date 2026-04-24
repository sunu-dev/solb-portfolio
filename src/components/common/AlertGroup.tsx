'use client';

import { useState } from 'react';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import AlertCard from './AlertCard';

interface Props {
  alerts: Alert[];
  onDismiss: (id: string) => void;
  onSnooze?: (id: string) => void;
  onAnalyze?: (symbol: string) => void;
}

/**
 * 심볼별 그룹핑 알림 렌더러
 * - 1개면 AlertCard 그대로
 * - 2개+면 묶음 헤더(심볼·개수) + 펼침 토글
 * - PORTFOLIO 알림은 독립 그룹
 */
export default function AlertGroup({ alerts, onDismiss, onSnooze, onAnalyze }: Props) {
  // 심볼별 묶기 — 순서는 입력 순서(이미 severity 정렬됨)
  const groups: { symbol: string; alerts: Alert[] }[] = [];
  const seen = new Map<string, number>();
  for (const a of alerts) {
    const idx = seen.get(a.symbol);
    if (idx === undefined) {
      seen.set(a.symbol, groups.length);
      groups.push({ symbol: a.symbol, alerts: [a] });
    } else {
      groups[idx].alerts.push(a);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map(g => {
        if (g.alerts.length === 1) {
          return (
            <AlertCard
              key={g.alerts[0].id}
              alert={g.alerts[0]}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              onAnalyze={onAnalyze}
            />
          );
        }
        return (
          <GroupedCard
            key={g.symbol}
            symbol={g.symbol}
            alerts={g.alerts}
            onDismiss={onDismiss}
            onSnooze={onSnooze}
            onAnalyze={onAnalyze}
          />
        );
      })}
    </div>
  );
}

// ─── 묶음 카드 ────────────────────────────────────────────────────────────────
function GroupedCard({
  symbol, alerts, onDismiss, onSnooze, onAnalyze,
}: {
  symbol: string;
  alerts: Alert[];
  onDismiss: (id: string) => void;
  onSnooze?: (id: string) => void;
  onAnalyze?: (symbol: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const kr = STOCK_KR[symbol] || symbol;
  const isPortfolio = symbol === 'PORTFOLIO';
  const avatarColor = isPortfolio ? 'linear-gradient(135deg, #3182F6, #AF52DE)' : getAvatarColor(symbol);

  // 최고 severity 알림이 헤더 색상 결정
  const primary = alerts[0];
  const color =
    primary.type === 'urgent' ? 'var(--color-danger, #EF4452)'
    : primary.type === 'risk' ? 'var(--color-warning, #FF9500)'
    : primary.type === 'opportunity' ? 'var(--color-success, #00C6BE)'
    : primary.type === 'celebrate' ? 'var(--color-purple, #AF52DE)'
    : 'var(--color-info, #3182F6)';

  return (
    <div
      style={{
        borderRadius: 12,
        background: 'var(--surface, #FFFFFF)',
        border: `1px solid ${color}33`, // 0x33 ≈ 20% opacity
        overflow: 'hidden',
      }}
    >
      {/* 헤더 (클릭 시 펼침) */}
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={`${kr} 알림 ${alerts.length}개 ${expanded ? '접기' : '펼치기'}`}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
        }}
      >
        {/* 아바타 */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 12,
        }}>
          {isPortfolio
            ? <span>💼</span>
            : <span style={{ fontWeight: 700, color: '#fff' }}>{symbol.charAt(0)}</span>}
        </div>

        {/* 심볼 + 개수 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              {isPortfolio ? '포트폴리오' : kr}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
              background: color, color: '#fff',
            }}>
              {alerts.length}개
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alerts.map(a => a.message.split(' ')[0]).join(' · ')}
          </div>
        </div>

        {/* 화살표 */}
        <span style={{
          fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>
          ▼
        </span>
      </button>

      {/* 펼친 내부 — 각 알림 AlertCard */}
      {expanded && (
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map(a => (
            <AlertCard
              key={a.id}
              alert={a}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              onAnalyze={onAnalyze}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
