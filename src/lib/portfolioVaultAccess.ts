/** Read-only entry gate. Mount private readers/sync only after this resolves.
 * Not yet connected to the live homepage. A legacy response is a migration
 * requirement, never permission to restart plaintext persistence.
 */
import { isProtectedPortfolioOwner, markProtectedPortfolioOwner } from './portfolioVaultPolicy';
import { readPortfolioVault, type PortfolioVaultRpc } from './portfolioVaultSync';

export type PortfolioVaultAccessView =
  | { status: 'idle' }
  | { status: 'checking' | 'locked' | 'migration-required' | 'unavailable'; ownerId: string };

export class PortfolioVaultAccess {
  #generation = 0;
  #view: PortfolioVaultAccessView = { status: 'idle' };
  #listeners = new Set<() => void>();
  constructor(private readonly rpc: PortfolioVaultRpc,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  getSnapshot = (): PortfolioVaultAccessView => this.#view;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #publish(view: PortfolioVaultAccessView): void {
    this.#view = view;
    for (const listener of this.#listeners) listener();
  }
  reset(): void {
    this.#generation++;
    this.#publish({ status: 'idle' });
  }
  async check(ownerId: string): Promise<void> {
    const generation = ++this.#generation;
    this.#publish({ status: 'checking', ownerId });
    try {
      // Storage denial is not evidence of a fresh, unprotected account.
      const protectedBefore = isProtectedPortfolioOwner(ownerId, this.storage);
      const result = await readPortfolioVault(this.rpc, ownerId);
      if (generation !== this.#generation) return;
      if (result.status === 'sealed') {
        markProtectedPortfolioOwner(ownerId, this.storage);
        this.#publish({ status: 'locked', ownerId });
      } else {
        // Re-read: another tab may have completed enrollment during the request.
        const protectedNow = isProtectedPortfolioOwner(ownerId, this.storage);
        this.#publish({ status: protectedBefore || protectedNow ? 'unavailable' : 'migration-required', ownerId });
      }
    } catch {
      // No exception details, descriptor, record or account data in public state.
      if (generation === this.#generation) this.#publish({ status: 'unavailable', ownerId });
    }
  }
}
