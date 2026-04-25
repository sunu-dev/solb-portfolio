'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';

/**
 * 매매 패턴 거울 — "당신의 결정"을 거울로 비춰주는 컴포넌트.
 *
 * 데이터 소스: 각 stock의 notes (StockNote[]) — 매수/추가매수/매도/평단수정 시 작성됨
 * 핵심 가치: "감정 태그별 성과 차이" → 분석(🤔) vs 충동(😤)이 실제 어떻게 다른지 본인 데이터로 거울 효과
 *
 * 토스가 절대 못 만드는 "매수 이유 → 결과" 회고 루프의 핵심 표면.
 */

const EMOJI_LABELS: Record<string, string> = {
  '🤔': '분석 후',
  '😤': '충동',
  '🎯': '목표 달성',
  '📰': '뉴스 보고',
  '💡': '인사이트',
};

const ACTION_RE = {
  buy:  /^\[\+?\d+\s*주\s*(추가\s*)?매수\]/,
  sell: /^\[\d+\s*주\s*매도\]/,
  edit: /^\[평단\s*수정\]/,
  first: /^\[첫\s*매수\]/,
};

function parseAction(text: string): 'buy' | 'sell' | 'edit' | 'other' {
  if (ACTION_RE.first.test(text) || ACTION_RE.buy.test(text)) return 'buy';
  if (ACTION_RE.sell.test(text)) return 'sell';
  if (ACTION_RE.edit.test(text)) return 'edit';
  return 'other';
}

function findPriceAtDate(candles: CandleRaw | undefined, ts: number): number | null {
  if (!candles?.t?.length || !candles?.c?.length) return null;
  for (let i = candles.t.length - 1; i >= 0; i--) {
    if (candles.t[i] <= ts) return candles.c[i] || null;
  }
  return null;
}

interface Decision {
  symbol: string;
  date: Date;
  emoji: string;
  text: string;
  action: 'buy' | 'sell' | 'edit' | 'other';
  outcomePct?: number;
}

export default function TradePatternMirror() {
  const { stocks, macroData, rawCandles, setAnalysisSymbol } = usePortfolioStore();

  const stats = useMemo(() => {
    const all = [
      ...(stocks.investing || []),
      ...(stocks.sold || []),
    ];

    const decisions: Decision[] = [];
    for (const stock of all) {
      const q = macroData[stock.symbol] as QuoteData | undefined;
      const currentPrice = q?.c || 0;
      const candles = rawCandles[stock.symbol];
      for (const note of (stock.notes || [])) {
        const isoPart = note.date.split('_')[0];
        const date = new Date(isoPart);
        if (isNaN(date.getTime())) continue;
        const action = parseAction(note.text);
        const priceThen = findPriceAtDate(candles, date.getTime() / 1000);
        const outcomePct = priceThen && priceThen > 0 && currentPrice > 0
          ? ((currentPrice - priceThen) / priceThen) * 100
          : undefined;
        decisions.push({
          symbol: stock.symbol,
          date,
          emoji: note.emoji,
          text: note.text,
          action,
          outcomePct,
        });
      }
    }

    const total = decisions.length;
    const buys = decisions.filter(d => d.action === 'buy').length;
    const sells = decisions.filter(d => d.action === 'sell').length;

    // 감정 태그별 그룹 + 평균 outcome
    const byEmoji: Record<string, { count: number; outcomes: number[] }> = {};
    for (const d of decisions) {
      const key = d.emoji;
      if (!byEmoji[key]) byEmoji[key] = { count: 0, outcomes: [] };
      byEmoji[key].count++;
      if (d.outcomePct !== undefined) byEmoji[key].outcomes.push(d.outcomePct);
    }

    const emojiStats = Object.entries(byEmoji).map(([emoji, { count, outcomes }]) => ({
      emoji,
      label: EMOJI_LABELS[emoji] || '기타',
      count,
      avgOutcome: outcomes.length > 0
        ? outcomes.reduce((s, n) => s + n, 0) / outcomes.length
        : null,
    })).sort((a, b) => b.count - a.count);

    const withOutcome = decisions.filter(d => d.outcomePct !== undefined);
    const sortedByOutcome = [...withOutcome].sort((a, b) => (b.outcomePct! - a.outcomePct!));
    const avgOutcome = withOutcome.length > 0
      ? withOutcome.reduce((s, d) => s + d.outcomePct!, 0) / withOutcome.length
      : null;

    // best/worst 분리 — 결정 1건이면 부호에 따라 한쪽에만 들어감
    let best: Decision | null = null;
    let worst: Decision | null = null;
    if (withOutcome.length === 1) {
      const only = withOutcome[0];
      if (only.outcomePct! >= 0) best = only;
      else worst = only;
    } else if (withOutcome.length >= 2) {
      best = sortedByOutcome[0];
      worst = sortedByOutcome[sortedByOutcome.length - 1];
    }

    return {
      total, buys, sells,
      emojiStats,
      best,
      worst,
      avgOutcome,
      withOutcomeCount: withOutcome.length,
    };
  }, [stocks.investing, stocks.sold, macroData, rawCandles]);

  // 메모 0건 — 컴포넌트 자체 숨김 (인사이트 탭의 다른 섹션이 채워줌)
  if (stats.total === 0) return null;

  // ─── 핵심 인사이트 한 문장 — 충동 vs 분석 같은 비교 또는 결과 요약
  // 평균 비교 인사이트는 양쪽 표본이 각각 ≥2건일 때만 (1건짜리 평균은 통계적 의미 없음)
  const headline = (() => {
    const impulse = stats.emojiStats.find(e => e.emoji === '😤');
    const analysis = stats.emojiStats.find(e => e.emoji === '🤔');
    if (
      impulse && analysis
      && impulse.avgOutcome !== null && analysis.avgOutcome !== null
      && impulse.count >= 2 && analysis.count >= 2
    ) {
      const diff = analysis.avgOutcome - impulse.avgOutcome;
      const better = diff >= 0;
      return better
        ? `🤔 분석 후 결정이 😤 충동보다 평균 ${Math.abs(diff).toFixed(1)}%p 좋았어요`
        : `😤 충동 결정이 🤔 분석보다 평균 ${Math.abs(diff).toFixed(1)}%p 높네요. 흥미로워요`;
    }
    if (stats.withOutcomeCount === 1 && stats.avgOutcome !== null) {
      const sign = stats.avgOutcome >= 0 ? '+' : '';
      return `1건 추적 중 — ${sign}${stats.avgOutcome.toFixed(1)}%. 결정이 쌓일수록 패턴이 보여요`;
    }
    if (stats.avgOutcome !== null) {
      const sign = stats.avgOutcome >= 0 ? '+' : '';
      return `${stats.withOutcomeCount}건 평균 ${sign}${stats.avgOutcome.toFixed(1)}%`;
    }
    return `지금까지 ${stats.total}건의 결정을 기록했어요`;
  })();

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '20px 18px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>🪞</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            DECISION MIRROR
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            나의 결정 거울
          </div>
        </div>
      </div>

      {/* 헤드라인 한 줄 */}
      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--bg-subtle, #F8F9FA)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary, #191F28)',
          lineHeight: 1.5,
        }}
      >
        {headline}
      </div>

      {/* 핵심 통계 3열 */}
      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <StatCard
          label="총 결정"
          value={String(stats.total)}
          sub={`매수 ${stats.buys} · 매도 ${stats.sells}`}
        />
        <StatCard
          label={stats.withOutcomeCount === 1 ? '결과' : '평균 결과'}
          value={
            stats.avgOutcome !== null
              ? `${stats.avgOutcome >= 0 ? '+' : ''}${stats.avgOutcome.toFixed(1)}%`
              : '—'
          }
          sub={
            stats.avgOutcome !== null
              ? `${stats.withOutcomeCount}건 추적`
              : '결정 후 시간 필요'
          }
          tone={
            stats.avgOutcome === null ? 'neutral'
            : stats.avgOutcome >= 0 ? 'gain' : 'loss'
          }
        />
        <StatCard
          label="가장 많이 쓴"
          value={stats.emojiStats[0]?.emoji || '—'}
          sub={
            stats.emojiStats[0]
              ? `${stats.emojiStats[0].label} · ${stats.emojiStats[0].count}건`
              : '—'
          }
        />
      </div>

      {/* 감정 태그별 결과 — 가장 핵심 인사이트 */}
      {stats.emojiStats.some(e => e.avgOutcome !== null) && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-tertiary, #B0B8C1)',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}>
            감정 태그별 결과
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.emojiStats.map(e => (
              <div
                key={e.emoji}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'var(--bg-subtle, #F8F9FA)',
                }}
              >
                <span style={{ fontSize: 16 }}>{e.emoji}</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary, #191F28)',
                  flex: 1,
                  minWidth: 0,
                }}>
                  {e.label}
                </span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary, #B0B8C1)',
                  fontFamily: "'SF Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {e.count}건
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'SF Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 56,
                  textAlign: 'right',
                  color: e.avgOutcome === null
                    ? 'var(--text-tertiary, #B0B8C1)'
                    : e.avgOutcome >= 0
                    ? 'var(--color-gain, #EF4452)'
                    : 'var(--color-loss, #3182F6)',
                }}>
                  {e.avgOutcome === null
                    ? '—'
                    : `${e.avgOutcome >= 0 ? '+' : ''}${e.avgOutcome.toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최고/최악 결정 — 부호에 맞게 라벨 적응 (양수만 있으면 "가장 덜 오른"/"가장 잘 오른") */}
      {(stats.best || stats.worst) && (
        <div style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: stats.best && stats.worst ? '1fr 1fr' : '1fr',
          gap: 8,
        }}>
          {stats.best && (
            <DecisionHighlight
              icon={stats.best.outcomePct! >= 0 ? '🏆' : '🌱'}
              label={stats.best.outcomePct! >= 0 ? '가장 좋았던' : '가장 덜 내린'}
              decision={stats.best}
              onClick={() => setAnalysisSymbol(stats.best!.symbol)}
            />
          )}
          {stats.worst && stats.worst !== stats.best && (
            <DecisionHighlight
              icon={stats.worst.outcomePct! < 0 ? '💧' : '🐢'}
              label={stats.worst.outcomePct! < 0 ? '가장 아팠던' : '가장 덜 오른'}
              decision={stats.worst}
              onClick={() => setAnalysisSymbol(stats.worst!.symbol)}
            />
          )}
        </div>
      )}

      {/* 안내 — 매수 시 메모 한 줄 적기 유도 */}
      {stats.total < 3 && (
        <div style={{
          marginTop: 14,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--color-info-bg, rgba(49,130,246,0.06))',
          border: '1px solid rgba(49,130,246,0.12)',
          fontSize: 11,
          lineHeight: 1.5,
          color: 'var(--text-secondary, #4E5968)',
        }}>
          💡 매수·매도 시 한 줄 이유를 남기면 거울이 더 정확해져요. 시간이 쌓일수록 진짜 내 패턴이 보여요.
        </div>
      )}
    </div>
  );
}

// ─── Sub: 통계 카드 ─────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, tone = 'neutral',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'gain' | 'loss' | 'neutral';
}) {
  const valueColor =
    tone === 'gain' ? 'var(--color-gain, #EF4452)'
    : tone === 'loss' ? 'var(--color-loss, #3182F6)'
    : 'var(--text-primary, #191F28)';

  return (
    <div
      style={{
        padding: '12px 10px',
        borderRadius: 12,
        background: 'var(--bg-subtle, #F8F9FA)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: valueColor,
          fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Sub: 결정 하이라이트 카드 ───────────────────────────────────────────────
function DecisionHighlight({
  icon, label, decision, onClick,
}: {
  icon: string;
  label: string;
  decision: Decision;
  onClick: () => void;
}) {
  const kr = STOCK_KR[decision.symbol] || decision.symbol;
  const pct = decision.outcomePct ?? 0;
  const tone = pct >= 0 ? 'gain' : 'loss';
  const color = tone === 'gain' ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';

  // 메모에서 사용자 입력 부분만 추출 (전부 표시 시 '[+5주 매수] 실적...' 형태)
  const userPart = decision.text.replace(/^\[[^\]]+\]\s*/, '').trim();
  const display = userPart.length > 22 ? userPart.slice(0, 22) + '…' : userPart;

  const daysAgo = Math.round((Date.now() - decision.date.getTime()) / (1000 * 86400));

  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)',
          fontFamily: "'SF Mono', monospace",
        }}>
          {decision.symbol}
        </span>
        <span style={{
          fontSize: 14, fontWeight: 800, color,
          fontFamily: "'SF Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
        }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-secondary, #4E5968)',
        lineHeight: 1.4, wordBreak: 'keep-all',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {decision.emoji} &ldquo;{display || kr}&rdquo;
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 4 }}>
        {daysAgo}일 전 · {kr}
      </div>
    </button>
  );
}
