'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { loadPortfolio, savePortfolioToDB } from '@/lib/portfolioSync';
import type { User } from '@supabase/supabase-js';

export function usePortfolioSync(user: User | null) {
  const { stocks, dailySnapshots, setStocksFromDB, setSnapshotsFromDB } = usePortfolioStore();
  const lastSyncRef = useRef<string>('');
  const initialLoadDone = useRef(false);

  // Load from DB on login — 정합성 결함 C1 수정:
  // initialLoadDone는 DB 응답 후에만 true로 (응답 전엔 save effect도 차단)
  // loadPortfolio는 명시적 status 반환 → error일 때 save 절대 호출 금지
  useEffect(() => {
    if (!user || initialLoadDone.current) return;
    let cancelled = false;

    loadPortfolio(user.id).then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        // DB에 데이터 있음 → DB를 소스로 사용 (snapshots 포함)
        setStocksFromDB(result.stocks);
        if (result.dailySnapshots.length > 0) {
          setSnapshotsFromDB(result.dailySnapshots);
        }
        lastSyncRef.current = JSON.stringify({
          stocks: result.stocks,
          snaps: result.dailySnapshots,
        });
        initialLoadDone.current = true;
      } else if (result.status === 'empty') {
        // 첫 로그인, DB row 없음 → 현재 localStorage 데이터를 DB에 저장
        savePortfolioToDB(user.id, stocks, dailySnapshots);
        lastSyncRef.current = JSON.stringify({ stocks, snaps: dailySnapshots });
        initialLoadDone.current = true;
      } else {
        console.warn('[portfolioSync] DB load 실패 — save 보류:', result.error);
      }
    });

    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // pending save 추적 — 탭 종료 시 즉시 flush 하기 위함
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPayloadRef = useRef<{ stocks: typeof stocks; snaps: typeof dailySnapshots } | null>(null);

  // stocks/snapshots 변경 시 DB에 저장 (디바운스)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;

    const currentStr = JSON.stringify({ stocks, snaps: dailySnapshots });
    if (currentStr === lastSyncRef.current) return;
    lastSyncRef.current = currentStr;
    pendingPayloadRef.current = { stocks, snaps: dailySnapshots };

    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      savePortfolioToDB(user.id, stocks, dailySnapshots);
      pendingTimerRef.current = null;
      pendingPayloadRef.current = null;
    }, 2000);

    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [user, stocks, dailySnapshots]);

  // 정합성 결함 M4-data — 디바운스 2초 사이 탭 종료/숨김 시 즉시 flush
  useEffect(() => {
    if (!user) return;

    const flushPending = () => {
      if (pendingPayloadRef.current) {
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        const { stocks: s, snaps } = pendingPayloadRef.current;
        savePortfolioToDB(user.id, s, snaps);
        pendingTimerRef.current = null;
        pendingPayloadRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };

    window.addEventListener('beforeunload', flushPending);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('beforeunload', flushPending);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  // 로그아웃 시 초기화
  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      lastSyncRef.current = '';
    }
  }, [user]);
}
