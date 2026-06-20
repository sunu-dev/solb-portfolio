'use client';

import { type CSSProperties } from 'react';
import { Eye, EyeOff, ChevronUp, ChevronDown, Lock, RotateCcw } from 'lucide-react';
import BottomSheet from '@/components/common/BottomSheet';
import { usePortfolioStore } from '@/store/portfolioStore';
import {
  getWidget, resolveWidgetOrder, isWidgetHidden,
  type HomeWidget, type WidgetZone,
} from '@/lib/homeWidgetRegistry';
import { logApiCall } from '@/lib/apiLogger';
import { announce } from '@/lib/announce';
import { withEulReul } from '@/utils/koreanJosa';

/**
 * 홈 화면 편집 시트 — 코어 끼임 3존(상단·보유아래·분석)을 단일 수직 리스트로 평탄화.
 * 표시/숨김 토글 + below-core 순서변경(↑↓, DnD 없음 WCAG 2.5.7) + 리셋. 즉시저장(본문 실시간 반영).
 * §6: ai-hunch-link은 hideable:false → 토글 대신 Lock 배지(영구무료 AI촉 발견경로 박제).
 * broker-block 숨김 시 brokerFilter 리셋(orphan-lock 방지)은 컨테이너가 onToggleWidget로 주입.
 */

const ZONES: { zone: WidgetZone; label: string; sub: string }[] = [
  { zone: 'above-core', label: '상단', sub: '자산 요약 바로 아래' },
  { zone: 'below-core', label: '보유 종목 아래', sub: '순서도 바꿀 수 있어요' },
  { zone: 'analysis', label: '분석 탭', sub: '분석 탭에 보이는 위젯' },
];

const ctrlBtn = (disabled: boolean, active?: boolean): CSSProperties => ({
  flexShrink: 0, width: 44, height: 44, borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
  color: disabled ? 'var(--border-light, #F2F4F6)' : active ? 'var(--brand-primary)' : 'var(--text-tertiary, #B0B8C1)',
  opacity: disabled ? 0.45 : 1,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 컨테이너 부수효과(broker-block 숨김 시 brokerFilter 리셋) 포함 토글. */
  onToggleWidget: (id: string) => void;
}

export default function HomeEditSheet({ isOpen, onClose, onToggleWidget }: Props) {
  const { hiddenWidgets, widgetOrder, moveWidget, resetHomeLayout } = usePortfolioStore();

  const renderRow = (w: HomeWidget, order?: { first: boolean; last: boolean }) => {
    const hidden = isWidgetHidden(w.id, hiddenWidgets); // non-hideable이면 항상 false
    return (
      <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 4px', borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: hidden ? 'var(--text-tertiary, #B0B8C1)' : 'var(--text-primary, #191F28)' }}>
          {w.label}
          {hidden && <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 6, fontWeight: 500 }}>숨김</span>}
        </span>
        {w.reorderable && order && (
          <>
            <button
              onClick={() => { logApiCall('widget_reorder', undefined, { id: w.id, dir: 'up' }); moveWidget(w.id, 'up'); announce(`${withEulReul(w.label)} 위로 옮겼어요`); }}
              disabled={order.first} aria-label={`${w.label} 위로 옮기기`} style={ctrlBtn(order.first)}
            ><ChevronUp size={18} /></button>
            <button
              onClick={() => { logApiCall('widget_reorder', undefined, { id: w.id, dir: 'down' }); moveWidget(w.id, 'down'); announce(`${withEulReul(w.label)} 아래로 옮겼어요`); }}
              disabled={order.last} aria-label={`${w.label} 아래로 옮기기`} style={ctrlBtn(order.last)}
            ><ChevronDown size={18} /></button>
          </>
        )}
        {w.hideable ? (
          <button
            onClick={() => { logApiCall('widget_toggle', undefined, { id: w.id, to: hidden ? 'shown' : 'hidden' }); onToggleWidget(w.id); announce(`${withEulReul(w.label)} ${hidden ? '다시 표시했어요' : '숨겼어요'}`); }}
            aria-pressed={!hidden}
            aria-label={hidden ? `${w.label} 표시하기` : `${w.label} 숨기기`}
            style={ctrlBtn(false, !hidden)}
          >{hidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        ) : (
          <span aria-label={`${w.label}은 항상 표시돼요`} style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary, #B0B8C1)' }}>
            <Lock size={15} />
          </span>
        )}
      </div>
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} desktopVariant>
      <div style={{ padding: '4px 16px 8px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.03em', marginBottom: 4 }}>
          홈 화면 편집
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 16, lineHeight: 1.5 }}>
          보조 위젯을 표시·숨김하거나 순서를 바꿔요. 자산 요약과 보유 종목은 항상 보여요.
        </p>

        {ZONES.map(({ zone, label, sub }) => {
          const widgets = resolveWidgetOrder(widgetOrder, zone)
            .map((id) => getWidget(id))
            .filter((w): w is HomeWidget => !!w);
          if (widgets.length === 0) return null;
          return (
            <div key={zone} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary, #B0B8C1)', margin: '0 4px 1px' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', margin: '0 4px 4px' }}>{sub}</div>
              {widgets.map((w, i) => renderRow(
                w,
                w.reorderable ? { first: i === 0, last: i === widgets.length - 1 } : undefined,
              ))}
            </div>
          );
        })}

        <button
          onClick={() => { logApiCall('home_layout_reset', undefined, { hiddenCount: hiddenWidgets.length }); resetHomeLayout(); announce('홈 화면을 기본값으로 되돌렸어요'); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '12px', marginTop: 4, minHeight: 44,
            background: 'var(--bg-subtle, #F8F9FA)', border: '1px solid var(--border-light, #F2F4F6)',
            borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #4E5968)',
          }}
        >
          <RotateCcw size={15} /> 기본값으로 되돌리기
        </button>
      </div>
    </BottomSheet>
  );
}
