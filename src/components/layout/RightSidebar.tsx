'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import { CHOK_KR_MAP } from '@/config/chokUniverse';
import type { QuoteData } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Plus } from 'lucide-react';
import UndoToast from '@/components/common/UndoToast';
import { isAlertSuppressed } from '@/utils/alertLearning';
import AlertGroup from '@/components/common/AlertGroup';

interface ChokPick {
  symbol: string;
  krName: string;
  reason: string;
  keyMetric: string;
}

type AlertFilter = 'all' | 'risk' | 'opportunity' | 'insight';

const ALERT_TABS: { id: AlertFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'risk', label: '리스크' },
  { id: 'opportunity', label: '주목' },
  { id: 'insight', label: '인사이트' },
];

function filterAlerts(alerts: Alert[], filter: AlertFilter): Alert[] {
  if (filter === 'all') return alerts;
  if (filter === 'risk') return alerts.filter(a => a.type === 'urgent' || a.type === 'risk');
  if (filter === 'opportunity') return alerts.filter(a => a.type === 'opportunity' || a.type === 'celebrate');
  if (filter === 'insight') return alerts.filter(a => a.type === 'insight');
  return alerts;
}

export default function RightSidebar() {
  const { stocks, macroData, setAnalysisSymbol, recentSymbols, currency, alerts, dismissedAlerts, dismissAlert, dismissAllAlerts, undoDismissAll, bumpSnoozeTick, getAllSymbols, addStock } = usePortfolioStore();
  // 글로벌 통화 토글 연동 — 미국 종목만 환산(한국 종목은 이미 KRW라 이중환산 방지)
  const usdKrw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value || 1400;
  const [undoToast, setUndoToast] = useState<{ count: number } | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [watchSort, setWatchSort] = useState<'added' | 'movement'>('added'); // 관심 점검 순서
  // ai-chok은 AiChokSection에서만 fetch — 중복 Gemini 호출 방지
  const [chokPick] = useState<ChokPick | null>(null);

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  const watchingStocks = stocks.watching || [];

  // 점검 순서 정렬 — '많이 움직인 순'(절대 등락률 = abs(dp), 미로딩은 바닥). 추천·서열 아님(방향0).
  const moveAbs = (sym: string) => {
    const d = macroData[sym] as QuoteData | undefined;
    return d?.c ? Math.abs(d.dp ?? 0) : -1;
  };
  const sortedWatching = watchSort === 'movement'
    ? [...watchingStocks].sort((a, b) => moveAbs(b.symbol) - moveAbs(a.symbol))
    : watchingStocks;

  // 최근 본 종목 — 관심에 이미 있는 건 제외(중복 회피). descriptive 재진입(점수·배지 없음).
  const recentChips = recentSymbols.filter((s) => !watchingSet.has(s)).slice(0, 6);

  // '오늘 한 줄' — 관심 top mover의 RAG-grounded descriptive 해설(방향0).
  // §6 게이트: /api/mover-note가 DIGEST_RAG_EXPLANATION on일 때만 note 반환(아니면 null=무노출, dormant).
  const topMoverSymbol = useMemo(() => {
    let best: string | null = null;
    let bestAbs = 0;
    for (const s of watchingStocks) {
      const a = moveAbs(s.symbol);
      if (a > bestAbs) { bestAbs = a; best = s.symbol; }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchingStocks, macroData]);
  const [moverNote, setMoverNote] = useState<{ symbol: string; note: string } | null>(null);
  useEffect(() => {
    if (!topMoverSymbol) { setMoverNote(null); return; }
    const kr = STOCK_KR[topMoverSymbol];
    if (!kr) { setMoverNote(null); return; } // 한글명 없으면 질의 안 함(동일명 환각 방어)
    let alive = true;
    fetch(`/api/mover-note?name=${encodeURIComponent(kr)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setMoverNote(d?.note ? { symbol: topMoverSymbol, note: d.note } : null); })
      .catch(() => { if (alive) setMoverNote(null); });
    return () => { alive = false; };
  }, [topMoverSymbol]);

  const visibleAlerts = alerts
    .filter(a => !dismissedAlerts.includes(a.id))
    // 학습: 반복 해제된 타입 자동 숨김 (단 urgent는 항상 표시)
    .filter(a => a.severity === 1 || !isAlertSuppressed(a.id))
    .sort((a, b) => a.severity - b.severity);

  const filteredAlerts = filterAlerts(visibleAlerts, alertFilter);

  return (
    <div>
      {/* 관심 종목 header */}
      <div className="flex items-center gap-1.5">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>관심 종목</h3>
        <span className="text-[13px] text-[#B0B8C1] font-normal">{watchingStocks.length}</span>
        {watchingStocks.length > 1 && (
          <button
            onClick={() => setWatchSort((s) => (s === 'added' ? 'movement' : 'added'))}
            aria-label="관심 종목 점검 순서 정렬"
            className="ml-auto text-[11px] font-medium cursor-pointer hover:text-[var(--text-secondary)]"
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #B0B8C1)', padding: '2px 4px' }}
          >
            {watchSort === 'added' ? '추가순' : '많이 움직인 순'}
          </button>
        )}
      </div>

      {/* 오늘 한 줄 — top mover RAG 해설(방향0, §6 게이트 통과분만). 플래그 off면 렌더 안 됨 */}
      {moverNote && (
        <div className="mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary, #8B95A1)', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 8, padding: '8px 10px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{STOCK_KR[moverNote.symbol] || moverNote.symbol}</span> · {moverNote.note}
        </div>
      )}

      {/* Watching stock list */}
      <div className="mt-6">
        {sortedWatching.map((stock, idx) => {
          const q = macroData[stock.symbol] as QuoteData | undefined;
          const price = q?.c ?? 0;
          const dp = q?.dp ?? 0;
          const isGain = dp >= 0;
          const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
          const kr = STOCK_KR[stock.symbol] || stock.symbol;
          const avatarColor = getAvatarColor(stock.symbol);
          const hasData = price > 0;

          return (
            <button
              key={stock.symbol}
              onClick={() => setAnalysisSymbol(stock.symbol)}
              className={`w-full flex items-center cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[var(--surface-hover)] transition-colors text-left rounded-xl ${
                idx > 0 ? 'border-t border-[#F7F8FA] dark:border-[var(--border-light)]' : ''
              }`}
              style={{ gap: '14px', padding: '14px 4px' }}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: avatarColor }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  {stock.symbol.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] truncate">{kr}</div>
                <div className="text-[11px] text-[#B0B8C1]">
                  {stock.symbol}
                  {stock.buyBelow ? ` · 목표 $${stock.buyBelow}` : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                {hasData ? (
                  <>
                    <div className="text-[13px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] tabular-nums">
                      {isKR
                        ? `${Math.round(price).toLocaleString()}원`
                        : currency === 'KRW'
                          ? `${Math.round(price * usdKrw).toLocaleString()}원`
                          : `$${price.toFixed(2)}`}
                    </div>
                    <div className={`text-[11px] font-medium tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {isGain ? '▲' : '▼'} {isGain ? '+' : ''}{dp.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <>
                    <div className="skeleton-shimmer" style={{ width: 56, height: 14, marginBottom: 4, marginLeft: 'auto' }} />
                    <div className="skeleton-shimmer" style={{ width: 40, height: 11, marginLeft: 'auto' }} />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Add button */}
      <button
        onClick={() => {
          const searchBtn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
          if (searchBtn) searchBtn.click();
        }}
        className="w-full flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-[#D5DAE0] dark:border-[var(--border-light)] rounded-[12px] text-[13px] text-[#8B95A1] cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[var(--surface-hover)] transition-colors"
        style={{ marginTop: '20px', padding: '14px 0', minHeight: '44px' }}
      >
        <Plus className="w-3.5 h-3.5" />
        관심 종목 추가
      </button>

      {/* 최근 본 종목 — descriptive 재진입 칩 (점수·배지·추천 색채 없음) */}
      {recentChips.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="text-[11px] font-semibold text-[#B0B8C1]" style={{ marginBottom: 8 }}>최근 본</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {recentChips.map((sym) => (
              <button
                key={sym}
                onClick={() => setAnalysisSymbol(sym)}
                className="text-[12px] cursor-pointer hover:bg-[#EDEFF2] dark:hover:bg-[var(--surface-hover)]"
                style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)', border: 'none', whiteSpace: 'nowrap' }}
              >
                {STOCK_KR[sym] || sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================
          주비 AI 알림센터
          ============================================ */}
      <section
        id="solb-alert-center"
        role="region"
        aria-live="polite"
        aria-label={`주비 AI 알림 ${visibleAlerts.length}개`}
        style={{ marginTop: '40px' }}
      >
        {/* Header + badge */}
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>주비 AI</h3>
            {visibleAlerts.length > 0 && (
              <button
                onClick={() => {
                  const count = visibleAlerts.length;
                  dismissAllAlerts();
                  setUndoToast({ count });
                }}
                className="cursor-pointer"
                aria-label={`${visibleAlerts.length}개 알림 모두 읽음 처리`}
                style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', background: 'none', border: 'none', padding: '2px 6px' }}
              >
                전체 읽음
              </button>
            )}
          </div>
          {visibleAlerts.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: '#EF4452',
                borderRadius: '10px',
                padding: '2px 8px',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {visibleAlerts.length}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        {visibleAlerts.length > 0 && (
          <div role="tablist" aria-label="알림 카테고리 필터" className="flex scrollbar-hide" style={{ gap: 4, marginBottom: 12, overflowX: 'auto' }}>
            {ALERT_TABS.map(tab => {
              const isActive = alertFilter === tab.id;
              const count = filterAlerts(visibleAlerts, tab.id).length;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${tab.label} 필터${count > 0 ? ` (${count}개)` : ''}`}
                  onClick={() => setAlertFilter(tab.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    background: isActive ? 'var(--text-primary, #191F28)' : 'var(--bg-subtle, #F2F4F6)',
                    color: isActive ? '#fff' : 'var(--text-secondary, #8B95A1)',
                    border: 'none',
                  }}
                >
                  {tab.label}{count > 0 ? ` ${count}` : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Alert list */}
        {filteredAlerts.length > 0 ? (
          <AlertGroup
            alerts={filteredAlerts}
            onDismiss={dismissAlert}
            onSnooze={() => bumpSnoozeTick()}
            onAnalyze={setAnalysisSymbol}
          />
        ) : (
          <div
            style={{
              padding: '24px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(14,124,123,0.06), rgba(245,158,11,0.04))',
              border: '1px solid rgba(14,124,123,0.10)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 4 }}>
              알림이 없어요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
              포트폴리오에 특별한 상황이 없어요.{'\n'}안정적인 상태예요.
            </div>
          </div>
        )}
      </section>

      {/* ============================================
          AI 촉 티저 (사이드바 1개 미리보기)
          ============================================ */}
      {chokPick && (
        <div style={{ marginTop: 40 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>AI 촉</h3>
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--border-light, #F2F4F6)',
              padding: '14px 16px',
              background: 'var(--surface, #fff)',
            }}
          >
            {/* Pick header */}
            <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
              <div
                className="rounded-full shrink-0 flex items-center justify-center"
                style={{ width: 34, height: 34, background: getAvatarColor(chokPick.symbol) }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {chokPick.symbol.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {chokPick.symbol}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                  {STOCK_KR[chokPick.symbol] || CHOK_KR_MAP[chokPick.symbol] || chokPick.krName}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.55, marginBottom: 8 }}>
              {chokPick.reason}
            </div>

            {/* Key metric */}
            <div
              className="inline-block"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                background: 'var(--brand-primary-light)',
                padding: '3px 8px',
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {chokPick.keyMetric}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setAnalysisSymbol(chokPick.symbol)}
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
                onClick={() => {
                  if (!watchingSet.has(chokPick.symbol)) {
                    addStock('watching', { symbol: chokPick.symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
                  }
                }}
                disabled={watchingSet.has(chokPick.symbol)}
                className="cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-60"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  background: watchingSet.has(chokPick.symbol) ? 'var(--bg-subtle, #F2F4F6)' : 'var(--brand-primary-light)',
                  color: watchingSet.has(chokPick.symbol) ? 'var(--text-tertiary, #B0B8C1)' : 'var(--brand-primary)',
                  border: 'none',
                }}
              >
                {watchingSet.has(chokPick.symbol) ? '✓ 관심' : '+ 관심'}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6, lineHeight: 1.5 }}>
            AI의 발견이에요 · 투자 판단은 본인이
          </p>
        </div>
      )}

      {/* 전체 읽음 Undo 토스트 */}
      {undoToast && (
        <UndoToast
          message={`${undoToast.count}개 알림 읽음 처리됨`}
          onUndo={() => {
            undoDismissAll();
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}
