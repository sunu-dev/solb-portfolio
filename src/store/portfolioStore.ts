// ==========================================
// STORE -- Zustand store (replaces state.js)
// ==========================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  StockItem, StockCategory, PortfolioStocks,
  MacroEntry, QuoteData, CandleRaw,
  NewsItem, EventCacheEntry, PresetEvent,
} from '@/config/constants';
import { DEFAULT_STOCKS, STOCK_KR, PRESET_EVENTS } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { recordDismissal } from '@/utils/alertLearning';
import type { DailySnapshot } from '@/utils/dailySnapshot';
import { getTodayKST, needsNewSnapshot, prune } from '@/utils/dailySnapshot';
import type { InvestorType } from '@/config/investorTypes';
import { DEFAULT_INVESTOR_TYPE } from '@/config/investorTypes';

// --- Utility functions ---
export function tsToDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// --- Store types ---

export type MainSection = 'portfolio' | 'events' | 'news' | 'insights';

// Categories that hold actual stock arrays (excludes 'all')
type StockCategoryKey = 'investing' | 'watching' | 'sold';

interface PortfolioState {
  // Portfolio data
  stocks: PortfolioStocks;
  macroData: Record<string, MacroEntry | QuoteData>;
  candleCache: Record<string, Record<number, number>>;
  rawCandles: Record<string, CandleRaw>;
  newsCache: Record<string, NewsItem[]>;
  eventCache: Record<string, Record<string, EventCacheEntry>>;

  // UI state
  currentTab: StockCategory;
  currentSection: MainSection;
  currentNewsMarket: string;
  currentEventId: string;
  analysisSymbol: string | null;

  // Settings
  currency: 'KRW' | 'USD';
  darkMode: boolean;
  apiKey: string;
  autoRefresh: boolean;
  refreshInterval: number;
  customEvents: PresetEvent[];
  lastUpdate: string | null;

  // Daily snapshots (과거의 나 비교용)
  dailySnapshots: DailySnapshot[];

  // 투자자 유형 (AI 개인화 baseline)
  investorType: InvestorType;
  investorTypeSetAt: string | null; // 최초 설정 시각 (ISO), null = 미설정

  // Alerts
  alerts: Alert[];
  dismissedAlerts: string[]; // alert IDs dismissed in this session
  lastDismissBatch: string[]; // 마지막 '전체 읽음'으로 해제된 ID들 (Undo용, 비영속)
  snoozeTick: number; // snooze 상태 변경 시 증가 (localStorage 기반 snooze 리렌더 트리거)

  // Network error (not persisted)
  networkError: string | null;

  // Edit modal state
  editingCat: StockCategoryKey | '';
  editingIdx: number;

  // Actions
  setCurrency: (c: 'KRW' | 'USD') => void;
  toggleDarkMode: () => void;
  setCurrentTab: (tab: StockCategory) => void;
  setCurrentSection: (section: MainSection) => void;
  setCurrentNewsMarket: (market: string) => void;
  setCurrentEventId: (id: string) => void;
  setAnalysisSymbol: (symbol: string | null) => void;
  setApiKey: (key: string) => void;
  setAutoRefresh: (val: boolean) => void;
  setRefreshInterval: (ms: number) => void;
  setLastUpdate: (time: string | null) => void;
  setEditingCat: (cat: StockCategoryKey | '') => void;
  setEditingIdx: (idx: number) => void;
  setAlerts: (alerts: Alert[]) => void;
  dismissAlert: (alertId: string) => void;
  dismissAllAlerts: () => void;
  undoDismissAll: () => void;
  bumpSnoozeTick: () => void;
  setNetworkError: (err: string | null) => void;

  // Macro & cache
  updateMacroEntry: (key: string, val: MacroEntry | QuoteData) => void;
  updateCandleCache: (symbol: string, val: Record<number, number>) => void;
  updateRawCandles: (symbol: string, val: CandleRaw) => void;
  updateNewsCache: (market: string, items: NewsItem[]) => void;
  updateEventCache: (eventId: string, data: Record<string, EventCacheEntry>) => void;
  updateEventCacheEntry: (eventId: string, symbol: string, data: EventCacheEntry) => void;

  // Portfolio CRUD
  addStock: (category: StockCategoryKey, stock: StockItem) => void;
  deleteStock: (category: StockCategoryKey, idx: number) => void;
  updateStock: (category: StockCategoryKey, idx: number, data: Partial<StockItem>) => void;
  moveStock: (fromCat: StockCategoryKey, idx: number, toCat: StockCategoryKey) => void;
  loadPortfolio: () => void;
  savePortfolio: () => void;
  addCustomEvent: (event: PresetEvent) => void;
  deleteCustomEvent: (id: string) => PresetEvent | null; // 삭제된 이벤트 반환 (Undo용)
  restoreCustomEvent: (event: PresetEvent) => void;

  // Snapshots
  recordDailySnapshot: () => void;

  // Investor type
  setInvestorType: (type: InvestorType) => void;

  // Sync
  setStocksFromDB: (stocks: PortfolioStocks) => void;
  resetPortfolio: () => void;

  // Helpers
  getAllSymbols: () => string[];
  getAllEvents: () => PresetEvent[];
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      // --- Initial state ---
      stocks: JSON.parse(JSON.stringify(DEFAULT_STOCKS)),
      macroData: {},
      candleCache: {},
      rawCandles: {},
      newsCache: {},
      eventCache: {},

      currentTab: 'all' as StockCategory,
      currentSection: 'portfolio',
      currentNewsMarket: 'us',
      currentEventId: 'iran-war',
      analysisSymbol: null,

      currency: 'KRW' as 'KRW' | 'USD',
      darkMode: false,
      apiKey: '',
      autoRefresh: true,
      refreshInterval: 30000,
      customEvents: [],
      lastUpdate: null,
      dailySnapshots: [],
      investorType: DEFAULT_INVESTOR_TYPE,
      investorTypeSetAt: null,

      alerts: [],
      dismissedAlerts: [],
      lastDismissBatch: [],
      snoozeTick: 0,
      networkError: null,

      editingCat: '',
      editingIdx: -1,

      // --- Setters ---
      setCurrency: (c) => set({ currency: c }),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setCurrentTab: (tab) => set({ currentTab: tab }),
      setCurrentSection: (section) => set({ currentSection: section }),
      setCurrentNewsMarket: (market) => set({ currentNewsMarket: market }),
      setCurrentEventId: (id) => set({ currentEventId: id }),
      setAnalysisSymbol: (symbol) => set({ analysisSymbol: symbol }),
      setApiKey: (key) => set({ apiKey: key }),
      setAutoRefresh: (val) => set({ autoRefresh: val }),
      setRefreshInterval: (ms) => set({ refreshInterval: ms }),
      setLastUpdate: (time) => set({ lastUpdate: time }),
      setEditingCat: (cat) => set({ editingCat: cat }),
      setEditingIdx: (idx) => set({ editingIdx: idx }),
      setAlerts: (alerts) => set({ alerts }),
      setNetworkError: (err) => set({ networkError: err }),
      dismissAlert: (alertId) => {
        recordDismissal(alertId);
        set((state) => ({
          dismissedAlerts: [...state.dismissedAlerts, alertId],
        }));
      },
      dismissAllAlerts: () =>
        set((state) => {
          // 아직 해제되지 않은 알림 ID만 batch로 저장
          const existing = new Set(state.dismissedAlerts);
          const newlyDismissed = state.alerts.map(a => a.id).filter(id => !existing.has(id));
          // 학습: 각 타입별 해제 기록
          newlyDismissed.forEach(id => recordDismissal(id));
          return {
            dismissedAlerts: [...state.dismissedAlerts, ...newlyDismissed],
            lastDismissBatch: newlyDismissed,
          };
        }),

      undoDismissAll: () =>
        set((state) => {
          if (!state.lastDismissBatch.length) return state;
          const batch = new Set(state.lastDismissBatch);
          return {
            dismissedAlerts: state.dismissedAlerts.filter(id => !batch.has(id)),
            lastDismissBatch: [],
          };
        }),

      bumpSnoozeTick: () => set((state) => ({ snoozeTick: state.snoozeTick + 1 })),

      // --- Macro & cache ---
      updateMacroEntry: (key, val) =>
        set((state) => ({ macroData: { ...state.macroData, [key]: val } })),

      updateCandleCache: (symbol, val) =>
        set((state) => ({ candleCache: { ...state.candleCache, [symbol]: val } })),

      updateRawCandles: (symbol, val) =>
        set((state) => ({ rawCandles: { ...state.rawCandles, [symbol]: val } })),

      updateNewsCache: (market, items) =>
        set((state) => ({ newsCache: { ...state.newsCache, [market]: items } })),

      updateEventCache: (eventId, data) =>
        set((state) => ({ eventCache: { ...state.eventCache, [eventId]: data } })),

      updateEventCacheEntry: (eventId, symbol, data) =>
        set((state) => ({
          eventCache: {
            ...state.eventCache,
            [eventId]: {
              ...(state.eventCache[eventId] || {}),
              [symbol]: data,
            },
          },
        })),

      // --- Portfolio CRUD ---
      addStock: (category, stock) =>
        set((state) => {
          const total = (state.stocks.investing?.length || 0) + (state.stocks.watching?.length || 0) + (state.stocks.sold?.length || 0);
          if (total >= 50) {
            if (typeof window !== 'undefined') alert('종목은 최대 50개까지 등록할 수 있어요.');
            return state;
          }
          const updated = { ...state.stocks };
          updated[category] = [...updated[category], stock];
          return { stocks: updated };
        }),

      deleteStock: (category, idx) =>
        set((state) => {
          const updated = { ...state.stocks };
          updated[category] = updated[category].filter((_, i) => i !== idx);
          return { stocks: updated };
        }),

      updateStock: (category, idx, data) =>
        set((state) => {
          const updated = { ...state.stocks };
          const newStock = { ...updated[category][idx], ...data };
          updated[category] = updated[category].map((s, i) =>
            i === idx ? newStock : s
          );

          // 자동 분류: avgCost > 0 && shares > 0이면 investing으로, 둘 다 0이면 watching으로
          const hasPosition = (newStock.avgCost || 0) > 0 && (newStock.shares || 0) > 0;
          if (hasPosition && category !== 'investing') {
            // watching/sold → investing로 이동
            updated[category] = updated[category].filter((_, i) => i !== idx);
            updated.investing = [...updated.investing, newStock];
          } else if (!hasPosition && category === 'investing') {
            // investing에서 수량/단가 0으로 변경 → watching으로 이동
            updated[category] = updated[category].filter((_, i) => i !== idx);
            updated.watching = [...updated.watching, { ...newStock, buyBelow: newStock.buyBelow || 0 }];
          }

          return { stocks: updated };
        }),

      moveStock: (fromCat, idx, toCat) =>
        set((state) => {
          const updated = { ...state.stocks };
          const stock = updated[fromCat][idx];
          if (!stock || fromCat === toCat) return state;
          updated[fromCat] = updated[fromCat].filter((_, i) => i !== idx);
          updated[toCat] = [...updated[toCat], stock];
          return { stocks: updated };
        }),

      loadPortfolio: () => {
        const state = get();

        const stocks = { ...state.stocks };
        let needsSave = false;

        // Migrate from old short/long/watch to new categories
        const anyObj = stocks as Record<string, StockItem[]>;
        if (anyObj['short'] || anyObj['long'] || anyObj['watch']) {
          const oldInvesting = [...(anyObj['short'] || []), ...(anyObj['long'] || [])];
          const oldWatching = anyObj['watch'] || [];
          if (!stocks.investing) stocks.investing = [];
          if (!stocks.watching) stocks.watching = [];
          if (!stocks.sold) stocks.sold = [];
          if (oldInvesting.length && !stocks.investing.length) {
            stocks.investing = oldInvesting;
            needsSave = true;
          }
          if (oldWatching.length && !stocks.watching.length) {
            stocks.watching = oldWatching;
            needsSave = true;
          }
          delete anyObj['short'];
          delete anyObj['long'];
          delete anyObj['watch'];
        }

        // Ensure all categories exist
        if (!stocks.investing) { stocks.investing = []; needsSave = true; }
        if (!stocks.watching) { stocks.watching = []; needsSave = true; }
        if (!stocks.sold) { stocks.sold = []; needsSave = true; }

        for (const c of ['investing', 'watching', 'sold'] as StockCategoryKey[]) {
          for (const st of stocks[c]) {
            if (st.avgCost === undefined) { st.avgCost = 0; needsSave = true; }
            if (st.shares === undefined) { st.shares = 0; needsSave = true; }
            if (st.targetReturn === undefined) { st.targetReturn = 0; needsSave = true; }
          }
        }
        if (needsSave) set({ stocks });
      },

      savePortfolio: () => {
        // persist middleware handles this automatically
      },

      addCustomEvent: (event) =>
        set((state) => ({
          customEvents: [...state.customEvents, event],
        })),

      deleteCustomEvent: (id) => {
        const state = get();
        const removed = state.customEvents.find(e => e.id === id) || null;
        if (!removed) return null;
        // 캐시도 함께 제거 (되돌릴 땐 어차피 재계산)
        const nextCache = { ...state.eventCache };
        delete nextCache[id];
        set({
          customEvents: state.customEvents.filter(e => e.id !== id),
          eventCache: nextCache,
        });
        return removed;
      },

      restoreCustomEvent: (event) =>
        set((state) => ({
          customEvents: [...state.customEvents, event],
        })),

      setInvestorType: (type) => set({
        investorType: type,
        investorTypeSetAt: get().investorTypeSetAt || new Date().toISOString(),
      }),

      recordDailySnapshot: () => {
        const state = get();
        if (!needsNewSnapshot(state.dailySnapshots)) return;

        const investing = state.stocks.investing || [];
        const stocksSnap = investing
          .filter(s => s.avgCost > 0 && s.shares > 0)
          .map(s => {
            const q = state.macroData[s.symbol] as { c?: number } | undefined;
            const currentPrice = q?.c || 0;
            return {
              symbol: s.symbol,
              avgCost: s.avgCost,
              shares: s.shares,
              currentPrice,
              purchaseRate: s.purchaseRate,
            };
          })
          .filter(s => s.currentPrice > 0); // 시세 없으면 제외

        if (stocksSnap.length === 0) return; // 의미 있는 데이터만 저장

        const totalValue = stocksSnap.reduce((sum, s) => sum + s.currentPrice * s.shares, 0);
        const totalCost = stocksSnap.reduce((sum, s) => sum + s.avgCost * s.shares, 0);

        const snap: DailySnapshot = {
          date: getTodayKST(),
          totalValue,
          totalCost,
          stocks: stocksSnap,
        };

        set({ dailySnapshots: prune([...state.dailySnapshots, snap], 365) });
      },

      // --- Sync ---
      setStocksFromDB: (stocks) => set({ stocks }),

      resetPortfolio: () => set({
        stocks: { investing: [], watching: [], sold: [] },
        macroData: {},
        candleCache: {},
        rawCandles: {},
        newsCache: {},
        eventCache: {},
        alerts: [],
        dismissedAlerts: [],
        lastDismissBatch: [],
        lastUpdate: null,
      }),

      // --- Helpers ---
      getAllSymbols: () => {
        const state = get();
        const s = new Set<string>();
        for (const c of ['investing', 'watching', 'sold'] as StockCategoryKey[]) {
          if (state.stocks[c]) {
            for (const st of state.stocks[c]) s.add(st.symbol);
          }
        }
        return [...s];
      },

      getAllEvents: () => {
        const state = get();
        return [...PRESET_EVENTS, ...state.customEvents];
      },
    }),
    {
      name: 'solb-portfolio-storage',
      // 정합성 결함 L3-data: localStorage quota 초과 silent fail 방지
      // setItem 실패 시 (QuotaExceededError 등) 콘솔 경고 + 가장 오래된 dailySnapshots부터 trim 시도
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try { return localStorage.getItem(name); } catch { return null; }
        },
        setItem: (name: string, value: string) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            const err = e as Error;
            const isQuota =
              err.name === 'QuotaExceededError' ||
              /quota/i.test(err.message || '');
            console.warn('[persist] localStorage 저장 실패:', err.name || err.message);
            if (isQuota) {
              try {
                // 1차 정리: 오래된 macro/quote 캐시 제거 (가장 큰 비용)
                localStorage.removeItem('solb_quote_cache');
                localStorage.removeItem('solb_macro_cache');
                localStorage.setItem(name, value);
                console.info('[persist] 캐시 정리 후 저장 성공');
                return;
              } catch {
                // 2차 정리: dailySnapshots 절반으로 trim 후 재시도
                try {
                  const parsed = JSON.parse(value);
                  if (parsed?.state?.dailySnapshots && Array.isArray(parsed.state.dailySnapshots)) {
                    const arr = parsed.state.dailySnapshots;
                    parsed.state.dailySnapshots = arr.slice(Math.floor(arr.length / 2));
                    localStorage.setItem(name, JSON.stringify(parsed));
                    console.warn('[persist] dailySnapshots 절반 trim 후 저장 성공');
                    return;
                  }
                } catch { /* 마지막 시도도 실패 */ }
                console.error('[persist] 저장 불가 — 스토리지 가득 참. 데이터 손실 위험.');
              }
            }
          }
        },
        removeItem: (name: string) => {
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        },
      })),
      // 정합성 결함 H1-data: 스키마 변경 시 데이터 손상 방지
      // 향후 필드 추가/제거 시 version 올리고 migrate 처리. 호환 깨질 때만 olderToNewer.
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        // v0(version 미지정) → v1: 기존 데이터 호환 유지
        if (version === 0 && persistedState && typeof persistedState === 'object') {
          const s = persistedState as Record<string, unknown>;
          // v0에선 short/long/watch 카테고리도 있었음 — loadPortfolio()가 마이그레이션 담당
          // dailySnapshots/investorType 같은 신규 필드는 undefined → 초기값 유지
          return {
            ...s,
            // 안전 fallback
            dailySnapshots: Array.isArray(s.dailySnapshots) ? s.dailySnapshots : [],
            customEvents: Array.isArray(s.customEvents) ? s.customEvents : [],
          };
        }
        return persistedState as Record<string, unknown>;
      },
      partialize: (state) => ({
        stocks: state.stocks,
        currency: state.currency,
        darkMode: state.darkMode,
        apiKey: state.apiKey,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        customEvents: state.customEvents,
        dailySnapshots: state.dailySnapshots,
        investorType: state.investorType,
        investorTypeSetAt: state.investorTypeSetAt,
        // eventCache는 의도적으로 제외 — basePrices 변경 시 자동 재계산
      }),
    }
  )
);

// Re-export STOCK_KR so it can be mutated (for dynamic additions)
export { STOCK_KR };
