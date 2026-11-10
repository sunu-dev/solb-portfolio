/** Server-only cutover control. Deployment configuration, not a browser flag.
 * Pausing prevents new work in this deployment; it does NOT recall provider
 * deliveries, erase queued bodies, or prove that old deployments have drained.
 */
export function privateNotificationsPaused(): boolean {
  const setting = process.env.PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED;
  // Existing deployments retain behavior when unset. A configured typo pauses
  // conservatively instead of silently sending personal messages during cutover.
  return setting !== undefined && setting !== 'off';
}
export const PRIVATE_NOTIFICATION_PAUSE_REASON = 'private-notifications-paused';
