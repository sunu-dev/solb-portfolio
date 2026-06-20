/**
 * SOLB 디자인 토큰 — TypeScript 상수
 *
 * 인라인 스타일에서 이 상수를 참조하세요.
 * 값은 모두 CSS 변수를 가리키므로 다크모드가 자동 적용돼요.
 *
 * 사용 예:
 *   style={{ background: T.surface, color: T.textPrimary, borderRadius: T.radius.md }}
 */

// ─── Colors ──────────────────────────────────────────────────────────────────
export const color = {
  // Surface / 배경
  bg: 'var(--bg, #FFFFFF)',
  bgSubtle: 'var(--bg-subtle, #F8F9FA)',
  surface: 'var(--surface, #FFFFFF)',
  surfaceHover: 'var(--surface-hover, #F9FAFB)',

  // Text
  textPrimary: 'var(--text-primary, #191F28)',
  textSecondary: 'var(--text-secondary, #8B95A1)',
  textTertiary: 'var(--text-tertiary, #B0B8C1)',
  textInverse: 'var(--text-inverse, #FFFFFF)',

  // Border
  border: 'var(--border-strong, #E5E8EB)',
  borderLight: 'var(--border-light, #F2F4F6)',
  borderRow: 'var(--border-row, #F7F8FA)',

  // Brand
  brandPrimary: 'var(--brand-primary, #0E7C7B)',        // Mossy Teal — 토스블루 회피, AI·CTA 액센트
  brandPrimaryLight: 'var(--brand-primary-light, rgba(14,124,123,0.08))',
  brandPrimaryBg: 'var(--brand-primary-bg, rgba(14,124,123,0.06))',
  brandSol: 'var(--brand-sol, #1B6B3A)',
  brandRain: 'var(--brand-rain, #3182F6)',
  brandGold: 'var(--brand-gold, #D4A853)',

  // Market semantic (한국 시장 관례: 상승 = 빨강, 하락 = 파랑)
  gain: 'var(--color-gain, #EF4452)',
  gainBg: 'var(--color-gain-bg, rgba(239,68,82,0.06))',
  loss: 'var(--color-loss, #3182F6)',
  lossBg: 'var(--color-loss-bg, rgba(49,130,246,0.06))',

  // Semantic
  danger: 'var(--color-danger, #EF4452)',
  dangerBg: 'var(--color-danger-bg, rgba(239,68,82,0.08))',
  warning: 'var(--color-warning, #FF9500)',
  warningBg: 'var(--color-warning-bg, rgba(255,149,0,0.08))',
  success: 'var(--color-success, #00C6BE)',
  successBg: 'var(--color-success-bg, rgba(0,198,190,0.08))',
  info: 'var(--color-info, #3182F6)',
  infoBg: 'var(--color-info-bg, rgba(49,130,246,0.08))',
  purple: 'var(--color-purple, #AF52DE)',
  purpleBg: 'var(--color-purple-bg, rgba(175,82,222,0.08))',
};

// ─── Radius ──────────────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 20,
  full: 9999,
};

// ─── Font size ───────────────────────────────────────────────────────────────
export const fontSize = {
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 15,
  '2xl': 16,
  '3xl': 17,
  '4xl': 18,
  display: 20,
};

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
};

// ─── Shadow ──────────────────────────────────────────────────────────────────
export const shadow = {
  sm: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
  md: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))',
  lg: 'var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.08))',
  card: 'var(--card-shadow, 0 2px 6px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06))',
};

// ─── Breakpoints / Layout (PC 정보밀도 표준, docs/PC_DENSITY_LAYOUT_PLAN.md) ───
// Tailwind v4 기본 브레이크포인트와 1:1. JS측 반응형 판단·문서 참조용 SSOT.
// 폰트는 밀도를 위해 줄이지 않는다(가독성) — 좁으면 컬럼을 늘려 채운다.
export const breakpoint = { md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
export const container = { base: 1200, xl: 1360, '2xl': 1520 } as const; // .app-shell 단계 폭
export const gridGap = { base: 20, xl: 24 } as const;                    // .fill-grid / .cols-2-xl

// ─── 축약 export: 한 번에 import ─────────────────────────────────────────────
export const T = { color, radius, fontSize, spacing, shadow, breakpoint, container, gridGap };
export default T;
