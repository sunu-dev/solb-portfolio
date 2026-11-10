'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioSync } from '@/hooks/usePortfolioSync';
import { usePortfolioStore } from '@/store/portfolioStore';
import { preparePortfolioIdentity, type LocalPortfolio } from '@/lib/portfolioIdentity';
import { clearUserStorage } from '@/lib/userStorage';
import AccountAccessStatus from '@/components/auth/AccountAccessStatus';
import AccountEntryGate from '@/components/auth/AccountEntryGate';

// Keep the primary account data loading alongside access checks, without
// mounting quote polling, telemetry or other workspace effects.
function PortfolioSync({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  usePortfolioSync(user);
  return null;
}

export default function Home() {
  const auth = useAuth();
  const [Workspace, setWorkspace] = useState<typeof import('./HomeContent').default | null>(null);
  const [workspaceError, setWorkspaceError] = useState(false);
  // Start the chunk download alongside auth, without a second Suspense reveal
  // delay after access checks have already completed.
  useEffect(() => {
    let active = true;
    void import('./HomeContent').then(module => {
      if (active) setWorkspace(() => module.default);
    }).catch(() => { if (active) setWorkspaceError(true); });
    return () => { active = false; };
  }, []);
  const identity = auth.user?.id ?? null;
  const [prepared, setPrepared] = useState<{ identity: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (auth.loading || auth.error) return;
    let done = false;
    const prepare = () => {
      if (done) return;
      done = true;
      try {
        const store = usePortfolioStore.getState();
        const persisted = usePortfolioStore.persist.getOptions().partialize!(store) as LocalPortfolio;
        preparePortfolioIdentity(identity, persisted, localStorage, () => {
          // OAuth consent belongs to the in-progress login, not the legacy portfolio.
          clearUserStorage({ preservePendingConsent: true, preserveGuestDiscovery: identity === null && !persisted.portfolioOwnerId });
          store.resetPortfolio();
        }, portfolioOwnerId => usePortfolioStore.setState({ portfolioOwnerId }));
        setFailed(false);
        setPrepared({ identity });
      } catch {
        setFailed(true);
      }
    };
    const unsubscribe = usePortfolioStore.persist.onFinishHydration(prepare);
    if (usePortfolioStore.persist.hasHydrated()) prepare();
    return unsubscribe;
  }, [auth.loading, auth.error, identity]);

  // Do not mount portfolio readers, quote requests or cloud sync before this boundary.
  if (failed || auth.error || auth.loading || !prepared || prepared.identity !== identity || workspaceError) {
    return <AccountAccessStatus phase={failed || workspaceError ? undefined : 'session'} error={failed || auth.error || workspaceError} onRetry={auth.error || workspaceError ? auth.retry : undefined} message={failed
      ? '이전 기록을 안전하게 보관하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요.'
      : undefined} />;
  }
  const content = Workspace ? <Workspace key={identity ?? 'guest'} auth={auth} /> : <AccountAccessStatus />;
  return <><PortfolioSync key={identity ?? 'guest'} user={auth.user} />{auth.user ? <AccountEntryGate key={auth.user.id} user={auth.user} onSignOut={auth.signOut} onSwitchAccount={auth.switchAccount}>{content}</AccountEntryGate> : content}</>;
}
