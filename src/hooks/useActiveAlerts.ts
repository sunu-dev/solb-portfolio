'use client';

import { useMemo, useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { isAlertSuppressed } from '@/utils/alertLearning';
import { isAlertSnoozed } from '@/utils/alertSnooze';
import { getMarketStatus } from '@/utils/marketHours';
import { sortWithSessionWeight } from '@/utils/alertWeighting';
import type { Alert } from '@/utils/alertsEngine';
// 본 훅은 severity=1이 learning 억제만 우회하는 미세 정책이 있어
// alertSuppress 통합 facade 대신 각각 직접 사용. 단순 consumer는 facade 사용 권장.

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
  const snoozeTick = usePortfolioStore(s => s.snoozeTick);

  // 시간대 재평가 — 5분마다 업데이트 (장마감 직후 등 전환 반영)
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus());
  useEffect(() => {
    const id = setInterval(() => setMarketStatus(getMarketStatus()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const filtered = alerts
      .filter(a => !dismissedAlerts.includes(a.id))
      .filter(a => !isAlertSnoozed(a.id))
      .filter(a => {
        if (opts.ignoreSuppression) return true;
        if (a.severity === 1) return true;
        return !isAlertSuppressed(a.id);
      })
      .filter(a => opts.maxSeverity == null || a.severity <= opts.maxSeverity)
      .filter(a => opts.symbol == null || a.symbol === opts.symbol);
    // 시간대 컨텍스트 기반 재정렬 (가격 기반 알림은 미장 외 시간엔 뒤로)
    return sortWithSessionWeight(filtered, marketStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, dismissedAlerts, snoozeTick, marketStatus, opts.ignoreSuppression, opts.maxSeverity, opts.symbol]);
}

/**
 * 읽지 않은 알림 수 (헤더 뱃지용) — 학습 suppress 반영
 */
export function useUnreadAlertCount(): number {
  const alerts = useActiveAlerts();
  return alerts.length;
}
