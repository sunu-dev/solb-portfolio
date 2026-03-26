'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { loadPortfolioFromDB, savePortfolioToDB } from '@/lib/portfolioSync';
import type { User } from '@supabase/supabase-js';

export function usePortfolioSync(user: User | null) {
  const { stocks, setStocksFromDB } = usePortfolioStore();
  const lastSyncRef = useRef<string>('');
  const initialLoadDone = useRef(false);

  // Load from DB on login
  useEffect(() => {
    if (!user || initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadPortfolioFromDB(user.id).then(dbStocks => {
      if (dbStocks) {
        // DB에 데이터 있음 → DB를 소스로 사용
        setStocksFromDB(dbStocks);
        lastSyncRef.current = JSON.stringify(dbStocks);
      } else {
        // 첫 로그인, DB 기록 없음 → 현재 localStorage 데이터를 DB에 저장
        savePortfolioToDB(user.id, stocks);
        lastSyncRef.current = JSON.stringify(stocks);
      }
    });
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
