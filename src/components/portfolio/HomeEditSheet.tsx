'use client';

import { type CSSProperties } from 'react';
import {
  ChevronUp, ChevronDown, RotateCcw,
  Sun, Building2, CalendarRange, Sparkles, TrendingUp, BarChart3, LayoutGrid, HeartPulse, Target, BookOpen,
} from 'lucide-react';
import type { ComponentType } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import { usePortfolioStore } from '@/store/portfolioStore';
import {
  getWidget, resolveWidgetOrder, isWidgetHidden,
  type HomeWidget, type WidgetZone, type WidgetId,
} from '@/lib/homeWidgetRegistry';
import { logApiCall } from '@/lib/apiLogger';
import { announce } from '@/lib/announce';
import { withEulReul } from '@/utils/koreanJosa';

/**
 * 홈 화면 편집 시트 — 토스/iOS 설정풍 그룹 카드 리디자인.
 * zone(상단·보유아래·분석)을 카드 그룹으로, 위젯마다 정체성 아이콘, 표시/숨김은 스위치, below-core는 ↑↓.
 * 기능/접근성 보존: aria(role=switch·aria-checked·aria-label)·44px·announce(koreanJosa)·텔레메트리.
 * §6: ai-hunch-link은 hideable:false → 스위치 대신 '항상' 배지. 모든 색은 디자인 토큰만(lint:darkmode strict 준수).
 */

type IconType = ComponentType<{ size?: number | string; strokeWidth?: number }>;

const WIDGET_ICON: Record<WidgetId, IconType> = {
  'morning-briefing': Sun,
  'broker-block': Building2,
  'monthly-chapter': CalendarRange,
  'ai-hunch-link': Sparkles,
  'value-chart': TrendingUp,
  'benchmark-compare': BarChart3,
  'treemap': LayoutGrid,
  'portfolio-health': HeartPulse,
  'goal-progress': Target,
  'chapter-shelf': BookOpen,
};

const ZONES: { zone: WidgetZone; label: string; sub: string }[] = [
  { zone: 'above-core', label: '상단', sub: '자산 요약 바로 아래' },
  { zone: 'below-core', label: '보유 종목 아래', sub: '순서도 바꿀 수 있어요' },
  { zone: 'analysis', label: '분석 탭', sub: '분석 탭에 보이는 위젯' },
];

// iOS 스타일 토글 스위치 — ON=teal, 흰 knob.
function ToggleSwitch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{
        flexShrink: 0, width: 46, height: 28, borderRadius: 999, padding: 3, border: 'none', cursor: 'pointer',
        background: on ? 'var(--brand-primary)' : 'var(--border-strong, #E5E8EB)',
        display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.22s ease',
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 999, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

const reorderBtn = (disabled: boolean): CSSProperties => ({
  width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
  color: disabled ? 'var(--text-tertiary, #B0B8C1)' : 'var(--text-secondary, #4E5968)', opacity: disabled ? 0.35 : 1,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 컨테이너 부수효과(broker-block 숨김 시 brokerFilter 리셋) 포함 토글. */
  onToggleWidget: (id: string) => void;
}

export default function HomeEditSheet({ isOpen, onClose, onToggleWidget }: Props) {
  const { hiddenWidgets, widgetOrder, moveWidget, resetHomeLayout } = usePortfolioStore();

  const renderRow = (w: HomeWidget, order?: { first: boolean; last: boolean }, isLast?: boolean) => {
    const hidden = isWidgetHidden(w.id, hiddenWidgets); // non-hideable이면 항상 false
    const Icon = WIDGET_ICON[w.id];
    return (
      <div
        key={w.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 60,
          borderBottom: isLast ? 'none' : '1px solid var(--border-light, #F2F4F6)',
        }}
      >
        {/* 위젯 정체성 아이콘 */}
        <span style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--brand-primary-light, rgba(14,124,123,0.08))', color: 'var(--brand-primary)',
          opacity: hidden ? 0.45 : 1,
        }}>
          {Icon ? <Icon size={19} strokeWidth={2} /> : null}
        </span>
        {/* 라벨 */}
        <span style={{ flex: 1, minWidth: 0, opacity: hidden ? 0.5 : 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.01em' }}>
            {w.label}
          </span>
          {hidden && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 1 }}>숨김</span>}
        </span>
        {/* 순서변경(below-core) */}
        {w.reorderable && order && (
          <div style={{ display: 'flex', borderRadius: 9, border: '1px solid var(--border-light, #F2F4F6)', overflow: 'hidden' }}>
            <button
              onClick={() => { logApiCall('widget_reorder', undefined, { id: w.id, dir: 'up' }); moveWidget(w.id, 'up'); announce(`${withEulReul(w.label)} 위로 옮겼어요`); }}
              disabled={order.first} aria-label={`${w.label} 위로 옮기기`} style={reorderBtn(order.first)}
            ><ChevronUp size={17} /></button>
            <span style={{ width: 1, background: 'var(--border-light, #F2F4F6)' }} />
            <button
              onClick={() => { logApiCall('widget_reorder', undefined, { id: w.id, dir: 'down' }); moveWidget(w.id, 'down'); announce(`${withEulReul(w.label)} 아래로 옮겼어요`); }}
              disabled={order.last} aria-label={`${w.label} 아래로 옮기기`} style={reorderBtn(order.last)}
            ><ChevronDown size={17} /></button>
          </div>
        )}
        {/* 표시/숨김 스위치 또는 '항상' 배지 */}
        {w.hideable ? (
          <ToggleSwitch
            on={!hidden}
            label={hidden ? `${w.label} 표시하기` : `${w.label} 숨기기`}
            onClick={() => { logApiCall('widget_toggle', undefined, { id: w.id, to: hidden ? 'shown' : 'hidden' }); onToggleWidget(w.id); announce(`${withEulReul(w.label)} ${hidden ? '다시 표시했어요' : '숨겼어요'}`); }}
          />
        ) : (
          <span style={{
            flexShrink: 0, padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            background: 'var(--brand-primary-light, rgba(14,124,123,0.08))', color: 'var(--brand-primary)',
          }}>항상 표시</span>
        )}
      </div>
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} desktopVariant>
      <div style={{ padding: '2px 18px 12px' }}>
        {/* 헤더 */}
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.03em' }}>
          홈 화면 편집
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', margin: '6px 0 20px', lineHeight: 1.5 }}>
          보조 위젯을 켜고 끄거나 순서를 바꿔요.<br />자산 요약과 보유 종목은 항상 보여요.
        </p>

        {/* zone 그룹 카드 */}
        {ZONES.map(({ zone, label, sub }) => {
          const widgets = resolveWidgetOrder(widgetOrder, zone)
            .map((id) => getWidget(id))
            .filter((w): w is HomeWidget => !!w);
          if (widgets.length === 0) return null;
          return (
            <div key={zone} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, margin: '0 4px 9px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.01em' }}>{label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary, #B0B8C1)' }}>{sub}</span>
              </div>
              <div style={{
                background: 'var(--surface, #FFFFFF)', borderRadius: 16, overflow: 'hidden',
                boxShadow: 'var(--card-shadow, 0 2px 6px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06))',
              }}>
                {widgets.map((w, i) => renderRow(
                  w,
                  w.reorderable ? { first: i === 0, last: i === widgets.length - 1 } : undefined,
                  i === widgets.length - 1,
                ))}
              </div>
            </div>
          );
        })}

        {/* 기본값 되돌리기 */}
        <button
          onClick={() => { logApiCall('home_layout_reset', undefined, { hiddenCount: hiddenWidgets.length }); resetHomeLayout(); announce('홈 화면을 기본값으로 되돌렸어요'); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            width: '100%', padding: '13px', marginTop: 6, minHeight: 48,
            background: 'transparent', border: '1px solid var(--border-light, #F2F4F6)',
            borderRadius: 13, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary, #4E5968)',
          }}
        >
          <RotateCcw size={15} /> 기본값으로 되돌리기
        </button>
      </div>
    </BottomSheet>
  );
}
