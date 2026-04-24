'use client';

import { INVESTOR_TYPES, type InvestorType } from '@/config/investorTypes';

interface Props {
  currentType?: InvestorType;
  onSelect: (type: InvestorType) => void;
}

/**
 * 5개 유형 카드 직접 선택
 * - 퀴즈 대신 곧바로 고르고 싶을 때
 * - Settings에서 재선택 시 주로 사용
 */
export default function InvestorTypePicker({ currentType, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(Object.values(INVESTOR_TYPES)).map(meta => {
        const isActive = currentType === meta.id;
        return (
          <button
            key={meta.id}
            onClick={() => onSelect(meta.id)}
            aria-pressed={isActive}
            className="cursor-pointer"
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: isActive ? 'var(--surface, #FFFFFF)' : 'var(--bg-subtle, #F8F9FA)',
              border: `2px solid ${isActive ? meta.accentColor : 'var(--border-light, #F2F4F6)'}`,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{meta.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text-primary, #191F28)',
                }}>
                  {meta.nameKr}
                </span>
                {isActive && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: meta.accentColor, color: '#fff',
                  }}>
                    현재
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: meta.accentColor, fontWeight: 600, marginBottom: 6 }}>
                {meta.tagline}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                {meta.keyTraits.slice(0, 3).join(' · ')}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
