'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getAvatarColor, STOCK_KR } from '@/config/constants';
import { CHOK_KR_MAP } from '@/config/chokUniverse';
import type { MacroEntry, PortfolioStocks } from '@/config/constants';

// ─── 시장 컨텍스트 빌더 ──────────────────────────────────────────────────────
const SECTOR_MAP: Record<string, string> = {
  NVDA:'반도체', AMD:'반도체', MU:'반도체', AVGO:'반도체', QCOM:'반도체', INTC:'반도체', TSM:'반도체', SOXX:'반도체', ASML:'반도체', AMAT:'반도체',
  MSFT:'빅테크', AAPL:'빅테크', GOOGL:'빅테크', META:'빅테크', AMZN:'빅테크', NFLX:'스트리밍', CRM:'빅테크', ORCL:'빅테크',
  TSLA:'EV', GM:'EV', F:'EV',
  JPM:'금융', GS:'금융', V:'금융', MA:'금융', BAC:'금융', COIN:'크립토',
  LLY:'헬스케어', JNJ:'헬스케어', PFE:'헬스케어', ABBV:'헬스케어', UNH:'헬스케어', MRNA:'헬스케어',
  WMT:'소비재', COST:'소비재', NKE:'소비재', SBUX:'소비재', MCD:'소비재',
  XOM:'에너지', CVX:'에너지',
  SPY:'ETF', QQQ:'ETF', VGT:'ETF', SCHD:'ETF',
};

function buildMacroContext(macroData: Record<string, MacroEntry | unknown>): string {
  const vix = macroData['VIX'] as MacroEntry | undefined;
  const sp  = macroData['S&P 500'] as MacroEntry | undefined;
  const nq  = macroData['NASDAQ'] as MacroEntry | undefined;

  const parts: string[] = [];
  if (vix?.value != null) {
    const v = Number(vix.value);
    const regime = v > 30 ? '극도의 공포(저점 가능)'
      : v > 25 ? '공포 구간'
      : v > 20 ? '불안 구간'
      : v < 15 ? '안정/과열'
      : '적정';
    parts.push(`VIX ${v.toFixed(1)} (${regime})`);
  }
  if (sp?.changePercent != null) parts.push(`S&P500 ${sp.changePercent >= 0 ? '+' : ''}${sp.changePercent.toFixed(2)}%`);
  if (nq?.changePercent != null) parts.push(`NASDAQ ${nq.changePercent >= 0 ? '+' : ''}${nq.changePercent.toFixed(2)}%`);
  return parts.length ? parts.join(' / ') : '시장 데이터 로드 중';
}

function buildSectorConcentration(stocks: PortfolioStocks): string {
  const all = [...(stocks.investing || []), ...(stocks.watching || [])];
  if (!all.length) return '포트폴리오 없음';
  const cnt: Record<string, number> = {};
  for (const s of all) {
    const sec = SECTOR_MAP[s.symbol] || '기타';
    cnt[sec] = (cnt[sec] || 0) + 1;
  }
  return Object.entries(cnt)
    .sort((a, b) => b[1] - a[1])
    .map(([sec, n]) => `${sec} ${Math.round(n / all.length * 100)}%`)
    .slice(0, 4)
    .join(', ');
}

interface ChokPick {
  symbol: string;
  krName: string;
  sector: string;
  reason: string;
  keyMetric: string;
}

interface ChokState {
  picks: ChokPick[];
  context: string;
  cached: boolean;
  remaining: number;
}

// ==========================================
// Skeleton card
// ==========================================
function SkeletonCard() {
  return (
    <div
      className="flex-none w-[156px] sm:w-auto rounded-2xl"
      style={{
        border: '1px solid var(--border-light, #F2F4F6)',
        padding: '16px',
        background: 'var(--surface, #fff)',
        minHeight: 200,
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <div className="rounded-full shrink-0" style={{ width: 36, height: 36, background: 'var(--bg-subtle, #F2F4F6)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '60%', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 4 }} />
          <div style={{ height: 10, width: '40%', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ height: 10, width: '85%', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 6 }} />
      <div style={{ height: 10, width: '70%', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 24, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 6, marginBottom: 8 }} />
      <div className="flex gap-2">
        <div style={{ flex: 1, height: 32, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 8 }} />
        <div style={{ flex: 1, height: 32, background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ==========================================
// Chok card
// ==========================================
function ChokCard({ pick, onAnalyze, onAddWatch, inWatching }: {
  pick: ChokPick;
  onAnalyze: () => void;
  onAddWatch: () => void;
  inWatching: boolean;
}) {
  const avatarColor = getAvatarColor(pick.symbol);
  const krName = STOCK_KR[pick.symbol] || CHOK_KR_MAP[pick.symbol] || pick.krName || pick.symbol;

  return (
    <div
      className="flex-none w-[156px] sm:w-auto rounded-2xl flex flex-col"
      style={{
        border: '1px solid var(--border-light, #F2F4F6)',
        padding: '16px',
        background: 'var(--surface, #fff)',
        gap: 10,
      }}
    >
      {/* Avatar + symbol */}
      <div className="flex items-center" style={{ gap: 10 }}>
        <div
          className="rounded-full shrink-0 flex items-center justify-center"
          style={{ width: 36, height: 36, background: avatarColor }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {pick.symbol.charAt(0)}
          </span>
        </div>
        <div className="min-w-0">
          <div
            className="truncate"
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}
          >
            {pick.symbol}
          </div>
          <div
            className="truncate"
            style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}
          >
            {krName}
          </div>
        </div>
      </div>

      {/* Reason */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.55 }}>
        {pick.reason}
      </div>

      {/* Key metric chip */}
      <div
        className="self-start"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#3182F6',
          background: 'rgba(49,130,246,0.08)',
          padding: '3px 8px',
          borderRadius: 6,
        }}
      >
        {pick.keyMetric}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onAnalyze}
          className="cursor-pointer transition-opacity hover:opacity-80"
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--text-primary, #191F28)',
            color: '#fff',
            border: 'none',
          }}
        >
          분석 보기
        </button>
        <button
          onClick={onAddWatch}
          disabled={inWatching}
          className="cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-60"
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            background: inWatching ? 'var(--bg-subtle, #F2F4F6)' : 'rgba(49,130,246,0.08)',
            color: inWatching ? 'var(--text-tertiary, #B0B8C1)' : '#3182F6',
            border: 'none',
          }}
        >
          {inWatching ? '✓ 관심' : '+ 관심'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Main section
// ==========================================
export default function AiChokSection() {
  const { getAllSymbols, setAnalysisSymbol, addStock, stocks, macroData, currentEventId, getAllEvents } = usePortfolioStore();
  const [state, setState] = useState<ChokState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetchedRef = useRef(false);

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  const fetchChok = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const portfolioSymbols = getAllSymbols();
      const currentEvent = getAllEvents().find(e => e.id === currentEventId);
      const res = await fetch('/api/ai-chok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioSymbols,
          forceRefresh: force,
          macroContext: buildMacroContext(macroData),
          currentEvent: currentEvent ? `${currentEvent.emoji} ${currentEvent.name}` : '없음',
          sectorConcentration: buildSectorConcentration(stocks),
        }),
      });
      const data = await res.json() as ChokState & { error?: string; limitReached?: boolean };

      if (!res.ok) {
        setError(data.error || 'AI 촉 서비스에 오류가 발생했어요.');
        return;
      }
      setState(data);
    } catch {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchChok();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddWatch = (pick: ChokPick) => {
    if (watchingSet.has(pick.symbol)) return;
    addStock('watching', {
      symbol: pick.symbol,
      avgCost: 0,
      shares: 0,
      targetReturn: 0,
      buyBelow: 0,
    });
  };

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Header row */}
      <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
        <div>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              AI 촉
            </h2>
            {state?.cached && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--text-tertiary, #B0B8C1)',
                  background: 'var(--bg-subtle, #F2F4F6)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                오늘 기준
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 2 }}>
            AI의 촉이에요 · 투자 판단은 본인이
          </p>
        </div>

        {/* Refresh button */}
        {state && state.remaining > 0 && !loading && (
          <button
            onClick={() => fetchChok(true)}
            disabled={refreshing}
            className="flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-default"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#3182F6',
              background: 'none',
              border: 'none',
              padding: '4px 0',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            새로 촉 받기 ({state.remaining}회 남음)
          </button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            padding: '20px 16px',
            borderRadius: 12,
            background: 'var(--bg-subtle, #F2F4F6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 8 }}>😔</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
            {error}
          </p>
          <button
            onClick={() => fetchChok()}
            className="cursor-pointer"
            style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: '#3182F6', background: 'none', border: 'none', padding: 0 }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && state && state.picks.length > 0 && (
        <>
          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {state.picks.map(pick => (
              <div key={pick.symbol} style={{ scrollSnapAlign: 'start' }}>
                <ChokCard
                  pick={pick}
                  onAnalyze={() => setAnalysisSymbol(pick.symbol)}
                  onAddWatch={() => handleAddWatch(pick)}
                  inWatching={watchingSet.has(pick.symbol)}
                />
              </div>
            ))}
          </div>

          {state.context && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary, #B0B8C1)',
                marginTop: 10,
                lineHeight: 1.6,
                paddingLeft: 2,
              }}
            >
              {state.context}
            </p>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && state && state.picks.length === 0 && (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 12,
            background: 'var(--bg-subtle, #F2F4F6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6 }}>🎯</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>
            촉이 오는 종목을 찾지 못했어요.
          </p>
          <button
            onClick={() => fetchChok(true)}
            className="cursor-pointer"
            style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#3182F6', background: 'none', border: 'none', padding: 0 }}
          >
            다시 촉 받기
          </button>
        </div>
      )}
    </section>
  );
}
