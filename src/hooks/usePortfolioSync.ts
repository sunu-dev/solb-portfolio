'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { loadPortfolio, savePortfolioToDB } from '@/lib/portfolioSync';
import type { User } from '@supabase/supabase-js';

export function usePortfolioSync(user: User | null) {
  const { stocks, setStocksFromDB } = usePortfolioStore();
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
        // DB에 데이터 있음 → DB를 소스로 사용
        setStocksFromDB(result.stocks);
        lastSyncRef.current = JSON.stringify(result.stocks);
        initialLoadDone.current = true;
      } else if (result.status === 'empty') {
        // 첫 로그인, DB row 없음 → 현재 localStorage 데이터를 DB에 저장 (정상 path)
        savePortfolioToDB(user.id, stocks);
        lastSyncRef.current = JSON.stringify(stocks);
        initialLoadDone.current = true;
      } else {
        // status === 'error' (네트워크/RLS/일시적 오류) — save 호출 금지
        // initialLoadDone를 false로 유지해 다음 trigger에 재시도
        console.warn('[portfolioSync] DB load 실패 — save 보류:', result.error);
      }
    });

    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // pending save 추적 — 탭 종료 시 즉시 flush 하기 위함
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStocksRef = useRef<typeof stocks | null>(null);

  // stocks 변경 시 DB에 저장 (디바운스)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;

    const currentStr = JSON.stringify(stocks);
    if (currentStr === lastSyncRef.current) return; // 변경 없음
    lastSyncRef.current = currentStr;
    pendingStocksRef.current = stocks;

    // 디바운스: 2초 동안 변경 없으면 저장
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      savePortfolioToDB(user.id, stocks);
      pendingTimerRef.current = null;
      pendingStocksRef.current = null;
    }, 2000);

    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [user, stocks]);

  // 정합성 결함 M4-data 수정 — 디바운스 2초 사이 탭 종료/숨김 시 즉시 flush
  // visibilitychange(hidden)는 모바일 백그라운드/탭 전환 모두 잡아내고 beforeunload보다 신뢰성 높음
  useEffect(() => {
    if (!user) return;

    const flushPending = () => {
      if (pendingStocksRef.current) {
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        // 비동기지만 best-effort — 탭 종료 직전 호출 시 브라우저가 일부 보내줌
        savePortfolioToDB(user.id, pendingStocksRef.current);
        pendingTimerRef.current = null;
        pendingStocksRef.current = null;
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
