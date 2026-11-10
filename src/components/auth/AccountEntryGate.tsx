'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { currentInviteAccess, resolveInviteAccess, type InviteCheck } from '@/lib/inviteAccess';
import AgeEligibilityGate from './AgeEligibilityGate';
import InviteGate from './InviteGate';
import AccountAccessStatus from './AccountAccessStatus';

/** Check access before mounting quote polling and usage writers.
 * Invitation and consent still run concurrently. Children never mount on error.
 */
export default function AccountEntryGate({ user, onSignOut, onSwitchAccount, children }: {
  user: User; onSignOut: () => void; onSwitchAccount: () => void; children: ReactNode;
}) {
  const [check, setCheck] = useState<InviteCheck | null>(null);
  const [attempt, setAttempt] = useState(0);
  const status = currentInviteAccess(user.id, check);

  useEffect(() => {
    let active = true;
    void resolveInviteAccess(supabase, user.id).then(status => {
      if (active) setCheck({ userId: user.id, status });
    });
    return () => { active = false; };
  }, [user.id, attempt]);

  return <AgeEligibilityGate userId={user.id} onSignOut={onSignOut}>
    {status === 'allowed' ? children : status === 'required'
      ? <InviteGate user={user} onVerified={() => setCheck({ userId: user.id, status: 'allowed' })} />
      : <AccountAccessStatus phase="invite" error={status === 'error'} onRetry={() => {
        setCheck(null);
        setAttempt(value => value + 1);
      }} onSwitchAccount={onSwitchAccount} />}
  </AgeEligibilityGate>;
}
