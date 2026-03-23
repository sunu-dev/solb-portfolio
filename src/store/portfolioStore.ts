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
  apiKey: string;
  autoRefresh: boolean;
  refreshInterval: number;
  customEvents: PresetEvent[];
  lastUpdate: string | null;

  // Edit modal state
  editingCat: StockCategory | '';
  editingIdx: number;

  // Actions
  setCurrentTab: (tab: StockCategory) => void;
  setCurrentSection: (section: MainSection) => void;
  setCurrentNewsMarket: (market: string) => void;
  setCurrentEventId: (id: string) => void;
  setAnalysisSymbol: (symbol: string | null) => void;
  setApiKey: (key: string) => void;
  setAutoRefresh: (val: boolean) => void;
  setRefreshInterval: (ms: number) => void;
  setLastUpdate: (time: string | null) => void;
  setEditingCat: (cat: StockCategory | '') => void;
  setEditingIdx: (idx: number) => void;

  // Macro & cache
  updateMacroEntry: (key: string, val: MacroEntry | QuoteData) => void;
  updateCandleCache: (symbol: string, val: Record<number, number>) => void;
  updateRawCandles: (symbol: string, val: CandleRaw) => void;
  updateNewsCache: (market: string, items: NewsItem[]) => void;
  updateEventCache: (eventId: string, data: Record<string, EventCacheEntry>) => void;
  updateEventCacheEntry: (eventId: string, symbol: string, data: EventCacheEntry) => void;

  // Portfolio CRUD
  addStock: (category: StockCategory, stock: StockItem) => void;
  deleteStock: (category: StockCategory, idx: number) => void;
  updateStock: (category: StockCategory, idx: number, data: Partial<StockItem>) => void;
  loadPortfolio: () => void;
  savePortfolio: () => void;
  addCustomEvent: (event: PresetEvent) => void;

  // Helpers
  getAllSymbols: () => string[];
  getAllEvents: () => PresetEvent[];
}

const DEFAULT_API_KEY = 'd6va409r01qiiutb2g9gd6va409r01qiiutb2ga0';

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

      currentTab: 'short',
      currentSection: 'portfolio',
      currentNewsMarket: 'us',
      currentEventId: 'iran-war',
      analysisSymbol: null,

      apiKey: DEFAULT_API_KEY,
      autoRefresh: true,
      refreshInterval: 30000,
      customEvents: [],
      lastUpdate: null,

      editingCat: '',
      editingIdx: -1,

      // --- Setters ---
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
          updated[category] = updated[category].map((s, i) =>
            i === idx ? { ...s, ...data } : s
          );
          return { stocks: updated };
        }),

      loadPortfolio: () => {
        const state = get();
        // Migrate: ensure all stocks have required fields
        const stocks = { ...state.stocks };
        let needsSave = false;
        for (const c of ['short', 'long', 'watch'] as StockCategory[]) {
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

      // --- Helpers ---
      getAllSymbols: () => {
        const state = get();
        const s = new Set<string>();
        for (const c of ['short', 'long', 'watch'] as StockCategory[]) {
          for (const st of state.stocks[c]) s.add(st.symbol);
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
        apiKey: state.apiKey,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        customEvents: state.customEvents,
        currentTab: state.currentTab,
      }),
    }
  )
);

// Re-export STOCK_KR so it can be mutated (for dynamic additions)
export { STOCK_KR };
