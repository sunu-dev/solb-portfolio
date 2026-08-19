'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, CircleAlert, RefreshCw, Target, ThumbsDown, ThumbsUp } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getAvatarColor, STOCK_KR } from '@/config/constants';
import { CHOK_KR_MAP } from '@/config/chokUniverse';
import type { MacroEntry } from '@/config/constants';
import { supabase } from '@/lib/supabase';
import { trackChokImpression, trackChokInView, trackChokInteraction } from '@/utils/telemetry/chokEvents';
import { logTourEvent } from '@/lib/tourTelemetry';
import AiResultMeta from '@/components/common/AiResultMeta';
import type { AiResultMeta as AiResultMetaValue } from '@/lib/aiResultMeta';
import type { MarketFlowResult } from '@/utils/marketFlow';

function buildMacroContext(macroData: Record<string, MacroEntry | unknown>): string {
  const vix = macroData['VIX'] as MacroEntry | undefined;
  const sp  = macroData['S&P 500'] as MacroEntry | undefined;
  const nq  = macroData['NASDAQ'] as MacroEntry | undefined;

  const parts: string[] = [];
  if (vix?.value != null) {
    const v = Number(vix.value);
    const regime = v > 30 ? '극도의 공포'
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
  _meta?: AiResultMetaValue;
  marketFlow?: MarketFlowResult;
}

function MarketFlowSummary({ flow }: { flow: MarketFlowResult }) {
  const confidenceLabel = flow.rotation.detected
    ? flow.rotation.confidence === 'high' ? '뚜렷한 순환 신호' : '순환 신호'
    : '상대 강도 비교';

  return (
    <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #E5E8EB)' }}>
      <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>오늘 흐름 한 줄</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary, #4E5968)', background: 'var(--bg-subtle, #F2F4F6)', padding: '3px 7px', borderRadius: 6 }}>
          {confidenceLabel}
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-primary, #191F28)', lineHeight: 1.65, marginBottom: 10 }}>
        {flow.summary}
      </p>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {flow.evidence.map(item => (
          <span key={item} style={{ fontSize: 10.5, color: 'var(--text-secondary, #4E5968)', background: 'var(--bg-subtle, #F2F4F6)', padding: '4px 7px', borderRadius: 6 }}>
            {item}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #8B95A1)', marginTop: 9, lineHeight: 1.5 }}>
        종목 {flow.coverage.available}/{flow.coverage.total}개 당일 등락률 · 섹터 중앙값과 상승 종목 비율 기준 · 순환 신호는 관측값 해석이며 확정 판단이 아니에요
      </div>
    </div>
  );
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
function ChokCard({ pick, onAddWatch, inWatching, onFeedback, feedbackGiven }: {
  pick: ChokPick;
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

      {/* Key metric chip + 카드 인라인 면책 (캡처 시 함께 노출되도록) */}
      <div className="flex items-center justify-between gap-1.5">
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--brand-primary)',
            background: 'var(--color-info-bg, rgba(49,130,246,0.08))',
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          {pick.keyMetric}
        </div>
        <span
          title="관찰 후보일 뿐 매수·매도 권유가 아니에요. 투자 판단은 본인 책임."
          style={{ fontSize: 9, color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap' }}
        >
          ⓘ 정보용
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
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
            color: inWatching ? 'var(--text-tertiary, #B0B8C1)' : 'var(--brand-primary)',
            border: 'none',
          }}
        >
          {inWatching ? <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden="true" />둘러봄</span> : '둘러보기'}
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
        ><ThumbsUp size={13} aria-hidden="true" /></button>
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
        ><ThumbsDown size={13} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

// ==========================================
// Main section
// ==========================================
export default function AiChokSection() {
  const { addStock, stocks, macroData, currentEventId, getAllEvents } = usePortfolioStore();
  const [state, setState] = useState<ChokState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, 1 | -1>>({});
  const [loginForMore, setLoginForMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchedRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const inViewFiredRef = useRef(false);

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  /**
   * intent='fetch'  → 캐시/폴백만 (마운트, 타입 변경). AI 호출 X, 한도 차감 X.
   * intent='generate' → 사용자 명시 동작. AI 호출 + 한도 1회 차감.
   */
  const fetchChok = async (intent: 'fetch' | 'generate' = 'fetch') => {
    const force = intent === 'generate';
    if (force) trackChokInteraction('generate');
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 로그인 토큰 필수 — 서버(ai-chok/route.ts)는 Authorization Bearer로 getUser 검증해
      // 미인증 시 401 로그인 게이트를 반환한다. 이 헤더를 빠뜨리면 로그인한 유저도 '로그인하세요'가 뜬다(버그).
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const currentEvent = getAllEvents().find(e => e.id === currentEventId);
      const res = await fetch('/api/ai-chok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          intent,
          forceRefresh: force,
          macroContext: buildMacroContext(macroData),
          currentEvent: currentEvent ? `${currentEvent.emoji} ${currentEvent.name}` : '없음',
        }),
      });
      const data = await res.json() as ChokState & { error?: string; limitReached?: boolean; loginForMore?: boolean };

      if (!res.ok) {
        setError(data.error || '시장 관찰판을 불러오지 못했어요.');
        setLimitReached(!!data.limitReached);
        setLoginForMore(!!data.loginForMore);
        return;
      }
      setLimitReached(false);
      setLoginForMore(false);
      setState(data);
      if (data.picks?.length) {
        trackChokImpression({ count: data.picks.length, fallback: !!data.fallback, cached: !!data.cached, intent });
      }
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
  // 노출 측정(검증=측정) — 카드가 실제 뷰포트에 절반 이상 들어오면 1회 기록.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || inViewFiredRef.current) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !inViewFiredRef.current) {
          inViewFiredRef.current = true;
          trackChokInView();
          io.disconnect();
        }
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handleFeedback = async (symbol: string, rating: 1 | -1) => {
    if (feedbacks[symbol]) return; // 이미 응답함
    trackChokInteraction('feedback', symbol, { rating });
    setFeedbacks(prev => ({ ...prev, [symbol]: rating }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return; // 비로그인 무시 (서버에서도 401)
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: 'ai-chok', symbol, rating, context: { surface: 'shared-market-observation' } }),
      });
    } catch { /* silent */ }
  };

  const handleAddWatch = (pick: ChokPick) => {
    if (watchingSet.has(pick.symbol)) return;
    trackChokInteraction('watch', pick.symbol);
    addStock('watching', {
      symbol: pick.symbol,
      avgCost: 0,
      shares: 0,
      targetReturn: 0,
      buyBelow: 0,
    });
  };

  return (
    <section ref={sectionRef} data-tour="ai-chok" style={{ marginBottom: 28 }}>
      {/* Header row */}
      <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
        <div>
          <div className="flex items-center" style={{ gap: 6 }}>
            <Target size={16} aria-hidden="true" color="var(--brand-primary)" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              오늘 시장 흐름
            </h2>
            {state && (state.fallback || state.stale || state.cached) && (() => {
              // 우선순위: fallback > stale > cached
              const isFallback = state.fallback;
              const isStale = !isFallback && state.stale;
              const label = isFallback
                ? '공개 기준'
                : isStale
                  ? `이전 ${state.sessionLabel || ''}`.trim()
                  : (state.sessionLabel || '오늘 기준');
              const fg = isFallback ? '#FF9500' : isStale ? '#8B95A1' : 'var(--text-tertiary, #B0B8C1)';
              const bg = isFallback ? 'rgba(255,149,0,0.10)' : 'var(--bg-subtle, #F2F4F6)';
              const tip = isFallback
                ? '모든 사용자에게 같은 객관 수치 기준을 적용한 목록이에요.'
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
            지수·섹터 등락률과 상승 종목 비율로 시장의 상대 강약을 설명해요
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
              color: 'var(--brand-primary)',
              background: state.fallback || state.stale ? 'var(--color-info-bg, rgba(49,130,246,0.08))' : 'none',
              border: 'none',
              padding: state.fallback || state.stale ? '6px 10px' : '4px 0',
              borderRadius: state.fallback || state.stale ? 8 : 0,
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            시장 데이터 갱신
            <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 2 }}>
              · 오늘 {state.remaining}/{state.dailyLimit ?? 1}
            </span>
          </button>
        )}
      </div>

      {!loading && !error && state?.marketFlow && <MarketFlowSummary flow={state.marketFlow} />}

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            {limitReached
              ? <Target size={20} aria-hidden="true" color="var(--brand-primary)" />
              : <CircleAlert size={20} aria-hidden="true" color="var(--text-tertiary, #8B95A1)" />}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
            {error}
          </p>
          {loginForMore ? (
            <div style={{ marginTop: 12 }}>
              {/* 게스트 value-first 게이트 — 티커 없는 descriptive 설명만(§6: 익명 공개에 종목 예시 비노출) */}
              <p style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', lineHeight: 1.55, marginBottom: 10 }}>
                오늘 시장 흐름은 모든 사용자에게 같은 공개 지표로 설명해요.
              </p>
              <button
                onClick={() => {
                  logTourEvent('demo_to_login', { from: 'ai-chok' });
                  window.dispatchEvent(new CustomEvent('open-login'));
                }}
                style={{
                  padding: '9px 22px', borderRadius: 8,
                  background: 'var(--brand-primary)', color: 'var(--on-brand-fg)', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                로그인하고 시작
              </button>
            </div>
          ) : (
            !limitReached && (
              <button
                onClick={() => fetchChok('fetch')}
                className="cursor-pointer"
                style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', background: 'none', border: 'none', padding: 0 }}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #4E5968)', marginBottom: 8 }}>
            함께 확인할 시장 항목
          </div>
          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {state.picks.map(pick => (
              <div key={pick.symbol} style={{ scrollSnapAlign: 'start' }}>
                <ChokCard
                  pick={pick}
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
          <AiResultMeta meta={state._meta} source="ai-chok" />
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
          <Target size={20} aria-hidden="true" color="var(--text-tertiary, #8B95A1)" style={{ margin: '0 auto 6px' }} />
          <p style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>
            현재 기준에 맞는 관찰 항목을 찾지 못했어요.
          </p>
          <button
            onClick={() => fetchChok('generate')}
            className="cursor-pointer"
            style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', background: 'none', border: 'none', padding: 0 }}
          >
            시장 데이터 다시 확인
          </button>
        </div>
      )}
    </section>
  );
}
