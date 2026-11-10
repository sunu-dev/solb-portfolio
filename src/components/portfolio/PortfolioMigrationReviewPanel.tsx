'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { inspectPortfolioMigrationSources, type MigrationSourceReview } from '@/lib/portfolioVaultMigrationSources';
import styles from './PortfolioVaultBoundary.module.css';
import ui from '../ui/AppUI.module.css';

function explanation(review: MigrationSourceReview): string {
  if (review.status === 'ready') return '기기와 서버의 투자 기록이 일치해요. 기록 비교를 마쳤으며, 암호화 전환은 아직 실행하지 않았어요.';
  if (review.status === 'conflict') return '기기와 서버에 서로 다른 기록이 있어요. 어느 기록을 옮길지 확인해야 해요. 두 기록 모두 그대로 두었어요.';
  switch (review.reason) {
    case 'unowned_source': case 'different_owner': case 'invalid_owner':
      return '현재 계정의 기록인지 확인할 수 없는 자료가 있어요. 다른 계정에 합치지 않고 그대로 두었어요.';
    case 'additional_sources':
      return '따로 저장된 복구본이나 메모가 있어요. 이 자료도 빠짐없이 옮길 수 있도록 확인이 필요해요. 원본은 그대로 두었어요.';
    case 'source_changed':
      return '확인하는 동안 기록이 바뀌었어요. 다른 탭의 편집을 마친 뒤 다시 확인해주세요.';
    case 'missing_private_state':
      return '서버 기록은 확인했지만 기기에만 저장한 설정과 기록을 찾지 못했어요. 이전에 사용하던 브라우저에서 확인해주세요.';
    case 'no_sources':
      return '옮길 투자 기록을 찾지 못했어요. 아직 새 보관함을 만들지는 않았어요.';
    case 'cloud_unavailable':
      return '서버 기록을 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.';
    case 'storage_unavailable':
      return '이 브라우저의 저장된 기록을 읽지 못했어요. 브라우저의 사이트 데이터 설정을 확인해주세요.';
    default:
      return '현재 방식으로 모두 옮길 수 없는 기록이 있어요. 내용을 바꾸거나 삭제하지 않고 전환을 멈췄어요.';
  }
}

/** Read-only preflight. A successful comparison never enrolls an account. */
export default function PortfolioMigrationReviewPanel({ ownerId }: { ownerId: string }) {
  const live = useRef(false);
  const busy = useRef(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function inspect() {
    if (busy.current) return;
    busy.current = true; setChecking(true); setMessage(null);
    try {
      const result = await inspectPortfolioMigrationSources(ownerId, localStorage, async () => {
        const { data, error } = await supabase.from('user_portfolios')
          .select('user_id, stocks, daily_snapshots, portfolio_history, updated_at, settings')
          .eq('user_id', ownerId).maybeSingle();
        if (error) throw new Error('cloud_unavailable');
        if (!data) return null;
        return { ownerId: data.user_id, updatedAt: data.updated_at, settings: data.settings,
          payload: { stocks: data.stocks, snapshots: data.daily_snapshots, history: data.portfolio_history } };
      });
      if (live.current) setMessage(explanation(result.review));
    } catch {
      if (live.current) setMessage('저장된 기록을 확인하지 못했어요. 원본은 그대로 두었어요. 다시 시도해주세요.');
    } finally {
      busy.current = false;
      if (live.current) setChecking(false);
    }
  }
  return <section aria-label="기존 기록 확인">
    <button type="button" className={ui.secondaryButton} disabled={checking} onClick={() => void inspect()}>
      {checking ? '기록 확인 중' : '기존 기록 확인하기'}
    </button>
    <p className={styles.description} role="status" aria-live="polite">
      {checking ? '이 브라우저와 서버의 기록을 비교하고 있어요.' : message ?? '먼저 저장된 기록을 비교해요. 확인만으로 기록을 옮기거나 삭제하지 않아요.'}
    </p>
  </section>;
}
