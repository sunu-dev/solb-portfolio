'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { supabase } from '@/lib/supabase';
import { PortfolioVaultAccess, type PortfolioVaultAccessView } from '@/lib/portfolioVaultAccess';
import { createPortfolioVaultRuntime } from '@/lib/portfolioVaultStore';
import { finishPortfolioVaultHandoff } from '@/lib/portfolioVaultHandoff';
import { hasLegacyPortfolioSources, hasPrivatePortfolioInMemory } from '@/lib/portfolioVaultEntry';
import { markProtectedPortfolioOwner } from '@/lib/portfolioVaultPolicy';
import type { PortfolioVaultRuntime, PortfolioVaultRuntimeView } from '@/lib/portfolioVaultRuntime';
import type { PortfolioVaultRpc } from '@/lib/portfolioVaultSync';
import ui from '../ui/AppUI.module.css';
import styles from './PortfolioVaultBoundary.module.css';
import PortfolioMigrationReviewPanel from './PortfolioMigrationReviewPanel';

const rpc: PortfolioVaultRpc = (name, args) => supabase.rpc(name, args);
const readable = (view: PortfolioVaultRuntimeView | null) => !!view && !view.closing && !view.localError
  && ['ready', 'pending', 'saving', 'unsynced', 'conflict'].includes(view.status);

/** Flagged fresh-device, read-only surface. Do not mount the legacy homepage:
 * its quote caches, settings and notification side effects are not vault-safe.
 */
export default function PortfolioVaultBoundary({ ownerId }: { ownerId: string }) {
  const access = useRef<PortfolioVaultAccess | null>(null);
  const runtime = useRef<PortfolioVaultRuntime | null>(null);
  const busy = useRef(false);
  const live = useRef(false);
  const unsubscribeRuntime = useRef<(() => void) | null>(null);
  const [entry, setEntry] = useState<PortfolioVaultAccessView>({ status: 'idle' });
  const [view, setView] = useState<PortfolioVaultRuntimeView | null>(null);
  const [localSources, setLocalSources] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    live.current = true;
    let cancelled = false;
    let unsubscribe = () => {};
    const prepare = () => {
      if (cancelled) return;
      try {
        if (hasLegacyPortfolioSources(localStorage) || hasPrivatePortfolioInMemory(usePortfolioStore.getState())) {
          setLocalSources(true); return;
        }
        const gate = new PortfolioVaultAccess(rpc, localStorage);
        access.current = gate;
        unsubscribe = gate.subscribe(() => setEntry(gate.getSnapshot()));
        void gate.check(ownerId);
      } catch { setError(true); }
    };
    const hydration = usePortfolioStore.persist.onFinishHydration(prepare);
    if (usePortfolioStore.persist.hasHydrated()) prepare();
    return () => {
      cancelled = true; live.current = false;
      hydration(); unsubscribe(); access.current?.reset(); access.current = null;
      unsubscribeRuntime.current?.();
      // Shared with useAuth; never lock before accepted edits are durable.
      if (runtime.current) void finishPortfolioVaultHandoff(ownerId).catch(() => {
        // Failed handoff stays registered with its private in-memory edit.
      });
    };
  }, [ownerId]);

  async function open() {
    if (busy.current || entry.status !== 'locked') return;
    busy.current = true; setError(false);
    try {
      if (!runtime.current) {
        if (hasLegacyPortfolioSources(localStorage) || hasPrivatePortfolioInMemory(usePortfolioStore.getState())) {
          setLocalSources(true); return;
        }
        markProtectedPortfolioOwner(ownerId);
        usePortfolioStore.setState({ portfolioOwnerId: ownerId, portfolioProtectionStatus: 'locked' });
        const next = createPortfolioVaultRuntime(ownerId, rpc, true);
        runtime.current = next;
        unsubscribeRuntime.current = next.subscribe(() => {
          if (live.current) setView(next.getSnapshot());
        });
      }
      await runtime.current.open();
    } catch { if (live.current) setError(true); }
    finally { busy.current = false; }
  }

  async function lock() {
    if (busy.current) return;
    busy.current = true;
    try {
      await finishPortfolioVaultHandoff(ownerId);
      unsubscribeRuntime.current?.(); unsubscribeRuntime.current = null; runtime.current = null;
      if (live.current) { setView(null); setError(false); }
    } catch { if (live.current) setError(true); }
    finally { busy.current = false; }
  }

  const opened = readable(view);
  const opening = view?.status === 'opening' || view?.closing;
  const migration = localSources || entry.status === 'migration-required';
  const failed = error || entry.status === 'unavailable';
  const title = opened ? '내 투자 기록' : migration ? '기존 기록을 먼저 확인해야 해요'
    : failed ? '기록을 열지 못했어요' : opening ? '잠금을 해제하고 있어요'
      : entry.status === 'locked' ? '내 투자 기록 잠금 해제' : '기록 보관 방식을 확인하고 있어요';

  return <main className={styles.page}><section className={styles.content} aria-labelledby="vault-title">
    <p className={styles.brand}>주비</p>
    <h1 id="vault-title" className={styles.title}>{title}</h1>
    <p className={styles.description} role={failed ? 'alert' : 'status'}>
      {opened ? '암호화 보관 미리보기예요. 지금은 종목과 수량만 확인할 수 있어요.'
        : migration ? '이 브라우저나 계정에 기존 방식으로 보관한 기록이 있어요. 안전하게 옮기는 기능을 준비 중이에요. 기존 기록은 그대로 두었어요.'
          : failed ? '패스키 사용과 연결 상태를 확인한 뒤 다시 시도해주세요. 기록을 일반 저장으로 바꾸지는 않아요.'
            : entry.status === 'locked' || opening ? '기록을 보관할 때 등록한 패스키로 열어주세요. 기기의 지문·얼굴 인식 또는 화면 잠금을 사용할 수 있어요.'
              : '확인이 끝날 때까지 투자 기록은 불러오지 않아요.'}
    </p>
    {opened && <PrivateHoldings />}
    {migration && <PortfolioMigrationReviewPanel key={ownerId} ownerId={ownerId} />}
    {opened && view?.status === 'conflict' && <p className={styles.hint}>이 기기와 서버의 기록이 달라요. 지금은 이 기기에 남은 기록을 보여줘요. 어느 기록을 보관할지 선택하는 기능을 준비 중이에요.</p>}
    {opened && ['pending', 'unsynced'].includes(view!.status) && <p className={styles.hint}>이 기기에 서버로 보내지 않은 변경이 있어요. 읽기 전용 화면에서는 서버 기록을 바꾸지 않아요.</p>}
    <div className={styles.actions}>
      {opened ? <button className={ui.primaryButton} type="button" onClick={() => void lock()}>기록 잠그기</button>
        : !migration && entry.status === 'locked' && <button className={ui.accentButton} type="button" disabled={!!opening} onClick={() => void open()}>
          {opening ? '잠금 해제 중' : '패스키로 잠금 해제'}
        </button>}
      {!migration && failed && entry.status !== 'locked' && <button className={ui.secondaryButton} type="button" onClick={() => {
        setError(false);
        if (access.current) void access.current.check(ownerId);
        else window.location.reload();
      }}>다시 확인하기</button>}
      <Link className={ui.textButton} href="/help#privacy">보관 방식 알아보기</Link>
    </div>
    <p className={styles.hint}>카카오 로그인은 계정을 확인하고, 패스키는 암호화한 기록을 여는 데 사용해요. 패스키를 잃으면 카카오 로그인만으로 기록을 복구할 수 없어요.</p>
  </section></main>;
}

function PrivateHoldings() {
  const stocks = usePortfolioStore(useShallow(state => state.stocks));
  return <>{(['investing', 'watching', 'sold'] as const).map(category => <section key={category}>
    <h2 className={styles.heading}>{{ investing: '보유 종목', watching: '관심 종목', sold: '매도한 종목' }[category]}</h2>
    {stocks[category].length === 0 ? <p className={styles.description}>등록한 종목이 없어요.</p>
      : <ul className={styles.list}>{stocks[category].map((stock, index) => <li className={styles.row} key={`${stock.symbol}-${index}`}>
        <strong>{stock.symbol}</strong><span>{stock.shares.toLocaleString('ko-KR')}주</span>
      </li>)}</ul>}
  </section>)}</>;
}
