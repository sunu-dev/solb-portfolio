'use client';

import { useMemo, useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

declare global {
  interface Window {
    Kakao: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

/**
 * 월간 회고 카드 — 최근 30일 포트폴리오 여정을 한 장으로 요약
 * - 전체 수익률 / 최고의 종목 / 아쉬운 종목 / 가장 좋았던 하루 / 노트 활동
 */
export default function MonthlyReplay() {
  const { stocks, macroData, rawCandles, currency } = usePortfolioStore();
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

  // 카카오 SDK 초기화
  useEffect(() => {
    const initKakao = () => {
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (window.Kakao && key && !window.Kakao.isInitialized()) {
        window.Kakao.init(key);
        setKakaoReady(true);
      } else if (window.Kakao?.isInitialized()) {
        setKakaoReady(true);
      }
    };
    if (window.Kakao) { initKakao(); return; }
    const timer = setInterval(() => {
      if (window.Kakao) { initKakao(); clearInterval(timer); }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const replay = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    if (investing.length === 0) return null;

    // Retrospective 30일 전 총 가치
    const priceAtDaysAgo = (symbol: string, days: number): number | null => {
      const c: CandleRaw | undefined = rawCandles[symbol];
      if (!c?.t?.length || !c?.c?.length) return null;
      const targetTs = Date.now() / 1000 - days * 86400;
      for (let i = c.t.length - 1; i >= 0; i--) {
        if (c.t[i] <= targetTs) return c.c[i] || null;
      }
      return null;
    };

    let totalNow = 0;
    let total30dAgo = 0;
    let dataCoverage = 0;

    // 종목별 30일 수익률 계산
    interface StockPerf {
      symbol: string;
      shares: number;
      priceNow: number;
      price30dAgo: number;
      absReturn: number; // 달러 변동
      pctReturn: number;
    }
    const perfs: StockPerf[] = [];

    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const now = q?.c || 0;
      const past = priceAtDaysAgo(s.symbol, 30);
      if (now > 0 && past != null && past > 0) {
        totalNow += now * s.shares;
        total30dAgo += past * s.shares;
        dataCoverage++;
        const abs = (now - past) * s.shares;
        const pct = ((now - past) / past) * 100;
        perfs.push({ symbol: s.symbol, shares: s.shares, priceNow: now, price30dAgo: past, absReturn: abs, pctReturn: pct });
      }
    }

    if (perfs.length === 0) return null;

    const totalAbsReturn = totalNow - total30dAgo;
    const totalPctReturn = total30dAgo > 0 ? (totalAbsReturn / total30dAgo) * 100 : 0;

    // 최고/아쉬운 종목
    const sorted = [...perfs].sort((a, b) => b.pctReturn - a.pctReturn);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // 최고의 하루 — 포트폴리오 전체 일일 변동 분석 (있는 종목만)
    // 각 일별 합산 가격 → 이전 일 대비 delta 계산
    const dayMap: Record<number, number> = {}; // 타임스탬프 → 그 날 총가치
    const stocksWithCandles = investing.filter(s => rawCandles[s.symbol]?.c?.length);
    if (stocksWithCandles.length > 0) {
      // 공통 타임스탬프 세트 구하기
      const firstCandle = rawCandles[stocksWithCandles[0].symbol];
      const cutoffTs = Date.now() / 1000 - 30 * 86400;
      for (let i = firstCandle.t.length - 1; i >= 0; i--) {
        if (firstCandle.t[i] < cutoffTs) break;
        const ts = firstCandle.t[i];
        let dayTotal = 0;
        for (const s of stocksWithCandles) {
          const c = rawCandles[s.symbol];
          // 같은 날 찾기
          const idx = c.t.indexOf(ts);
          if (idx >= 0) dayTotal += c.c[idx] * s.shares;
        }
        if (dayTotal > 0) dayMap[ts] = dayTotal;
      }
    }

    const dayEntries = Object.entries(dayMap).map(([ts, val]) => ({ ts: Number(ts), val })).sort((a, b) => a.ts - b.ts);
    let bestDay: { date: string; deltaPct: number; deltaAbs: number } | null = null;
    for (let i = 1; i < dayEntries.length; i++) {
      const prev = dayEntries[i - 1].val;
      const curr = dayEntries[i].val;
      const deltaPct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      const deltaAbs = curr - prev;
      if (!bestDay || deltaPct > bestDay.deltaPct) {
        const d = new Date(dayEntries[i].ts * 1000);
        bestDay = {
          date: `${d.getMonth() + 1}월 ${d.getDate()}일`,
          deltaPct,
          deltaAbs,
        };
      }
    }

    // 노트 활동
    let totalNotes = 0;
    (['investing', 'watching', 'sold'] as const).forEach(cat => {
      (stocks[cat] || []).forEach(s => { totalNotes += (s.notes || []).length; });
    });

    // 추가 매수 — notes 중 이 달 적힌 것 카운트
    const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);
    let notesThisMonth = 0;
    (['investing', 'watching', 'sold'] as const).forEach(cat => {
      (stocks[cat] || []).forEach(s => {
        (s.notes || []).forEach(n => {
          const noteDate = new Date(n.date.split('_')[0]);
          if (noteDate >= thisMonthStart) notesThisMonth++;
        });
      });
    });

    return {
      totalAbsReturn,
      totalPctReturn,
      best,
      worst,
      bestDay,
      notesThisMonth,
      totalNotes,
      perfCount: perfs.length,
      coverage: dataCoverage / investing.length,
    };
  }, [stocks, macroData, rawCandles]);

  if (!replay) return null;

  const usdKrw = 1400; // 간단히 — macroData에서 가져와도 됨
  const isGain = replay.totalAbsReturn >= 0;
  const monthLabel = new Date().toLocaleDateString('ko-KR', { month: 'long' });

  const formatMoney = (usd: number) => {
    if (currency === 'KRW') return formatKRW(Math.round(usd * usdKrw));
    return `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '20px',
        borderRadius: 16,
        background: isGain
          ? 'linear-gradient(135deg, var(--color-gain-bg, rgba(239,68,82,0.06)) 0%, var(--color-purple-bg, rgba(175,82,222,0.05)) 100%)'
          : 'linear-gradient(135deg, var(--color-loss-bg, rgba(49,130,246,0.06)) 0%, var(--color-purple-bg, rgba(175,82,222,0.05)) 100%)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            MONTHLY REPLAY
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            {monthLabel}의 당신
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="월간 회고 공유"
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              color: '#fff',
              background: 'var(--text-primary, #191F28)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            공유 ↗
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? '간략히' : '자세히'}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              color: 'var(--text-secondary, #4E5968)',
              background: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border-light, #F2F4F6)',
              cursor: 'pointer',
            }}
          >
            {expanded ? '접기' : '펼치기'}
          </button>
        </div>
      </div>

      {/* 메인 수익률 */}
      <div
        style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'var(--surface, #FFFFFF)',
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 4 }}>
          지난 30일 전체 수익
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 26, fontWeight: 800,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            {isGain ? '+' : '-'}{formatMoney(Math.abs(replay.totalAbsReturn))}
          </span>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            ({isGain ? '+' : ''}{replay.totalPctReturn.toFixed(2)}%)
          </span>
        </div>
        {replay.coverage < 1 && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 4 }}>
            · {Math.round(replay.coverage * 100)}% 종목 기준 (데이터 로딩 중인 종목 제외)
          </div>
        )}
      </div>

      {/* 하이라이트 3개 */}
      <div
        className="replay-highlights"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        }}
      >
        <style>{`
          @media (max-width: 520px) {
            .replay-highlights { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* 최고의 종목 */}
        {replay.best && replay.best.pctReturn > 0 && (
          <HighlightCard
            emoji="🏆"
            label="최고의 종목"
            value={STOCK_KR[replay.best.symbol] || replay.best.symbol}
            sub={`+${replay.best.pctReturn.toFixed(1)}%`}
            subColor="gain"
            avatarSymbol={replay.best.symbol}
          />
        )}

        {/* 최고의 하루 */}
        {replay.bestDay && replay.bestDay.deltaPct > 0 && (
          <HighlightCard
            emoji="✨"
            label="최고의 하루"
            value={replay.bestDay.date}
            sub={`+${replay.bestDay.deltaPct.toFixed(2)}%`}
            subColor="gain"
          />
        )}

        {/* 아쉬운 종목 */}
        {replay.worst && replay.worst.pctReturn < -5 && (
          <HighlightCard
            emoji="😔"
            label="아쉬운 종목"
            value={STOCK_KR[replay.worst.symbol] || replay.worst.symbol}
            sub={`${replay.worst.pctReturn.toFixed(1)}%`}
            subColor="loss"
            avatarSymbol={replay.worst.symbol}
          />
        )}

        {/* 노트 활동 (아쉬운 종목 없을 때) */}
        {replay.notesThisMonth > 0 && !(replay.worst && replay.worst.pctReturn < -5) && (
          <HighlightCard
            emoji="📝"
            label="이달의 기록"
            value={`메모 ${replay.notesThisMonth}개`}
            sub="복기 자산"
            subColor="info"
          />
        )}
      </div>

      {/* 펼쳐서 상세 */}
      {expanded && (
        <div style={{ marginTop: 14, padding: '14px', borderRadius: 10, background: 'var(--surface, #FFFFFF)', fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 6, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>📊 한 달 요약</div>
          <div>· 분석 대상: {replay.perfCount}개 종목 (30일 전 데이터 확보분)</div>
          <div>· 포트폴리오 총 변동: {isGain ? '+' : ''}{formatMoney(replay.totalAbsReturn)} ({replay.totalPctReturn.toFixed(2)}%)</div>
          {replay.best && <div>· 최고 수익: {STOCK_KR[replay.best.symbol] || replay.best.symbol} {replay.best.pctReturn >= 0 ? '+' : ''}{replay.best.pctReturn.toFixed(1)}%</div>}
          {replay.worst && replay.worst !== replay.best && <div>· 최저 수익: {STOCK_KR[replay.worst.symbol] || replay.worst.symbol} {replay.worst.pctReturn >= 0 ? '+' : ''}{replay.worst.pctReturn.toFixed(1)}%</div>}
          {replay.bestDay && <div>· 최고의 하루: {replay.bestDay.date} ({replay.bestDay.deltaPct >= 0 ? '+' : ''}{replay.bestDay.deltaPct.toFixed(2)}%)</div>}
          <div>· 기록한 메모: 이번 달 {replay.notesThisMonth}개 / 누적 {replay.totalNotes}개</div>
        </div>
      )}

      {/* 공유 모달 */}
      {shareOpen && (() => {
        const appUrl = 'https://solb-portfolio.vercel.app';
        const shareText = `${monthLabel}의 내 포트폴리오\n\n📊 30일 수익 ${isGain ? '+' : ''}${replay.totalPctReturn.toFixed(2)}%\n💰 ${formatMoney(replay.totalAbsReturn)}${replay.best ? `\n🏆 최고: ${STOCK_KR[replay.best.symbol] || replay.best.symbol} ${replay.best.pctReturn >= 0 ? '+' : ''}${replay.best.pctReturn.toFixed(1)}%` : ''}${replay.bestDay ? `\n✨ 최고의 하루: ${replay.bestDay.date}` : ''}`;
        const ogUrl = `${appUrl}/api/og?return=${replay.totalPctReturn.toFixed(1)}&holdings=${replay.perfCount}`;
        const handleKakao = () => {
          if (!window.Kakao?.Share) return;
          window.Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: `${monthLabel}의 투자 회고`,
              description: `30일 수익 ${isGain ? '+' : ''}${replay.totalPctReturn.toFixed(2)}% · ${replay.perfCount}종목`,
              imageUrl: ogUrl,
              link: { mobileWebUrl: appUrl, webUrl: appUrl },
            },
            buttons: [{ title: '주비 시작하기', link: { mobileWebUrl: appUrl, webUrl: appUrl } }],
          });
        };
        const handleGeneral = async () => {
          if (navigator.share) {
            try { await navigator.share({ title: '주비 월간 회고', text: shareText, url: appUrl }); } catch {}
          } else {
            await navigator.clipboard.writeText(`${shareText}\n\n${appUrl}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        };
        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={e => { if (e.target === e.currentTarget) setShareOpen(false); }}
          >
            <div style={{ background: 'var(--surface, #fff)', borderRadius: 20, width: '100%', maxWidth: 420, overflow: 'hidden' }}>
              {/* 공유 카드 프리뷰 (다크 테마) */}
              <div
                style={{
                  background: isGain
                    ? 'linear-gradient(135deg, #1A1D2E 0%, #3D2A50 100%)'
                    : 'linear-gradient(135deg, #1A1D2E 0%, #2A3D50 100%)',
                  padding: '32px 28px', color: '#FFFFFF', position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: isGain ? 'rgba(239,68,82,0.12)' : 'rgba(49,130,246,0.12)' }} />
                <div style={{ position: 'absolute', bottom: -30, left: '10%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(175,82,222,0.08)' }} />

                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#3182F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 800 }}>S</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>주비 · 월간 회고</span>
                </div>

                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, position: 'relative', zIndex: 1 }}>
                  {monthLabel}의 나
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: isGain ? '#EF4452' : '#3182F6', lineHeight: 1.1, marginBottom: 6, position: 'relative', zIndex: 1 }}>
                  {isGain ? '+' : ''}{replay.totalPctReturn.toFixed(2)}%
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20, position: 'relative', zIndex: 1 }}>
                  {isGain ? '+' : '-'}{formatMoney(replay.totalAbsReturn)} (30일)
                </div>

                {/* 하이라이트 */}
                <div style={{ display: 'grid', gridTemplateColumns: replay.bestDay ? '1fr 1fr' : '1fr', gap: 10, position: 'relative', zIndex: 1 }}>
                  {replay.best && (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>🏆 최고의 종목</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{STOCK_KR[replay.best.symbol] || replay.best.symbol}</div>
                      <div style={{ fontSize: 11, color: '#EF4452', fontWeight: 700 }}>{replay.best.pctReturn >= 0 ? '+' : ''}{replay.best.pctReturn.toFixed(1)}%</div>
                    </div>
                  )}
                  {replay.bestDay && (
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>✨ 최고의 하루</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{replay.bestDay.date}</div>
                      <div style={{ fontSize: 11, color: '#EF4452', fontWeight: 700 }}>+{replay.bestDay.deltaPct.toFixed(2)}%</div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.4)', position: 'relative', zIndex: 1 }}>
                  solb-portfolio.vercel.app
                </div>
              </div>

              {/* 버튼들 */}
              <div style={{ padding: '16px 20px', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShareOpen(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)', background: 'var(--bg-subtle, #F2F4F6)', border: 'none', cursor: 'pointer' }}
                >
                  닫기
                </button>
                {kakaoReady && (
                  <button
                    onClick={handleKakao}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#191F28', background: '#FEE500', border: 'none', cursor: 'pointer' }}
                  >
                    카카오톡
                  </button>
                )}
                <button
                  onClick={handleGeneral}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#FFFFFF', background: '#3182F6', border: 'none', cursor: 'pointer' }}
                >
                  {copied ? '복사됨!' : '공유하기'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── 하이라이트 카드 ──────────────────────────────────────────────────────────
function HighlightCard({
  emoji, label, value, sub, subColor, avatarSymbol,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
  subColor: 'gain' | 'loss' | 'info';
  avatarSymbol?: string;
}) {
  const color =
    subColor === 'gain' ? 'var(--color-gain, #EF4452)'
    : subColor === 'loss' ? 'var(--color-loss, #3182F6)'
    : 'var(--color-info, #3182F6)';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 6 }}>
        {emoji} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {avatarSymbol && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: getAvatarColor(avatarSymbol),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{avatarSymbol.charAt(0)}</span>
          </div>
        )}
        <span style={{
          fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #191F28)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color }}>
        {sub}
      </div>
    </div>
  );
}
