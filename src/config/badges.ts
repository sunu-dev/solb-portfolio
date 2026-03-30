/**
 * 성취 뱃지 — 화투 족보 기반
 * 피(기본) → 띠(성장) → 열끗(실력) → 광(달성) → 비광(전설)
 */

export interface Badge {
  id: string;
  name: string;
  hwatu: string;  // 화투 족보명
  icon: string;
  description: string;
  condition: string;
  color: string;
}

export const BADGES: Badge[] = [
  // 피 — 기본 행동
  { id: 'first-stock', name: '첫 종목', hwatu: '피', icon: '🌱', description: '첫 종목을 추가했어요', condition: '종목 1개 추가', color: '#8B95A1' },
  { id: 'three-stocks', name: '세 종목', hwatu: '피', icon: '🌿', description: '3개 종목을 관리하고 있어요', condition: '종목 3개 등록', color: '#8B95A1' },
  { id: 'first-login', name: '첫 방문', hwatu: '피', icon: '👋', description: 'SOLB에 처음 오셨어요', condition: '첫 로그인', color: '#8B95A1' },

  // 띠 — 꾸준한 성장
  { id: 'streak-7', name: '7일 연속', hwatu: '홍단', icon: '🔥', description: '7일 연속 접속했어요', condition: '7일 연속 로그인', color: '#EF4452' },
  { id: 'streak-30', name: '30일 연속', hwatu: '청단', icon: '💎', description: '30일 연속 접속! 대단해요', condition: '30일 연속 로그인', color: '#3182F6' },
  { id: 'five-stocks', name: '다섯 종목', hwatu: '초단', icon: '🌳', description: '5개 종목을 관리하고 있어요', condition: '종목 5개 등록', color: '#16A34A' },
  { id: 'first-analysis', name: '첫 분석', hwatu: '홍단', icon: '🔍', description: 'AI 분석을 처음 사용했어요', condition: 'AI 분석 1회', color: '#EF4452' },

  // 열끗 — 실력 인정
  { id: 'ten-stocks', name: '열 종목', hwatu: '열끗', icon: '📊', description: '10개 종목 포트폴리오!', condition: '종목 10개 등록', color: '#7C3AED' },
  { id: 'mentor-all', name: '멘토 마스터', hwatu: '열끗', icon: '🎓', description: '6가지 멘토 분석을 모두 사용했어요', condition: '멘토 6종류 모두 사용', color: '#7C3AED' },
  { id: 'streak-100', name: '100일 연속', hwatu: '열끗', icon: '👑', description: '100일 연속 접속! 전설이에요', condition: '100일 연속 로그인', color: '#7C3AED' },

  // 광 — 특별 달성
  { id: 'first-profit', name: '첫 수익', hwatu: '광', icon: '🎉', description: '첫 수익을 달성했어요!', condition: '보유 종목 중 1개 수익', color: '#D4A853' },
  { id: 'target-hit', name: '목표 달성', hwatu: '광', icon: '🏆', description: '목표 수익률에 도달했어요!', condition: '목표 수익률 100% 달성', color: '#D4A853' },
  { id: 'all-profit', name: '전승', hwatu: '광', icon: '⭐', description: '모든 종목이 수익이에요!', condition: '보유 종목 전체 수익', color: '#D4A853' },

  // 비광 — 전설 (SOLB 최고 뱃지)
  { id: 'rain-light', name: '비광', hwatu: '비광', icon: '🌈', description: '폭풍우에도 흔들리지 않았어요', condition: '하락장(-5%+)에서도 포트폴리오 수익 유지', color: '#1B6B3A' },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

// 족보별 그룹
export const BADGE_TIERS = [
  { tier: '피', label: '기본', color: '#8B95A1', badges: BADGES.filter(b => b.hwatu === '피') },
  { tier: '띠', label: '성장', color: '#EF4452', badges: BADGES.filter(b => b.hwatu === '홍단' || b.hwatu === '청단' || b.hwatu === '초단') },
  { tier: '열끗', label: '실력', color: '#7C3AED', badges: BADGES.filter(b => b.hwatu === '열끗') },
  { tier: '광', label: '달성', color: '#D4A853', badges: BADGES.filter(b => b.hwatu === '광') },
  { tier: '비광', label: '전설', color: '#1B6B3A', badges: BADGES.filter(b => b.hwatu === '비광') },
];
