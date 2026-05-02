'use client';

import { useState, useMemo } from 'react';
import { STOCK_KR } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

/**
 * 매수 시뮬레이션 — 9인 패널 회의 결과 반영 (Phase 4 후속).
 *
 * 핵심 정책:
 * - market: 'KR' = 정수주 / 'US' = 0.001주 (한국은 분수주 미지원)
 * - priceCurrency: currentPrice의 단위. inputCurrency: 사용자 입력 단위.
 *   환산은 입력 ↔ 가격 단위 차이가 있을 때만 1회.
 * - 수수료/세금 숫자 노출 X (broker 오해 방지) → 디스클레이머 1줄로 대체
 * - 톤: "샀다면" 가정형 (자본시장법 권유 회피)
 */

interface SimulatorProps {
  symbol: string;
  /** 시장 — 분수주 정책 결정 */
  market: 'KR' | 'US';
  /** 현재가 (priceCurrency 단위) */
  currentPrice: number;
  /** currentPrice 표시 통화 */
  priceCurrency: 'KRW' | 'USD';
  /** 평단가 — currentPrice와 동일 단위 가정 */
  avgCost: number;
  shares: number;
  /** 포트폴리오 총 평가액 — priceCurrency 단위 가정 */
  totalPortfolioValue: number;
  /** 환율 (KRW per 1 USD) — 사용자 입력 단위 ↔ 가격 단위 차이 시 환산 */
  usdKrw: number;
  /** 사용자 표시 통화 (입력 + 결과 표시 단위) */
  currency: 'KRW' | 'USD';
}

// ─── 단위 헬퍼 ────────────────────────────────────────────────────────────
function formatPrice(value: number, cur: 'KRW' | 'USD'): string {
  if (cur === 'KRW') return `${Math.round(value).toLocaleString()}원`;
  return `$${value.toFixed(2)}`;
}

function formatMoney(value: number, cur: 'KRW' | 'USD'): string {
  if (cur === 'KRW') return formatKRW(Math.round(value), { suffix: '원', prefix: false });
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatShares(shares: number, market: 'KR' | 'US'): string {
  if (market === 'KR') return `${Math.floor(shares)}주`;
  // 미국: 정수면 정수, 분수면 소수 3자리 (토스 표기 단순화)
  if (Number.isInteger(shares)) return `${shares}주`;
  return `${shares.toFixed(3)}주`;
}

// 천 단위 콤마 입력 처리
function digitsOnly(s: string): string { return s.replace(/[^\d]/g, ''); }
function withCommas(s: string): string {
  if (!s) return '';
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function BuySimulator({
  symbol, market, currentPrice, priceCurrency,
  avgCost, shares, totalPortfolioValue, usdKrw, currency,
}: SimulatorProps) {
  const [amountStr, setAmountStr] = useState(() => currency === 'KRW' ? '1,000,000' : '1,000');
  const [isOpen, setIsOpen] = useState(false);

  // 가드 — 가격 무효 / 환율 무효
  if (!currentPrice || currentPrice <= 0) return null;

  const kr = STOCK_KR[symbol] || symbol;
  const amountNum = Math.max(0, parseFloat(digitsOnly(amountStr) || '0'));

  // 입력 단위 → 가격 단위로 환산 (필요할 때만)
  const amountInPriceCurrency = useMemo(() => {
    if (currency === priceCurrency) return amountNum;
    if (currency === 'KRW' && priceCurrency === 'USD') return usdKrw > 0 ? amountNum / usdKrw : 0;
    if (currency === 'USD' && priceCurrency === 'KRW') return amountNum * usdKrw;
    return amountNum;
  }, [amountNum, currency, priceCurrency, usdKrw]);

  // 매수 가능 주수 — market에 따라 정밀도 분기
  const newShares = useMemo(() => {
    if (currentPrice <= 0 || amountInPriceCurrency <= 0) return 0;
    const raw = amountInPriceCurrency / currentPrice;
    if (market === 'KR') return Math.floor(raw);
    return Math.floor(raw * 1000) / 1000;
  }, [amountInPriceCurrency, currentPrice, market]);

  const actualCost = newShares * currentPrice;
  const remainingInPriceCurrency = amountInPriceCurrency - actualCost;
  // 결과 표시는 사용자 currency 기준 (잔여 현금도)
  const remainingDisplay = useMemo(() => {
    if (currency === priceCurrency) return remainingInPriceCurrency;
    if (currency === 'KRW' && priceCurrency === 'USD') return remainingInPriceCurrency * usdKrw;
    if (currency === 'USD' && priceCurrency === 'KRW') return usdKrw > 0 ? remainingInPriceCurrency / usdKrw : 0;
    return remainingInPriceCurrency;
  }, [remainingInPriceCurrency, currency, priceCurrency, usdKrw]);

  // 새 평단 (가격 단위 기준)
  const oldTotalCost = avgCost * shares;
  const newTotalShares = shares + newShares;
  const newAvgCost = newTotalShares > 0 ? (oldTotalCost + actualCost) / newTotalShares : currentPrice;

  // 비중 변화 — 모두 가격 단위 기준
  const newValue = (shares + newShares) * currentPrice;
  const newPortValue = totalPortfolioValue + actualCost;
  const newWeight = newPortValue > 0 ? (newValue / newPortValue) * 100 : 0;
  const oldWeight = totalPortfolioValue > 0 ? (shares * currentPrice / totalPortfolioValue) * 100 : 0;

  // 동적 프리셋 — 현재가의 1주/5주/10주/30주 (입력 currency로 환산)
  const presets = useMemo(() => {
    const oneShareCost = currentPrice; // priceCurrency
    const ratios = market === 'KR' ? [3, 10, 30, 100] : [1, 5, 20, 50];
    return ratios.map(n => {
      const totalPriceCur = oneShareCost * n;
      const totalInputCur = priceCurrency === currency
        ? totalPriceCur
        : currency === 'KRW' && priceCurrency === 'USD'
          ? totalPriceCur * usdKrw
          : currency === 'USD' && priceCurrency === 'KRW'
            ? (usdKrw > 0 ? totalPriceCur / usdKrw : 0)
            : totalPriceCur;
      // 만원 단위 라운딩 (KRW), 100불 단위 (USD)
      const rounded = currency === 'KRW'
        ? Math.round(totalInputCur / 10000) * 10000
        : Math.round(totalInputCur / 100) * 100;
      return { label: formatMoney(rounded, currency).replace(/원$/, '').replace(/^\$/, ''), val: rounded, prefix: currency === 'USD' ? '$' : '', suffix: currency === 'KRW' ? '원' : '' };
    }).filter(p => p.val > 0);
  }, [currentPrice, market, currency, priceCurrency, usdKrw]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12,
          background: 'rgba(49,130,246,0.06)', border: '1px dashed rgba(49,130,246,0.3)',
          color: '#3182F6', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8,
        }}
      >
        📊 이 종목을 더 샀다면?
      </button>
    );
  }

  const handleAmountChange = (raw: string) => {
    const digits = digitsOnly(raw);
    setAmountStr(withCommas(digits));
  };

  const tooSmall = amountNum > 0 && newShares <= 0;

  return (
    <div style={{
      marginTop: 8, padding: '16px 18px', borderRadius: 14,
      background: 'var(--surface, #FFFFFF)', border: '1px solid #F2F4F6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          📊 추가매수 시뮬레이션
        </span>
        <button onClick={() => setIsOpen(false)} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-tertiary, #B0B8C1)', cursor: 'pointer' }}>✕</button>
      </div>

      {/* 금액 입력 — 천 단위 콤마 자동 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 6 }}>
          가상 매수 금액
        </label>
        <div style={{ position: 'relative' }}>
          {currency === 'USD' && (
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>$</span>
          )}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9,]*"
            value={amountStr}
            onChange={e => handleAmountChange(e.target.value)}
            aria-label={`매수 금액 (${currency === 'KRW' ? '원' : '달러'})`}
            style={{
              width: '100%', padding: currency === 'USD' ? '10px 14px 10px 28px' : '10px 14px',
              background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 10,
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          {currency === 'KRW' && (
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-tertiary, #B0B8C1)', pointerEvents: 'none' }}>원</span>
          )}
        </div>
      </div>

      {/* 동적 프리셋 — 현재가 기반 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {presets.map(p => {
          const isActive = parseFloat(digitsOnly(amountStr) || '0') === p.val;
          return (
            <button
              key={p.val}
              onClick={() => handleAmountChange(String(p.val))}
              style={{
                flex: '1 1 calc(25% - 6px)', minWidth: 60, padding: '6px 0', borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: isActive ? 'rgba(49,130,246,0.08)' : '#F2F4F6',
                color: isActive ? '#3182F6' : '#8B95A1',
                border: 'none', cursor: 'pointer',
              }}
            >
              {p.prefix}{p.label}{p.suffix}
            </button>
          );
        })}
      </div>

      {/* 결과 */}
      {tooSmall ? (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
          1주 가격({formatPrice(currentPrice, priceCurrency)})보다 적어요
        </div>
      ) : newShares > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-light, #F2F4F6)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap' }}>샀다면?</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-light, #F2F4F6)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ResultCard
              label="매수 가능"
              value={formatShares(newShares, market)}
              sub={`현재가 ${formatPrice(currentPrice, priceCurrency)}`}
            />
            <ResultCard
              label="새 평균단가"
              value={formatPrice(newAvgCost, priceCurrency)}
              sub={shares > 0 ? `기존 ${formatPrice(avgCost, priceCurrency)} → 변경` : '신규 매수'}
              highlight={shares > 0 && newAvgCost < avgCost}
            />
            <ResultCard
              label="포트폴리오 비중"
              value={`${newWeight.toFixed(1)}%`}
              sub={oldWeight > 0 ? `${oldWeight.toFixed(1)}% → ${newWeight.toFixed(1)}%` : '신규'}
            />
            <ResultCard
              label="총 보유"
              value={formatShares(newTotalShares, market)}
              sub={formatMoney(newValue, priceCurrency)}
            />
          </div>
          {remainingInPriceCurrency > 0.01 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center' }}>
              잔여 {formatMoney(remainingDisplay, currency)} (1주 미만 단수)
            </div>
          )}
          {/* 수수료/체결 디스클레이머 — 회의 결정: 숫자 노출 X, 1줄 안내만 */}
          <div style={{
            marginTop: 4, padding: '8px 10px', borderRadius: 8,
            background: 'var(--bg-subtle, #F8F9FA)',
            fontSize: 10, lineHeight: 1.5, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center',
          }}>
            가상 시뮬레이션이에요. 실제 체결가는 증권사 수수료·환율·호가에 따라 달라요.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
          금액을 입력해보세요
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-subtle, #F8F9FA)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: highlight ? '#16A34A' : '#191F28' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
