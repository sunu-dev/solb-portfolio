'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { isAlertSuppressed } from '@/utils/alertLearning';
import type { Alert } from '@/utils/alertsEngine';

interface Options {
  /** 학습 suppress 필터 건너뜀 (예: 전체 unread 뱃지에서는 건너뛰면 일관성 ↑) */
  ignoreSuppression?: boolean;
  /** severity <= N 인 알림만 */
  maxSeverity?: number;
  /** 특정 심볼만 */
  symbol?: string;
}

/**
 * 전역에서 일관되게 활성 알림 리스트를 얻는 훅.
 * - dismissedAlerts 해제 반영
 * - 학습된 suppress 타입 제거 (urgent severity=1 은 항상 노출)
 * - 심볼/심각도 필터 옵션
 *
 * 이 훅을 통해 필터링 로직을 통일 — 새 규칙 추가 시 1곳만 수정.
 */
export function useActiveAlerts(opts: Options = {}): Alert[] {
  const alerts = usePortfolioStore(s => s.alerts);
  const dismissedAlerts = usePortfolioStore(s => s.dismissedAlerts);

  return useMemo(() => {
    return alerts
      .filter(a => !dismissedAlerts.includes(a.id))
      .filter(a => {
        // 학습 suppress: urgent(severity 1)는 항상 노출
        if (opts.ignoreSuppression) return true;
        if (a.severity === 1) return true;
        return !isAlertSuppressed(a.id);
      })
      .filter(a => opts.maxSeverity == null || a.severity <= opts.maxSeverity)
      .filter(a => opts.symbol == null || a.symbol === opts.symbol)
      .sort((a, b) => a.severity - b.severity);
  }, [alerts, dismissedAlerts, opts.ignoreSuppression, opts.maxSeverity, opts.symbol]);
}

/**
 * 읽지 않은 알림 수 (헤더 뱃지용) — 학습 suppress 반영
 */
export function useUnreadAlertCount(): number {
  const alerts = useActiveAlerts();
  return alerts.length;
}
