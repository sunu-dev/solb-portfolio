import type { WatchCoverage } from './marketWatch';

export function trackWatchSources(current: WatchCoverage[], previous: WatchCoverage[], now: string) {
  const alerts: string[] = [];
  const coverage = current.map(item => {
    const prior = previous.find(row => row.id === item.id);
    if (item.available >= item.total) return { ...item, lastSuccessAt: now, consecutiveFailures: 0 };
    const failureSince = prior?.failureSince || now;
    const lasting = Date.parse(now) - Date.parse(failureSince) >= 30 * 60000;
    const alertDue = !prior?.lastAlertAt || Date.parse(now) - Date.parse(prior.lastAlertAt) >= 3600000;
    if (lasting && alertDue) alerts.push(item.id);
    return { ...item, lastSuccessAt: prior?.lastSuccessAt, failureSince,
      consecutiveFailures: (prior?.consecutiveFailures || 0) + 1,
      lastAlertAt: lasting && alertDue ? now : prior?.lastAlertAt };
  });
  return { coverage, alerts };
}
