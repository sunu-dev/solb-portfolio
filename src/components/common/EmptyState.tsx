'use client';

import type { ReactNode } from 'react';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}

interface Props {
  icon?: ReactNode;       // 이모지 문자열 or JSX
  title: string;
  description?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  variant?: 'full' | 'compact';  // full: 60px padding / compact: 32px padding
}

export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'full',
}: Props) {
  const pad = variant === 'full' ? '60px 20px' : '32px 16px';
  const iconSize = variant === 'full' ? 40 : 28;
  const titleSize = variant === 'full' ? 16 : 14;

  return (
    <div style={{ textAlign: 'center', padding: pad }}>
      {icon && (
        <div style={{ fontSize: iconSize, marginBottom: variant === 'full' ? 14 : 8, lineHeight: 1 }}>
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 600,
          color: 'var(--text-primary, #191F28)',
          marginBottom: description ? 6 : 0,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary, #8B95A1)',
            lineHeight: 1.6,
            wordBreak: 'keep-all',
            maxWidth: 320,
            margin: '0 auto',
          }}
        >
          {description}
        </div>
      )}
      {(primaryAction || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: variant === 'full' ? 20 : 14,
            flexWrap: 'wrap',
          }}
        >
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="cursor-pointer"
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: primaryAction.variant === 'ghost' ? 'transparent' : '#3182F6',
                color: primaryAction.variant === 'ghost' ? '#3182F6' : '#fff',
                border: primaryAction.variant === 'ghost' ? '1px solid rgba(49,130,246,0.3)' : 'none',
                minHeight: 40,
              }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="cursor-pointer"
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--bg-subtle, #F2F4F6)',
                color: 'var(--text-secondary, #4E5968)',
                border: 'none',
                minHeight: 40,
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
