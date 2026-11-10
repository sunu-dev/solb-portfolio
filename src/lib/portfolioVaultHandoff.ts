/** One hand-off per owner, shared by all mounted useAuth consumers. Contains no
 * payload/key; completed hand-offs remain idempotent until that owner reopens.
 */
interface Handoff { close(): Promise<void> }
const sessions = new Map<string, { target: Handoff | null; pending: Promise<void> | null }>();

export function assertPortfolioVaultHandoffAvailable(): void {
  if ([...sessions.values()].some(session => session.target)) throw new Error('portfolio_vault_handoff_required');
}

export function registerPortfolioVaultHandoff(ownerId: string, target: Handoff): void {
  const previous = sessions.get(ownerId);
  if (previous?.target && previous.target !== target) throw new Error('portfolio_vault_already_open');
  for (const [otherOwner, session] of sessions) {
    if (otherOwner !== ownerId && session.target) throw new Error('portfolio_vault_handoff_required');
  }
  // Retain no unbounded account history in this browser process.
  for (const [otherOwner, session] of sessions) if (otherOwner !== ownerId && !session.target) sessions.delete(otherOwner);
  sessions.set(ownerId, { target, pending: null });
}

export async function finishPortfolioVaultHandoff(ownerId: string): Promise<boolean> {
  const session = sessions.get(ownerId);
  if (!session) return false;
  if (!session.pending) {
    if (!session.target) return true;
    const target = session.target;
    // Set pending before invoking close, so reentrant auth notifications cannot
    // start a second cleanup while the first one still owns the private state.
    session.pending = Promise.resolve().then(() => target.close());
    void session.pending.then(() => { session.target = null; }, () => { session.pending = null; });
  }
  await session.pending;
  return true;
}
