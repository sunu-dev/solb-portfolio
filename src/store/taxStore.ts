// ==========================================
// TAX STORE — v1 합산기 입력 상태 (클라이언트 persist)
// ==========================================
//
// SSOT: docs/TAX_PIVOT_MVP_SPEC.md (v1 최소 Aha 슬라이스).
// portfolioStore와 분리 — 세무는 별도 도메인이고 검증용이라 독립 persist 키를 쓴다.
// ⚠️ 검증 단계 모델: 증권사별 실현손익(KRW) 1줄씩만 보관. 거래내역(lot)·환율은 v2 영역.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TaxBrokerEntry } from '@/utils/tax';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface TaxState {
  taxYear: number;
  entries: TaxBrokerEntry[];
  setYear: (year: number) => void;
  addEntry: (broker: string, gainKrw: number) => void;
  updateEntry: (id: string, patch: Partial<Pick<TaxBrokerEntry, 'broker' | 'gainKrw'>>) => void;
  removeEntry: (id: string) => void;
  clear: () => void;
}

export const useTaxStore = create<TaxState>()(
  persist(
    (set) => ({
      taxYear: new Date().getFullYear(),
      entries: [],
      setYear: (year) => set({ taxYear: year }),
      addEntry: (broker, gainKrw) =>
        set((s) => ({ entries: [...s.entries, { id: newId(), broker, gainKrw }] })),
      updateEntry: (id, patch) =>
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'joobi-tax-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
