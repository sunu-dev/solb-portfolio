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

  // stocks 변경 시 DB에 저장 (디바운스)
  useEffect(() => {
    if (!user || !initialLoadDone.current) return;

    const currentStr = JSON.stringify(stocks);
    if (currentStr === lastSyncRef.current) return; // 변경 없음
    lastSyncRef.current = currentStr;

    // 디바운스: 2초 동안 변경 없으면 저장
    const timer = setTimeout(() => {
      savePortfolioToDB(user.id, stocks);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, stocks]);

  // 로그아웃 시 초기화
  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      lastSyncRef.current = '';
    }
  }, [user]);
}
