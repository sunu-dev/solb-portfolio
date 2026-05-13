'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getAvatarColor, STOCK_KR } from '@/config/constants';
import { CHOK_KR_MAP, CHOK_SECTOR_MAP, sectorLabel } from '@/config/chokUniverse';
import type { MacroEntry, PortfolioStocks } from '@/config/constants';
import { computeHoldingPriorities, buildHoldingsPromptContext } from '@/utils/priorityScore';
import { supabase } from '@/lib/supabase';

// ─── 섹터 라벨 헬퍼 — universe 영문 태그 → 한국어 라벨로 통일 ───────────────
function symbolToSectorLabel(symbol: string): string {
  const tag = CHOK_SECTOR_MAP[symbol];
  if (tag) return sectorLabel(tag);
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return '한국주식';
  return '기타';
}

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
    const sec = symbolToSectorLabel(s.symbol);
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
  fallback?: boolean;
  stale?: boolean;
  remaining: number;
  dailyLimit?: number;
  tier?: 'free' | 'pro';
  sessionLabel?: string;
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
function ChokCard({ pick, onAnalyze, onAddWatch, inWatching, onFeedback, feedbackGiven }: {
  pick: ChokPick;
  onAnalyze: () => void;
  onAddWatch: () => void;
  inWatching: boolean;
  onFeedback: (rating: 1 | -1) => void;
  feedbackGiven: 1 | -1 | null;
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
          background: 'var(--color-info-bg, rgba(49,130,246,0.08))',
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
            background: inWatching ? 'var(--bg-subtle, #F2F4F6)' : 'var(--color-info-bg, rgba(49,130,246,0.08))',
            color: inWatching ? 'var(--text-tertiary, #B0B8C1)' : '#3182F6',
            border: 'none',
          }}
        >
          {inWatching ? '✓ 둘러봄' : '둘러보기'}
        </button>
      </div>

      {/* 1탭 피드백 (도움됐어요/별로예요) */}
      <div className="flex items-center justify-end" style={{ gap: 4, fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
        <span style={{ marginRight: 2 }}>도움이 됐어요?</span>
        <button
          onClick={() => onFeedback(1)}
          disabled={feedbackGiven !== null}
          style={{
            padding: '2px 6px', fontSize: 12, lineHeight: 1, border: 'none', borderRadius: 4,
            background: feedbackGiven === 1 ? 'rgba(22,163,74,0.15)' : 'transparent',
            color: feedbackGiven === 1 ? '#16A34A' : '#8B95A1',
            cursor: feedbackGiven !== null ? 'default' : 'pointer',
          }}
          aria-label="도움됐어요"
        >👍</button>
        <button
          onClick={() => onFeedback(-1)}
          disabled={feedbackGiven !== null}
          style={{
            padding: '2px 6px', fontSize: 12, lineHeight: 1, border: 'none', borderRadius: 4,
            background: feedbackGiven === -1 ? 'rgba(239,68,82,0.15)' : 'transparent',
            color: feedbackGiven === -1 ? '#EF4452' : '#8B95A1',
            cursor: feedbackGiven !== null ? 'default' : 'pointer',
          }}
          aria-label="별로예요"
        >👎</button>
      </div>
    </div>
  );
}

// ==========================================
// Main section
// ==========================================
export default function AiChokSection() {
  const { getAllSymbols, setAnalysisSymbol, addStock, stocks, macroData, rawCandles, currentEventId, getAllEvents, investorType } = usePortfolioStore();
  const [state, setState] = useState<ChokState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, 1 | -1>>({});
  const [loginForMore, setLoginForMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchedRef = useRef(false);

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  /**
   * intent='fetch'  → 캐시/폴백만 (마운트, 타입 변경). AI 호출 X, 한도 차감 X.
   * intent='generate' → 사용자 명시 동작. AI 호출 + 한도 1회 차감.
   */
  const fetchChok = async (intent: 'fetch' | 'generate' = 'fetch') => {
    const force = intent === 'generate';
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const portfolioSymbols = getAllSymbols();
      const currentEvent = getAllEvents().find(e => e.id === currentEventId);
      // P3 — 시그널 우선순위 점수화: 핵심 보유 종목 컨텍스트 빌드
      const priorities = computeHoldingPriorities(stocks.investing || [], macroData, rawCandles);
      const holdingsContext = buildHoldingsPromptContext(priorities, 3);
      const res = await fetch('/api/ai-chok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioSymbols,
          intent,
          forceRefresh: force,
          macroContext: buildMacroContext(macroData),
          currentEvent: currentEvent ? `${currentEvent.emoji} ${currentEvent.name}` : '없음',
          sectorConcentration: buildSectorConcentration(stocks),
          investorType,
          holdingsContext, // 시그널 우선순위 기반 핵심 종목 + 메모 + z-score
        }),
      });
      const data = await res.json() as ChokState & { error?: string; limitReached?: boolean; loginForMore?: boolean };

      if (!res.ok) {
        setError(data.error || 'AI 촉 서비스에 오류가 발생했어요.');
        setLimitReached(!!data.limitReached);
        setLoginForMore(!!data.loginForMore);
        return;
      }
      setLimitReached(false);
      setLoginForMore(false);
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
    fetchChok('fetch'); // 마운트는 캐시/폴백만, AI 호출 X
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 투자자 유형 변경 시 자동 재조회 — fetch intent 유지 (한도 차감 X)
  const prevTypeRef = useRef(investorType);
  useEffect(() => {
    if (prevTypeRef.current !== investorType && fetchedRef.current) {
      prevTypeRef.current = investorType;
      fetchChok('fetch');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investorType]);

  const handleFeedback = async (symbol: string, rating: 1 | -1) => {
    if (feedbacks[symbol]) return; // 이미 응답함
    setFeedbacks(prev => ({ ...prev, [symbol]: rating }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return; // 비로그인 무시 (서버에서도 401)
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: 'ai-chok', symbol, rating, context: { investorType } }),
      });
    } catch { /* silent */ }
  };

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
    <section data-tour="ai-chok" style={{ marginBottom: 28 }}>
      {/* Header row */}
      <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
        <div>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              AI 촉
            </h2>
            {state && (state.fallback || state.stale || state.cached) && (() => {
              // 우선순위: fallback > stale > cached
              const isFallback = state.fallback;
              const isStale = !isFallback && state.stale;
              const label = isFallback
                ? '기준 추천'
                : isStale
                  ? `이전 ${state.sessionLabel || ''}`.trim()
                  : (state.sessionLabel || '오늘 기준');
              const fg = isFallback ? '#FF9500' : isStale ? '#8B95A1' : 'var(--text-tertiary, #B0B8C1)';
              const bg = isFallback ? 'rgba(255,149,0,0.10)' : 'var(--bg-subtle, #F2F4F6)';
              const tip = isFallback
                ? '객관 수치 기준 기본 추천이에요. AI에게 새로 받아보려면 오른쪽 버튼을 눌러주세요.'
                : isStale
                  ? '직전 세션 캐시예요. 새 세션 결과는 새로 받아보세요.'
                  : undefined;
              return (
                <span
                  title={tip}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: fg,
                    background: bg,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {label}
                </span>
              );
            })()}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 2 }}>
            AI의 관찰 후보예요 · 추천이 아닌 정보 제공 · 투자 판단은 본인이
          </p>
        </div>

        {/* Refresh button — 폴백/스테일 상태에선 더 강조해 노출 */}
        {state && state.remaining > 0 && !loading && (
          <button
            onClick={() => fetchChok('generate')}
            disabled={refreshing}
            className="flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-default"
            style={{
              fontSize: 12,
              fontWeight: state.fallback || state.stale ? 700 : 500,
              color: '#3182F6',
              background: state.fallback || state.stale ? 'var(--color-info-bg, rgba(49,130,246,0.08))' : 'none',
              border: 'none',
              padding: state.fallback || state.stale ? '6px 10px' : '4px 0',
              borderRadius: state.fallback || state.stale ? 8 : 0,
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {state.fallback || state.stale ? 'AI에게 받기' : '새로 촉 받기'}
            <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 2 }}>
              · 오늘 {state.remaining}/{state.dailyLimit ?? 1}
            </span>
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
            background: limitReached ? 'var(--color-info-bg, rgba(49,130,246,0.04))' : 'var(--bg-subtle, #F2F4F6)',
            border: limitReached ? '1px solid rgba(49,130,246,0.12)' : 'none',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 8 }}>{limitReached ? '🎯' : '😔'}</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
            {error}
          </p>
          {loginForMore ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}
              style={{
                marginTop: 14, padding: '8px 20px', borderRadius: 8,
                background: '#3182F6', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              로그인하고 더 받기
            </button>
          ) : (
            !limitReached && (
              <button
                onClick={() => fetchChok('fetch')}
                className="cursor-pointer"
                style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: '#3182F6', background: 'none', border: 'none', padding: 0 }}
              >
                다시 시도
              </button>
            )
          )}
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
                  onFeedback={(rating) => handleFeedback(pick.symbol, rating)}
                  feedbackGiven={feedbacks[pick.symbol] ?? null}
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
            onClick={() => fetchChok('generate')}
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
