'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { computeVolBaseline, computeZScore } from '@/utils/volatility';

/**
 * Conversational Timeline
 * 포트폴리오 상태를 주비 AI의 내러티브 메시지로 변환하여 채팅 형태로 보여줌.
 * 숫자 → 이야기 번역으로 감정적 몰입 유도.
 *
 * 메시지 생성 규칙:
 * 1. 오늘 가장 많이 오른/내린 종목 언급
 * 2. 목표/손절선 근접 경고
 * 3. 52주 고점/저점 근접
 * 4. 30일 추세 요약
 * 5. 전반적 포트폴리오 기상도
 */

interface Message {
  id: string;
  type: 'greeting' | 'alert' | 'insight' | 'story' | 'summary';
  text: string;
  symbol?: string; // 관련 종목 (클릭 시 분석 열림)
  emphasis?: 'positive' | 'negative' | 'warning' | 'neutral';
  timestamp?: string;
}

export default function ConversationalTimeline() {
  const { stocks, macroData, rawCandles, currency, setAnalysisSymbol } = usePortfolioStore();
  const [isOpen, setIsOpen] = useState(false);

  const messages = useMemo<Message[]>(() => {
    const out: Message[] = [];
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    if (investing.length === 0) return [];

    const usdKrw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value || 1400;
    const fmt = (usd: number) => currency === 'KRW'
      ? formatKRW(Math.round(Math.abs(usd) * usdKrw))
      : `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    // ─── 1. 인사 ─────────────────────────────────────────────────────────
    const hour = new Date().getHours();
    const greeting = hour < 6 ? '새벽까지 깨어 계시네요'
      : hour < 12 ? '좋은 아침이에요'
      : hour < 18 ? '오늘 하루도 수고하셨어요'
      : '저녁이에요';
    out.push({
      id: 'greet',
      type: 'greeting',
      text: `${greeting}. 지금 내 포트폴리오 이야기를 들려드릴게요 🐘`,
    });

    // ─── 2. 오늘 가장 많이 움직인 종목 ───────────────────────────────────
    // P2 알고리즘 — 절대값 기준(±1%) → z-score 기반 정렬 + 강도 라벨
    type Mover = {
      symbol: string;
      dp: number;
      dollarChange: number;
      z: number | null;
      magnitude: number;
    };
    const movers: Mover[] = [];
    let totalTodayChange = 0;

    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c || q.dp == null) return;
      const shareChange = (q.d || 0) * s.shares;
      totalTodayChange += shareChange;
      const baseline = computeVolBaseline(rawCandles[s.symbol]);
      const z = computeZScore(q.dp, baseline);
      movers.push({
        symbol: s.symbol, dp: q.dp, dollarChange: shareChange, z,
        // 정렬 키 — z 있으면 z, 없으면 dp 자체 (단위 다름 명시 위해 z null로 구분)
        magnitude: z !== null ? z : q.dp / 3, // fallback: 3% = 약 1σ 가정
      });
    });

    const sortedByMag = [...movers].sort((a, b) => b.magnitude - a.magnitude);
    const bestMover = sortedByMag[0];
    const worstMover = sortedByMag[sortedByMag.length - 1];

    // 신호 강도 라벨 (z-score 기반)
    const sigmaPhrase = (z: number | null): string => {
      if (z === null) return '';
      const abs = Math.abs(z);
      if (abs >= 3) return ' (극단치 — 평소의 3σ 이상)';
      if (abs >= 2) return ' (평소 대비 이례적)';
      if (abs >= 1.5) return ' (평소보다 큰 움직임)';
      return '';
    };

    // best mover — z 신뢰 가능하면 |z| ≥ 1.2 (약 1σ 이상), 아니면 dp ≥ 1%
    const bestSignal = bestMover && (
      bestMover.z !== null ? bestMover.z >= 1.2 : bestMover.dp >= 1
    );
    if (bestSignal && bestMover) {
      const kr = STOCK_KR[bestMover.symbol] || bestMover.symbol;
      out.push({
        id: 'best-today',
        type: 'story',
        text: `오늘 ${kr}가 +${bestMover.dp.toFixed(2)}%${sigmaPhrase(bestMover.z)} 올라서 ${fmt(bestMover.dollarChange)}가 더해졌어요 ✨`,
        symbol: bestMover.symbol,
        emphasis: 'positive',
      });
    }

    const worstSignal = worstMover && worstMover.symbol !== bestMover?.symbol && (
      worstMover.z !== null ? worstMover.z <= -1.2 : worstMover.dp <= -1
    );
    if (worstSignal && worstMover) {
      const kr = STOCK_KR[worstMover.symbol] || worstMover.symbol;
      out.push({
        id: 'worst-today',
        type: 'story',
        text: `${kr}는 ${worstMover.dp.toFixed(2)}%${sigmaPhrase(worstMover.z)} 내려서 ${fmt(worstMover.dollarChange)} 줄었어요. 긴 호흡으로 보세요`,
        symbol: worstMover.symbol,
        emphasis: 'negative',
      });
    }

    // ─── 3. 목표/손절선 근접 경고 ────────────────────────────────────────
    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) return;
      const kr = STOCK_KR[s.symbol] || s.symbol;

      // 목표 수익률 근접
      if (s.avgCost > 0 && s.targetReturn > 0) {
        const currentPct = ((q.c - s.avgCost) / s.avgCost) * 100;
        const progress = (currentPct / s.targetReturn) * 100;
        if (progress >= 90 && progress < 110) {
          out.push({
            id: `target-${s.symbol}`,
            type: 'alert',
            text: `🎯 ${kr} 목표 수익률까지 거의 다 왔어요! (현재 ${currentPct.toFixed(1)}% / 목표 ${s.targetReturn}%)`,
            symbol: s.symbol,
            emphasis: 'positive',
          });
        } else if (progress >= 100) {
          out.push({
            id: `target-reached-${s.symbol}`,
            type: 'alert',
            text: `🎉 ${kr} 목표 수익률 달성! 수익 실현을 고민해볼 시점이에요`,
            symbol: s.symbol,
            emphasis: 'positive',
          });
        }
      }

      // 손절가 근접
      if (s.stopLoss && s.stopLoss > 0) {
        const distance = ((q.c - s.stopLoss) / q.c) * 100;
        if (distance < 5 && distance >= 0) {
          out.push({
            id: `stop-${s.symbol}`,
            type: 'alert',
            text: `⚠️ ${kr}가 손절가($${s.stopLoss})까지 ${distance.toFixed(1)}% 남았어요. 지켜보세요`,
            symbol: s.symbol,
            emphasis: 'warning',
          });
        } else if (distance < 0) {
          out.push({
            id: `stop-hit-${s.symbol}`,
            type: 'alert',
            text: `🔴 ${kr}가 손절가를 하회했어요. 원칙대로 판단하세요`,
            symbol: s.symbol,
            emphasis: 'negative',
          });
        }
      }
    });

    // ─── 4. 52주 고점/저점 근접 ──────────────────────────────────────────
    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const candles: CandleRaw | undefined = rawCandles[s.symbol];
      if (!q?.c || !candles?.c?.length) return;

      const high52 = Math.max(...candles.c);
      const low52 = Math.min(...candles.c);
      const kr = STOCK_KR[s.symbol] || s.symbol;

      const highDist = ((high52 - q.c) / q.c) * 100;
      const lowDist = ((q.c - low52) / q.c) * 100;

      if (highDist < 3) {
        out.push({
          id: `52h-${s.symbol}`,
          type: 'insight',
          text: `${kr}는 52주 고점에 거의 닿았어요. 추가 상승 여력은 신중히 판단`,
          symbol: s.symbol,
          emphasis: 'neutral',
        });
      } else if (lowDist < 3) {
        out.push({
          id: `52l-${s.symbol}`,
          type: 'insight',
          text: `${kr}는 52주 저점 근처예요. 분할 매수 기회가 될 수도 있어요`,
          symbol: s.symbol,
          emphasis: 'neutral',
        });
      }
    });

    // ─── 5. 오늘 포트폴리오 요약 (마지막) ────────────────────────────────
    if (totalTodayChange !== 0) {
      const pct = investing.reduce((total, s) => {
        const q = macroData[s.symbol] as QuoteData | undefined;
        return total + (q?.c || 0) * s.shares;
      }, 0);
      const basePct = pct - totalTodayChange;
      const pctChange = basePct > 0 ? (totalTodayChange / basePct) * 100 : 0;
      const dir = totalTodayChange >= 0 ? '🔥 불타는' : '🧊 조용한';
      out.push({
        id: 'summary',
        type: 'summary',
        text: `오늘 포트폴리오는 ${dir} 하루였어요. 총 ${totalTodayChange >= 0 ? '+' : '-'}${fmt(totalTodayChange)} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`,
        emphasis: totalTodayChange >= 0 ? 'positive' : 'negative',
      });
    }

    // 이야기가 너무 적으면 격려 한 줄
    if (out.length <= 2) {
      out.push({
        id: 'fallback',
        type: 'insight',
        text: '특별한 움직임은 없었어요. 꾸준함이 투자의 본질이에요 🌱',
        emphasis: 'neutral',
      });
    }

    return out;
  }, [stocks.investing, macroData, rawCandles, currency]);

  if (messages.length === 0) return null;

  // 미리보기 — 가장 우선순위 높은 메시지 한 줄 (alert > summary > 첫 story)
  const previewMsg =
    messages.find(m => m.type === 'alert')
    ?? messages.find(m => m.type === 'summary')
    ?? messages.find(m => m.type === 'story')
    ?? messages[0];
  const previewText = previewMsg.text.length > 36
    ? previewMsg.text.slice(0, 36) + '…'
    : previewMsg.text;

  return (
    <div
      style={{
        marginBottom: 32,
        padding: isOpen ? '20px' : '14px 18px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
        transition: 'padding 0.2s ease',
      }}
    >
      {/* 헤더 — 클릭하여 토글 */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        aria-controls="zubi-story-list"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          marginBottom: isOpen ? 16 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', flexShrink: 0 }}>
            💬 주비의 이야기
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--text-tertiary, #B0B8C1)',
            background: 'var(--bg-subtle, #F2F4F6)',
            padding: '2px 8px', borderRadius: 10,
            flexShrink: 0,
          }}>
            {messages.length}
          </span>
          {!isOpen && (
            <span style={{
              fontSize: 12,
              color: 'var(--text-secondary, #8B95A1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {previewText}
            </span>
          )}
        </div>
        <span
          aria-hidden
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary, #B0B8C1)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {/* 메시지 리스트 */}
      {isOpen && (
        <div
          id="zubi-story-list"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              message={m}
              index={i}
              onSymbolClick={m.symbol ? () => setAnalysisSymbol(m.symbol!) : undefined}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── 한 메시지 버블 ──────────────────────────────────────────────────────────
function ChatBubble({
  message, index, onSymbolClick,
}: {
  message: Message;
  index: number;
  onSymbolClick?: () => void;
}) {
  const accent =
    message.emphasis === 'positive' ? 'var(--color-gain, #EF4452)'
    : message.emphasis === 'negative' ? 'var(--color-loss, #3182F6)'
    : message.emphasis === 'warning' ? 'var(--color-warning, #FF9500)'
    : 'var(--text-secondary, #4E5968)';

  const bgColor =
    message.emphasis === 'positive' ? 'var(--color-gain-bg, rgba(239,68,82,0.06))'
    : message.emphasis === 'negative' ? 'var(--color-loss-bg, rgba(49,130,246,0.06))'
    : message.emphasis === 'warning' ? 'var(--color-warning-bg, rgba(255,149,0,0.06))'
    : 'var(--bg-subtle, #F8F9FA)';

  // avatar for main bubbles (symbol-related) vs zubi icon for narrative
  const hasSymbol = !!message.symbol;
  const avatarColor = hasSymbol && message.symbol ? getAvatarColor(message.symbol) : null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        opacity: 0,
        animation: `bubble-in 0.4s ease-out ${index * 0.08}s forwards`,
      }}
    >
      {/* 아바타 */}
      <div
        onClick={onSymbolClick}
        role={onSymbolClick ? 'button' : undefined}
        tabIndex={onSymbolClick ? 0 : undefined}
        style={{
          flexShrink: 0,
          width: 32, height: 32, borderRadius: '50%',
          background: avatarColor || 'linear-gradient(135deg, #3182F6, #AF52DE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
          cursor: onSymbolClick ? 'pointer' : 'default',
          boxShadow: onSymbolClick ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {hasSymbol && message.symbol ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{message.symbol.charAt(0)}</span>
        ) : (
          <span>🐘</span>
        )}
      </div>

      {/* 말풍선 */}
      <div
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 14,
          borderTopLeftRadius: 4, // 좌상단만 날카롭게 (chat tail)
          background: bgColor,
          borderLeft: `3px solid ${accent}`,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--text-primary, #191F28)',
          wordBreak: 'keep-all',
        }}
      >
        {message.text}
        {onSymbolClick && (
          <span
            onClick={onSymbolClick}
            className="cursor-pointer"
            style={{
              display: 'inline-block',
              marginLeft: 6,
              fontSize: 11,
              fontWeight: 600,
              color: accent,
              opacity: 0.8,
            }}
          >
            분석 →
          </span>
        )}
      </div>
    </div>
  );
}
