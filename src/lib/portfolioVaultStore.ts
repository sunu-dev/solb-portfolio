/** Actual Zustand adapter. Activation is explicit; this module has no startup
 * side effects and does not migrate/delete existing local plaintext sources.
 */
import { usePortfolioStore } from '@/store/portfolioStore';
import { PortfolioVaultController } from './portfolioVaultController';
import { PortfolioVaultRuntime, type PortfolioVaultStorePort, type PortfolioVaultRuntimeView } from './portfolioVaultRuntime';
import { assertPortfolioVaultHandoffAvailable, registerPortfolioVaultHandoff } from './portfolioVaultHandoff';
import { markProtectedPortfolioOwner } from './portfolioVaultPolicy';
import type { PortfolioVaultRpc } from './portfolioVaultSync';
import { normalizePortfolioVaultPayload } from './portfolioVaultPayload';

export const portfolioVaultStorePort: PortfolioVaultStorePort = {
  read() {
    const state = usePortfolioStore.getState();
    return { ownerId: state.portfolioOwnerId, payload: {
      stocks: state.stocks, snapshots: state.dailySnapshots, history: state.portfolioImportHistory,
      privateState: { customEvents: state.customEvents, recentSymbols: state.recentSymbols,
        lastImportCheckpoint: state.lastImportCheckpoint, investorType: state.investorType,
        investorTypeSetAt: state.investorTypeSetAt },
    } };
  },
  subscribe: listener => usePortfolioStore.subscribe(listener),
  apply(ownerId, payload) {
    if (usePortfolioStore.getState().portfolioOwnerId !== ownerId || !payload.privateState) throw new Error('portfolio_vault_owner_or_schema_mismatch');
    const copy = normalizePortfolioVaultPayload(payload);
    if (!copy?.privateState) throw new Error('portfolio_vault_invalid_record');
    usePortfolioStore.setState({ stocks: copy.stocks, dailySnapshots: copy.snapshots,
      portfolioImportHistory: copy.history, ...copy.privateState, dbPortfolioStatus: 'ok' });
  },
  status(ownerId, view: PortfolioVaultRuntimeView) {
    if (usePortfolioStore.getState().portfolioOwnerId !== ownerId) return;
    const readable = ['ready', 'pending', 'saving', 'unsynced', 'conflict'].includes(view.status);
    usePortfolioStore.setState({
      portfolioProtectionStatus: view.closing ? 'closing' : view.localError ? 'error'
        : readable ? 'ready' : view.status === 'opening' ? 'opening' : 'locked',
      portfolioCloudLoadStatus: readable && !view.closing ? 'ready' : 'loading',
      portfolioSyncStatus: view.localError ? 'storage-error' : view.localPending ? 'saving'
        : view.status === 'ready' ? 'synced' : view.status === 'conflict' ? 'conflict'
          : view.status === 'unsynced' ? 'error' : readable ? 'saving' : 'idle',
    });
  },
  clear(ownerId) {
    const state = usePortfolioStore.getState();
    if (state.portfolioOwnerId !== ownerId) return;
    state.resetPortfolio();
    usePortfolioStore.setState({ portfolioProtectionStatus: 'locked' });
  },
};

/** Call only after the identity/migration gate has verified this owner and dealt
 * with legacy local copies. Unlock remains a user gesture via runtime.open().
 */
export function createPortfolioVaultRuntime(ownerId: string, rpc: PortfolioVaultRpc, readOnly = false): PortfolioVaultRuntime {
  if (usePortfolioStore.getState().portfolioOwnerId !== ownerId) throw new Error('portfolio_vault_owner_mismatch');
  assertPortfolioVaultHandoffAvailable();
  markProtectedPortfolioOwner(ownerId);
  const runtime = new PortfolioVaultRuntime(ownerId, new PortfolioVaultController(rpc), portfolioVaultStorePort, 2_000, readOnly);
  registerPortfolioVaultHandoff(ownerId, runtime);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!runtime.getSnapshot().localPending) return;
    event.preventDefault(); event.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnload);
  const unsubscribe = runtime.subscribe(() => {
    const view = runtime.getSnapshot();
    if (view.closing && view.status === 'locked' && !view.localPending && !view.localError) {
      window.removeEventListener('beforeunload', beforeUnload); unsubscribe();
    }
  });
  usePortfolioStore.setState({ portfolioProtectionStatus: 'locked', portfolioCloudLoadStatus: 'loading' });
  return runtime;
}
