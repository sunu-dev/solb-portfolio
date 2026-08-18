'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { loadPortfolio, savePortfolioToDB } from '@/lib/portfolioSync';
import { logApiCall } from '@/lib/apiLogger';
import {
  choosePortfolioRecovery,
  clearPortfolioSyncOutbox,
  mergeLocalChoiceWithRemote,
  portfolioSyncPayloadSignature,
  readPortfolioSyncOutbox,
  rebasePortfolioSyncOutbox,
  writePortfolioSyncOutbox,
  type PortfolioSyncPayload,
} from '@/lib/portfolioSyncOutbox';
import type { User } from '@supabase/supabase-js';

interface PendingPortfolioSave extends PortfolioSyncPayload {
  userId: string;
}

export function usePortfolioSync(user: User | null) {
  const stocks = usePortfolioStore((state) => state.stocks);
  const dailySnapshots = usePortfolioStore((state) => state.dailySnapshots);
  const portfolioImportHistory = usePortfolioStore((state) => state.portfolioImportHistory);
  const dbPortfolioStatus = usePortfolioStore((state) => state.dbPortfolioStatus);
  const setStocksFromDB = usePortfolioStore((state) => state.setStocksFromDB);
  const setSnapshotsFromDB = usePortfolioStore((state) => state.setSnapshotsFromDB);
  const setPortfolioHistoryFromDB = usePortfolioStore((state) => state.setPortfolioHistoryFromDB);
  const setDbPortfolioStatus = usePortfolioStore((state) => state.setDbPortfolioStatus);
  const setPortfolioSyncStatus = usePortfolioStore((state) => state.setPortfolioSyncStatus);
  const setPortfolioCloudLoadStatus = usePortfolioStore((state) => state.setPortfolioCloudLoadStatus);

  const loadedUserIdRef = useRef<string | null>(null);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const lastSyncRef = useRef('');
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<PendingPortfolioSave | null>(null);
  const saveInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const serverUpdatedAtRef = useRef<string | null | undefined>(undefined);
  const syncConflictRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const outboxStorageFailedRef = useRef(false);

  const flushPending = useCallback(async () => {
    if (saveInFlightRef.current) return;
    const pending = pendingPayloadRef.current;
    if (!pending) return;
    // 계정 전환 뒤에는 이전 사용자 payload를 현재 auth.uid()로 절대 전송하지 않는다.
    // Supabase CAS RPC는 전달 userId가 아니라 auth.uid()를 사용하므로 owner mismatch는
    // 충돌 여부와 무관하게 여기서 격리해야 한다. payload는 사용자별 durable outbox에 남는다.
    if (activeUserIdRef.current !== pending.userId) {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      pendingPayloadRef.current = null;
      void logApiCall('portfolio_cloud_sync_quarantined', undefined, {
        reason: 'account_changed',
      }, pending.userId);
      return;
    }
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
    pendingPayloadRef.current = null;
    saveInFlightRef.current = true;
    if (activeUserIdRef.current === pending.userId) {
      setPortfolioSyncStatus('saving');
    }

    let result: Awaited<ReturnType<typeof savePortfolioToDB>>;
    try {
      result = await savePortfolioToDB(
        pending.userId,
        pending.stocks,
        pending.snapshots,
        pending.history,
        serverUpdatedAtRef.current,
      );
    } catch {
      result = { status: 'error', error: 'network_error' };
    } finally {
      saveInFlightRef.current = false;
    }

    if (result.status === 'ok') {
      outboxStorageFailedRef.current = false;
      const stillActive = activeUserIdRef.current === pending.userId;
      const cleared = clearPortfolioSyncOutbox(pending.userId, pending);
      if (!cleared) {
        // 저장 중 생긴 더 최신 변경은 남겨두되, 다음 재시작에서 불필요한 충돌이
        // 나지 않도록 방금 성공한 서버 revision을 새 기준으로 승급한다.
        rebasePortfolioSyncOutbox(pending.userId, result.updatedAt);
      }
      if (!stillActive) return;

      serverUpdatedAtRef.current = result.updatedAt;
      lastSyncRef.current = portfolioSyncPayloadSignature(pending);
      retryCountRef.current = 0;
      setPortfolioSyncStatus(
        result.portfolioHistorySaved ? 'synced' : 'local-only',
      );
      void logApiCall('portfolio_cloud_synced', undefined, {
        historySaved: result.portfolioHistorySaved,
        snapshotsSaved: result.dailySnapshotsSaved,
        historyCount: pending.history.length,
      }, pending.userId);

      // 저장 중 더 최신 변경이 들어왔으면 이어서 보낸다.
      if (pendingPayloadRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          window.dispatchEvent(new CustomEvent('solb-portfolio-sync-retry'));
        }, 0);
      }
      return;
    }

    if (result.status === 'conflict') {
      if (activeUserIdRef.current === pending.userId) {
        if (!pendingPayloadRef.current) pendingPayloadRef.current = pending;
        syncConflictRef.current = true;
        setPortfolioSyncStatus('conflict');
        void logApiCall('portfolio_cloud_sync_conflict', undefined, {
          hasRemoteRevision: !!result.remoteUpdatedAt,
        }, pending.userId);
      }
      return;
    }

    // 더 최신 payload가 없다면 실패한 payload를 보존한다. 2·4·8…30초 백오프로 재시도한다.
    if (activeUserIdRef.current !== pending.userId) {
      void logApiCall('portfolio_cloud_sync_failed', undefined, {
        retryCount: 0,
        accountChanged: true,
      }, pending.userId);
      return;
    }
    if (!pendingPayloadRef.current) {
      pendingPayloadRef.current = pending;
    }
    retryCountRef.current += 1;
    setPortfolioSyncStatus(
      outboxStorageFailedRef.current ? 'storage-error' : 'error',
    );
    void logApiCall('portfolio_cloud_sync_failed', undefined, {
      retryCount: retryCountRef.current,
    }, pending.userId);
    if (pendingPayloadRef.current) {
      const delay = Math.min(30_000, 2_000 * (2 ** (retryCountRef.current - 1)));
      pendingTimerRef.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('solb-portfolio-sync-retry'));
      }, delay);
    }
  }, [setPortfolioSyncStatus]);

  useEffect(() => {
    const retry = () => {
      void flushPending();
    };
    window.addEventListener('solb-portfolio-sync-retry', retry);
    return () => window.removeEventListener('solb-portfolio-sync-retry', retry);
  }, [flushPending]);

  useEffect(() => {
    const stopForUserDataClear = () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
      pendingPayloadRef.current = null;
      loadedUserIdRef.current = null;
      serverUpdatedAtRef.current = undefined;
      syncConflictRef.current = false;
      retryCountRef.current = 0;
    };
    window.addEventListener('solb-user-storage-clearing', stopForUserDataClear);
    return () => {
      window.removeEventListener('solb-user-storage-clearing', stopForUserDataClear);
    };
  }, []);

  // React effect가 실행되기 전 탭이 종료되는 아주 짧은 창도 막는다.
  // Zustand mutation 직후 같은 호출 스택에서 사용자별 outbox를 먼저 기록한다.
  useEffect(() => usePortfolioStore.subscribe((state, previous) => {
    if (applyingRemoteRef.current
      || (state.stocks === previous.stocks
        && state.dailySnapshots === previous.dailySnapshots
        && state.portfolioImportHistory === previous.portfolioImportHistory)) {
      return;
    }
    const userId = activeUserIdRef.current;
    if (!userId
      || loadedUserIdRef.current !== userId
      || serverUpdatedAtRef.current === undefined
      || state.dbPortfolioStatus === 'unknown'
      || state.portfolioCloudLoadStatus !== 'ready') {
      return;
    }

    const payload: PortfolioSyncPayload = {
      stocks: state.stocks,
      snapshots: state.dailySnapshots,
      history: state.portfolioImportHistory,
    };
    const existing = readPortfolioSyncOutbox(userId);
    const persisted = writePortfolioSyncOutbox(
      userId,
      payload,
      existing?.baseUpdatedAt ?? serverUpdatedAtRef.current ?? null,
    );
    pendingPayloadRef.current = { userId, ...payload };
    if (!persisted) {
      outboxStorageFailedRef.current = true;
      setPortfolioSyncStatus('storage-error');
      void flushPending();
      return;
    }
    outboxStorageFailedRef.current = false;
    setPortfolioSyncStatus(syncConflictRef.current ? 'conflict' : 'saving');
  }), [flushPending, setPortfolioSyncStatus]);

  // 사용자 ID가 바뀔 때마다 반드시 새로 로드한다. 이전 구현의 단일 boolean ref는
  // A→B 직접 계정 전환에서 B의 로드를 건너뛸 수 있었다.
  useEffect(() => {
    const userId = user?.id ?? null;
    const detachedPending = pendingPayloadRef.current;
    if (detachedPending?.userId && detachedPending.userId !== userId) {
      // 세션이 바뀐 뒤 이전 사용자의 RPC를 호출하면 auth.uid()가 새 사용자로 평가될 수 있다.
      // 전송하지 않고 이전 사용자 전용 outbox에 격리해 다음 로그인 때 복구한다.
      writePortfolioSyncOutbox(
        detachedPending.userId,
        detachedPending,
        serverUpdatedAtRef.current ?? null,
      );
      pendingPayloadRef.current = null;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    activeUserIdRef.current = userId;

    loadedUserIdRef.current = null;
    lastSyncRef.current = '';
    serverUpdatedAtRef.current = undefined;
    syncConflictRef.current = false;
    outboxStorageFailedRef.current = false;
    retryCountRef.current = 0;
    setDbPortfolioStatus('unknown');
    setPortfolioSyncStatus('idle');
    setPortfolioCloudLoadStatus(userId ? 'loading' : 'guest');
    if (!userId) return;

    const localAtLoadStart: PortfolioSyncPayload = {
      stocks: usePortfolioStore.getState().stocks,
      snapshots: usePortfolioStore.getState().dailySnapshots,
      history: usePortfolioStore.getState().portfolioImportHistory,
    };
    const localAtLoadStartSignature = portfolioSyncPayloadSignature(localAtLoadStart);
    let cancelled = false;
    void loadPortfolio(userId).then((result) => {
      if (cancelled || activeUserIdRef.current !== userId) return;

      if (result.status === 'ok') {
        const currentHistory = result.portfolioHistory
          ?? usePortfolioStore.getState().portfolioImportHistory;
        const remotePayload: PortfolioSyncPayload = {
          stocks: result.stocks,
          snapshots: result.dailySnapshots,
          history: currentHistory,
        };
        let outbox = readPortfolioSyncOutbox(userId);
        const currentLocal: PortfolioSyncPayload = {
          stocks: usePortfolioStore.getState().stocks,
          snapshots: usePortfolioStore.getState().dailySnapshots,
          history: usePortfolioStore.getState().portfolioImportHistory,
        };
        if (!outbox
          && portfolioSyncPayloadSignature(currentLocal) !== localAtLoadStartSignature) {
          outbox = writePortfolioSyncOutbox(
            userId,
            currentLocal,
            result.updatedAt,
          );
        }

        const recovery = choosePortfolioRecovery(
          outbox,
          result.updatedAt,
          remotePayload,
        );
        const selectedPayload = recovery === 'remote'
          ? remotePayload
          : outbox?.payload ?? remotePayload;
        setStocksFromDB(selectedPayload.stocks);
        setSnapshotsFromDB(selectedPayload.snapshots);
        setPortfolioHistoryFromDB(selectedPayload.history);
        setDbPortfolioStatus('ok');
        setPortfolioCloudLoadStatus('ready');
        serverUpdatedAtRef.current = result.updatedAt;
        lastSyncRef.current = portfolioSyncPayloadSignature(remotePayload);
        loadedUserIdRef.current = userId;
        if (recovery === 'remote') {
          clearPortfolioSyncOutbox(userId);
          setPortfolioSyncStatus(
            result.portfolioHistory === undefined ? 'local-only' : 'synced',
          );
        } else if (recovery === 'outbox') {
          setPortfolioSyncStatus('saving');
        } else {
          syncConflictRef.current = true;
          setPortfolioSyncStatus('conflict');
        }
        return;
      }

      if (result.status === 'empty') {
        const remotePayload: PortfolioSyncPayload = {
          stocks: { investing: [], watching: [], sold: [] },
          snapshots: [],
          history: [],
        };
        let outbox = readPortfolioSyncOutbox(userId);
        const currentLocal: PortfolioSyncPayload = {
          stocks: usePortfolioStore.getState().stocks,
          snapshots: usePortfolioStore.getState().dailySnapshots,
          history: usePortfolioStore.getState().portfolioImportHistory,
        };
        if (!outbox
          && portfolioSyncPayloadSignature(currentLocal) !== localAtLoadStartSignature) {
          outbox = writePortfolioSyncOutbox(userId, currentLocal, null);
        }
        const recovery = choosePortfolioRecovery(outbox, null, remotePayload);
        if (outbox && recovery !== 'remote') {
          setStocksFromDB(outbox.payload.stocks);
          setSnapshotsFromDB(outbox.payload.snapshots);
          setPortfolioHistoryFromDB(outbox.payload.history);
        }
        setDbPortfolioStatus('empty');
        setPortfolioCloudLoadStatus('ready');
        serverUpdatedAtRef.current = null;
        lastSyncRef.current = portfolioSyncPayloadSignature(remotePayload);
        loadedUserIdRef.current = userId;
        if (recovery === 'remote') {
          clearPortfolioSyncOutbox(userId);
          setPortfolioSyncStatus('synced');
        } else if (recovery === 'outbox') {
          setPortfolioSyncStatus('saving');
        } else {
          syncConflictRef.current = true;
          setPortfolioSyncStatus('conflict');
        }
        return;
      }

      console.warn('[portfolioSync] DB load 실패 — save 보류:', result.error);
      setPortfolioSyncStatus('error');
      setPortfolioCloudLoadStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [
    setDbPortfolioStatus,
    setPortfolioHistoryFromDB,
    setPortfolioCloudLoadStatus,
    setSnapshotsFromDB,
    setStocksFromDB,
    setPortfolioSyncStatus,
    user?.id,
  ]);

  // CAS 충돌은 새로고침으로 숨기지 않는다. 로컬 outbox를 보존한 채 사용자가
  // 클라우드 최신본 또는 이 기기 변경 중 하나를 명시적으로 선택했을 때만 해소한다.
  useEffect(() => {
    const resolveConflict = async (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ strategy?: 'cloud' | 'local' }>;
      const strategy = event.detail?.strategy;
      const userId = activeUserIdRef.current;
      if (!userId || !syncConflictRef.current
        || (strategy !== 'cloud' && strategy !== 'local')) {
        return;
      }

      const outbox = readPortfolioSyncOutbox(userId);
      if (!outbox) {
        setPortfolioSyncStatus('error');
        return;
      }

      setPortfolioSyncStatus('saving');
      const latest = await loadPortfolio(userId);
      if (activeUserIdRef.current !== userId) return;
      if (latest.status === 'error') {
        setPortfolioSyncStatus('conflict');
        return;
      }

      const remotePayload: PortfolioSyncPayload = latest.status === 'ok'
        ? {
            stocks: latest.stocks,
            snapshots: latest.dailySnapshots,
            history: latest.portfolioHistory
              ?? usePortfolioStore.getState().portfolioImportHistory,
          }
        : {
            stocks: { investing: [], watching: [], sold: [] },
            snapshots: [],
            history: [],
          };
      const remoteUpdatedAt = latest.status === 'ok' ? latest.updatedAt : null;

      serverUpdatedAtRef.current = remoteUpdatedAt;
      lastSyncRef.current = portfolioSyncPayloadSignature(remotePayload);
      setDbPortfolioStatus(latest.status === 'ok' ? 'ok' : 'empty');
      setPortfolioCloudLoadStatus('ready');
      syncConflictRef.current = false;

      if (strategy === 'cloud') {
        pendingPayloadRef.current = null;
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
        applyingRemoteRef.current = true;
        try {
          setStocksFromDB(remotePayload.stocks);
          setSnapshotsFromDB(remotePayload.snapshots);
          setPortfolioHistoryFromDB(remotePayload.history);
        } finally {
          applyingRemoteRef.current = false;
        }
        clearPortfolioSyncOutbox(userId);
        setPortfolioSyncStatus(
          latest.status === 'ok' && latest.portfolioHistory === undefined
            ? 'local-only'
            : 'synced',
        );
        return;
      }

      // 사용자가 로컬 변경을 선택해도 원격 종목은 복구 지점으로, 스냅샷·이력은
      // 합쳐서 남긴다. 최신 remote revision을 새 CAS 기준으로 다시 저장한다.
      const latestOutbox = readPortfolioSyncOutbox(userId) ?? outbox;
      const merged = mergeLocalChoiceWithRemote(
        latestOutbox.payload,
        remotePayload,
      );
      applyingRemoteRef.current = true;
      try {
        setStocksFromDB(merged.stocks);
        setSnapshotsFromDB(merged.snapshots);
        setPortfolioHistoryFromDB(merged.history);
      } finally {
        applyingRemoteRef.current = false;
      }
      const persisted = writePortfolioSyncOutbox(
        userId,
        merged,
        remoteUpdatedAt,
      );
      outboxStorageFailedRef.current = !persisted;
      pendingPayloadRef.current = {
        userId,
        ...merged,
      };
      await flushPending();
    };

    window.addEventListener('solb-portfolio-resolve-conflict', resolveConflict);
    return () => {
      window.removeEventListener('solb-portfolio-resolve-conflict', resolveConflict);
    };
  }, [
    flushPending,
    setDbPortfolioStatus,
    setPortfolioCloudLoadStatus,
    setPortfolioHistoryFromDB,
    setPortfolioSyncStatus,
    setSnapshotsFromDB,
    setStocksFromDB,
  ]);

  // 포트폴리오·스냅샷·복구 기록을 같은 payload로 저장해 서로 다른 시점이 섞이지 않게 한다.
  useEffect(() => {
    const userId = user?.id;
    if (!userId
      || loadedUserIdRef.current !== userId
      || dbPortfolioStatus === 'unknown') {
      return;
    }

    const current: PortfolioSyncPayload = {
      stocks,
      snapshots: dailySnapshots,
      history: portfolioImportHistory,
    };
    const currentStr = portfolioSyncPayloadSignature(current);

    if (syncConflictRef.current) {
      const existingOutbox = readPortfolioSyncOutbox(userId);
      writePortfolioSyncOutbox(
        userId,
        current,
        existingOutbox?.baseUpdatedAt ?? serverUpdatedAtRef.current ?? null,
      );
      pendingPayloadRef.current = { userId, ...current };
      setPortfolioSyncStatus('conflict');
      return;
    }

    if (currentStr === lastSyncRef.current) return;

    const pending: PendingPortfolioSave = {
      userId,
      stocks,
      snapshots: dailySnapshots,
      history: portfolioImportHistory,
    };
    // 네트워크 디바운스보다 먼저 동기식 outbox를 남겨 탭 종료·크래시 후에도 복구한다.
    const persisted = writePortfolioSyncOutbox(
      userId,
      pending,
      serverUpdatedAtRef.current ?? null,
    );
    pendingPayloadRef.current = pending;
    if (!persisted) {
      outboxStorageFailedRef.current = true;
      setPortfolioSyncStatus('storage-error');
      void flushPending();
      return;
    }
    outboxStorageFailedRef.current = false;
    setPortfolioSyncStatus('saving');

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      void flushPending();
    }, 2000);

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [
    dailySnapshots,
    dbPortfolioStatus,
    flushPending,
    portfolioImportHistory,
    setPortfolioSyncStatus,
    stocks,
    user?.id,
  ]);

  // 디바운스 중 탭이 숨겨지거나 닫히면 마지막 완성 payload를 즉시 전송한다.
  useEffect(() => {
    if (!user) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flushPending();
    };

    const onBeforeUnload = () => {
      void flushPending();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushPending, user]);
}
