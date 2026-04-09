// ==========================================
// STORE -- Zustand store (replaces state.js)
// ==========================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StockItem, StockCategory, PortfolioStocks,
  MacroEntry, QuoteData, CandleRaw,
  NewsItem, EventCacheEntry, PresetEvent,
} from '@/config/constants';
import { DEFAULT_STOCKS, STOCK_KR, PRESET_EVENTS } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';

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

export type MainSection = 'portfolio' | 'events' | 'news';

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

  // Alerts
  alerts: Alert[];
  dismissedAlerts: string[]; // alert IDs dismissed in this session

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

  // Sync
  setStocksFromDB: (stocks: PortfolioStocks) => void;

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

      alerts: [],
      dismissedAlerts: [],

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
      dismissAlert: (alertId) =>
        set((state) => ({
          dismissedAlerts: [...state.dismissedAlerts, alertId],
        })),
      dismissAllAlerts: () =>
        set((state) => ({
          dismissedAlerts: [...state.dismissedAlerts, ...state.alerts.map(a => a.id)],
        })),

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

      // --- Sync ---
      setStocksFromDB: (stocks) => set({ stocks }),

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
      partialize: (state) => ({
        stocks: state.stocks,
        currency: state.currency,
        darkMode: state.darkMode,
        apiKey: state.apiKey,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        customEvents: state.customEvents,
      }),
    }
  )
);

// Re-export STOCK_KR so it can be mutated (for dynamic additions)
export { STOCK_KR };
