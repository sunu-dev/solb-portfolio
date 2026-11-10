'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatKrw, formatUsd, resolveUsdKrw } from '@/utils/koreanNumber';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Plus } from 'lucide-react';
import UndoToast from '@/components/common/UndoToast';
import { isAlertSuppressed } from '@/utils/alertLearning';
import AlertGroup from '@/components/common/AlertGroup';
import { convertStockAmount } from '@/utils/stockCurrency';
import { changeColor, roundedChange, signedChange } from '@/utils/stockTrendPresentation';

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
  const { stocks, macroData, setAnalysisSymbol, recentSymbols, currency, alerts, dismissedAlerts, dismissAlert, dismissAllAlerts, undoDismissAll, bumpSnoozeTick } = usePortfolioStore();
  // 글로벌 통화 토글 연동 — 미국 종목만 환산(한국 종목은 이미 KRW라 이중환산 방지)
  const usdKrw = resolveUsdKrw(macroData);
  const [undoToast, setUndoToast] = useState<{ count: number } | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [watchSort, setWatchSort] = useState<'added' | 'movement'>('added'); // 관심 점검 순서

  const watchingSet = new Set(stocks.watching.map(s => s.symbol));

  const watchingStocks = stocks.watching;

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
      const quote = macroData[s.symbol] as QuoteData | undefined;
      const a = quote?.c ? Math.abs(quote.dp ?? 0) : -1;
      if (a > bestAbs) { bestAbs = a; best = s.symbol; }
    }
    return best;
  }, [watchingStocks, macroData]);
  const [moverNote, setMoverNote] = useState<{ symbol: string; note: string } | null>(null);
  useEffect(() => {
    if (!topMoverSymbol) return;
    const kr = STOCK_KR[topMoverSymbol];
    if (!kr) return; // 한글명 없으면 질의 안 함(동일명 환각 방어)
    let alive = true;
    const controller = new AbortController();
    fetch(`/api/mover-note?name=${encodeURIComponent(kr)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { if (alive) setMoverNote(d?.note ? { symbol: topMoverSymbol, note: d.note } : null); })
      .catch(() => { if (alive) setMoverNote(null); });
    return () => { alive = false; controller.abort(); };
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
        <span className="text-[13px] text-[var(--text-secondary)] font-normal">{watchingStocks.length}</span>
        {watchingStocks.length > 1 && (
          <button
            onClick={() => setWatchSort((s) => (s === 'added' ? 'movement' : 'added'))}
            aria-label="관심 종목 점검 순서 정렬"
            className="ml-auto text-[12px] font-medium cursor-pointer hover:text-[var(--text-primary)]"
            style={{ background: 'none', border: 'none', color: 'var(--text-body)', padding: '8px', minHeight: 44 }}
          >
            {watchSort === 'added' ? '추가순' : '많이 움직인 순'}
          </button>
        )}
      </div>

      {/* 오늘 한 줄 — top mover RAG 해설(방향0, §6 게이트 통과분만). 플래그 off면 렌더 안 됨 */}
      {moverNote && moverNote.symbol === topMoverSymbol && (
        <div className="mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary, #8B95A1)', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: 8, padding: '8px 10px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{STOCK_KR[moverNote.symbol] || moverNote.symbol}</span> · {moverNote.note}
        </div>
      )}

      {/* Watching stock list */}
      <div style={{ marginTop: sortedWatching.length ? 12 : 0 }}>
        {sortedWatching.map((stock, idx) => {
          const q = macroData[stock.symbol] as QuoteData | undefined;
          const price = q?.c ?? 0;
          const dp = typeof q?.dp === 'number' && Number.isFinite(q.dp) ? q.dp : null;
          const movement = dp !== null ? roundedChange(dp, 2) : null;
          const kr = STOCK_KR[stock.symbol] || stock.symbol;
          const avatarColor = getAvatarColor(stock.symbol);
          const hasData = price > 0;
          const priceAmounts = convertStockAmount(
            stock.symbol,
            price,
            usdKrw,
            stock.currency,
          );
          const targetAmounts = convertStockAmount(
            stock.symbol,
            stock.buyBelow || 0,
            usdKrw,
            stock.currency,
          );

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
                <div className="text-[12px] text-[var(--text-secondary)]">
                  {stock.symbol}
                  {stock.buyBelow
                    ? ` · 목표 ${currency === 'KRW'
                      ? formatKrw(targetAmounts.krw, { prefix: false, suffix: '원', short: false })
                      : formatUsd(targetAmounts.usd)}`
                    : ''}
                </div>
              </div>
              <div className="text-right shrink-0">
                {hasData ? (
                  <>
                    <div className="text-[13px] font-semibold text-[#191F28] dark:text-[var(--text-primary)] tabular-nums">
                      {currency === 'KRW'
                        ? formatKrw(priceAmounts.krw, { prefix: false, suffix: '원', short: false })
                        : formatUsd(priceAmounts.usd)}
                    </div>
                    <div className="text-[12px] font-medium tabular-nums" style={{ color: movement !== null ? changeColor(movement, 2) : 'var(--text-secondary)' }}>
                      {movement !== null && dp !== null ? `${movement > 0 ? '▲ ' : movement < 0 ? '▼ ' : ''}${signedChange(dp, 2)}%` : '등락 미확인'}
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
        className="w-full flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-[#D5DAE0] dark:border-[var(--border-light)] rounded-[12px] text-[13px] text-[var(--text-body)] cursor-pointer hover:bg-[#F9FAFB] dark:hover:bg-[var(--surface-hover)] transition-colors"
        style={{ marginTop: sortedWatching.length ? 16 : 12, padding: '12px 0', minHeight: '44px' }}
      >
        <Plus className="w-3.5 h-3.5" />
        관심 회사 찾기
      </button>

      {/* 최근 본 종목 — descriptive 재진입 칩 (점수·배지·추천 색채 없음) */}
      {recentChips.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="text-[12px] font-semibold text-[var(--text-secondary)]" style={{ marginBottom: 8 }}>최근 본</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {recentChips.map((sym) => (
              <button
                key={sym}
                onClick={() => setAnalysisSymbol(sym)}
                className="text-[12px] cursor-pointer hover:bg-[#EDEFF2] dark:hover:bg-[var(--surface-hover)]"
                style={{ padding: '8px 12px', minHeight: 44, borderRadius: 999, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)', border: 'none', whiteSpace: 'nowrap' }}
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
        tabIndex={-1}
        role="region"
        aria-live="polite"
        aria-label={`내 종목 알림 ${visibleAlerts.length}개`}
        style={{ marginTop: '40px' }}
      >
        {/* Header + badge */}
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>내 종목 알림</h3>
            {visibleAlerts.length > 0 && (
              <button
                onClick={() => {
                  const count = visibleAlerts.length;
                  dismissAllAlerts();
                  setUndoToast({ count });
                }}
                className="cursor-pointer"
                aria-label={`${visibleAlerts.length}개 알림 모두 읽음 처리`}
                style={{ fontSize: 12, color: 'var(--text-body)', background: 'none', border: 'none', padding: '8px', minHeight: 44 }}
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
                color: 'var(--pill-active-fg)',
                background: 'var(--pill-active-bg)',
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
          <div role="group" aria-label="알림 카테고리 필터" className="flex scrollbar-hide" style={{ gap: 4, marginBottom: 12, overflowX: 'auto' }}>
            {ALERT_TABS.map(tab => {
              const isActive = alertFilter === tab.id;
              const count = filterAlerts(visibleAlerts, tab.id).length;
              return (
                <button
                  key={tab.id}
                  aria-pressed={isActive}
                  aria-label={`${tab.label} 필터${count > 0 ? ` (${count}개)` : ''}`}
                  onClick={() => setAlertFilter(tab.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    padding: '8px 14px', minHeight: 44,
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    background: isActive ? 'var(--text-primary, #191F28)' : 'var(--bg-subtle, #F2F4F6)',
                    color: isActive ? 'var(--pill-active-fg, #fff)' : 'var(--text-secondary, #8B95A1)',
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
          <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.7, margin: 0 }}>
            {visibleAlerts.length ? '이 분류의 새 알림은 없어요.' : '표시할 새 알림이 없어요.'}
          </p>
        )}
      </section>

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
