'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { DEFAULT_USD_KRW, formatKrw, resolveUsdKrwState } from '@/utils/koreanNumber';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';

/**
 * 환율을 못 받은 상태로 원화 환산을 보여주고 있을 때 그 사실을 밝힌다.
 *
 * 왜 필요한가: USD/KRW를 못 받으면 `DEFAULT_USD_KRW`(1,400원)로 환산하는데,
 * 화면에는 그게 실제 환율로 계산한 값과 **똑같이 확정 숫자처럼** 보였다.
 * 2026-08-18 감사가 "틀린 숫자를 자신 있게 보여주는 최악의 실패 모드"로 지목한 지점이다.
 *
 * 숫자를 감추지 않는 이유: 화면이 비면 더 불안하고, '임시 기준'이라는 사실만 알면
 * 달러 표시로 전환해 정확한 값을 볼 수 있다.
 *
 * 세 조건이 **모두** 참일 때만 노출한다. 하나라도 아니면 환산 자체가 없거나
 * 환율과 무관하므로 경고가 소음이 된다:
 *   ① 환율 미확인  ② USD 종목 보유  ③ 원화로 보는 중
 */
export default function FxStaleNotice({ style }: { style?: React.CSSProperties }) {
  const { macroData, stocks, currency } = usePortfolioStore();

  if (currency !== 'KRW') return null;

  const { stale } = resolveUsdKrwState(macroData);
  if (!stale) return null;

  const hasUsdHolding = (stocks.investing || []).some(
    s => s.avgCost > 0 && s.shares > 0 && !isKoreanStockSymbol(s.symbol),
  );
  if (!hasUsdHolding) return null;

  return (
    <div
      role="note"
      style={{
        fontSize: 11,
        lineHeight: 1.5,
        color: 'var(--text-tertiary, #B0B8C1)',
        wordBreak: 'keep-all',
        ...style,
      }}
    >
      환율을 아직 못 받아 임시 기준({formatKrw(DEFAULT_USD_KRW, { prefix: false, suffix: '원', short: false })})으로 환산했어요. 달러로 보면 정확해요.
    </div>
  );
}
