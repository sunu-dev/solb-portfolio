import { supabase } from './supabase';
import { logApiCall } from './apiLogger';
import { TOUR_EVENT_SET } from './tourEvents';

/**
 * 투어/활성화 텔레메트리 통합 래퍼.
 *
 * - 로그인 → api_logs (검증된 user_id, 기존 admin/growth 코호트 인프라 재사용)
 * - 게스트 → /api/tour-event (no-auth sink, anon_id) — logApiCall이 못 잡는 비로그인 funnel 메움
 *
 * 화이트리스트(tourEvents.ts) 밖 이벤트는 클라에서도 무시(서버와 이중 방어).
 */

const ANON_KEY = 'solb_anon_id';
const FEAT_KEY = 'solb_feat_used';

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `a-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon-nostore';
  }
}

/** 투어/활성화 이벤트 1건 기록 (로그인=api_logs / 게스트=tour_events). */
export async function logTourEvent(event: string, meta?: Record<string, unknown>): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!TOUR_EVENT_SET.has(event)) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      // 이미 확보한 user.id를 전달 → logApiCall이 getSession 재조회 안 함(만료 경계 이벤트 유실 방지)
      logApiCall(event, undefined, { ...meta, auth: 'user' }, session.user.id);
    } else {
      const body = JSON.stringify({ event, anonId: getAnonId(), meta: meta || {} });
      // keepalive — 로그인 이동 등 페이지 이탈 중에도 전송 보장
      fetch('/api/tour-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* 텔레메트리 — silent */ });
    }
  } catch { /* silent */ }
}

/**
 * 기능 첫 사용 1회 발화 (채택률 KPI). localStorage 가드로 중복 차단.
 * featureId는 tourRegistry의 featureId와 정렬해 코호트 분석에 사용.
 */
export function logFeatureFirstUse(featureId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const used: string[] = JSON.parse(localStorage.getItem(FEAT_KEY) || '[]');
    if (used.includes(featureId)) return;
    used.push(featureId);
    localStorage.setItem(FEAT_KEY, JSON.stringify(used));
    void logTourEvent('feature_first_use', { featureId });
  } catch { /* ignore */ }
}
