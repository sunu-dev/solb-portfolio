'use client';

import { useState } from 'react';
import { STOCK_KR } from '@/config/constants';

interface SimulatorProps {
  symbol: string;
  currentPrice: number;
  avgCost: number;
  shares: number;
  totalPortfolioValue: number;
  usdKrw: number;
  currency: 'KRW' | 'USD';
}

function fmtWon(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000000) return `${(val / 100000000).toFixed(1)}억원`;
  if (abs >= 10000) return `${(val / 10000).toFixed(0)}만원`;
  return `${Math.round(val).toLocaleString()}원`;
}

export default function BuySimulator({
  symbol, currentPrice, avgCost, shares,
  totalPortfolioValue, usdKrw, currency,
}: SimulatorProps) {
  const [amount, setAmount] = useState('1000000'); // 기본 100만원
  const [isOpen, setIsOpen] = useState(false);

  if (!currentPrice || currentPrice <= 0) return null;

  const kr = STOCK_KR[symbol] || symbol;
  const amountNum = parseFloat(amount) || 0;
  const amountUsd = currency === 'KRW' ? amountNum / usdKrw : amountNum;
  const newShares = Math.floor(amountUsd / currentPrice);
  const actualCost = newShares * currentPrice;
  const remainingCash = amountUsd - actualCost;

  // 새 평단 계산
  const oldTotalCost = avgCost * shares;
  const newTotalShares = shares + newShares;
  const newAvgCost = newTotalShares > 0 ? (oldTotalCost + actualCost) / newTotalShares : currentPrice;

  // 비중 변화
  const newValue = (shares + newShares) * currentPrice;
  const newPortValue = totalPortfolioValue + actualCost;
  const newWeight = newPortValue > 0 ? (newValue / newPortValue) * 100 : 0;
  const oldWeight = totalPortfolioValue > 0 ? (shares * currentPrice / totalPortfolioValue) * 100 : 0;

  // 프리셋 금액
  const presets = currency === 'KRW'
    ? [{ label: '50만', val: 500000 }, { label: '100만', val: 1000000 }, { label: '300만', val: 3000000 }, { label: '500만', val: 5000000 }]
    : [{ label: '$500', val: 500 }, { label: '$1K', val: 1000 }, { label: '$3K', val: 3000 }, { label: '$5K', val: 5000 }];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(49,130,246,0.06)',
          border: '1px dashed rgba(49,130,246,0.3)',
          color: '#3182F6',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        💰 지금 {kr} 사면 어떻게 될까?
      </button>
    );
  }

  return (
    <div style={{
      marginTop: 8,
      padding: '16px 18px',
      borderRadius: 14,
      background: 'var(--surface, #FFFFFF)',
      border: '1px solid #F2F4F6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>💰 매수 시뮬레이션</span>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-tertiary, #B0B8C1)', cursor: 'pointer' }}>✕</button>
      </div>

      {/* 금액 입력 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', display: 'block', marginBottom: 6 }}>
          투자 금액 ({currency === 'KRW' ? '원' : '$'})
        </label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', background: 'var(--bg-subtle, #F2F4F6)',
            border: 'none', borderRadius: 10, fontSize: 16, outline: 'none', boxSizing: 'border-box',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
      </div>

      {/* 프리셋 버튼 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {presets.map(p => (
          <button
            key={p.val}
            onClick={() => setAmount(String(p.val))}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: parseFloat(amount) === p.val ? 'rgba(49,130,246,0.08)' : '#F2F4F6',
              color: parseFloat(amount) === p.val ? '#3182F6' : '#8B95A1',
              border: 'none', cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 결과 */}
      {newShares > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ResultCard label="매수 가능" value={`${newShares}주`} sub={`현재가 $${currentPrice.toFixed(2)}`} />
            <ResultCard
              label="새 평균단가"
              value={`$${newAvgCost.toFixed(2)}`}
              sub={shares > 0 ? `기존 $${avgCost.toFixed(2)} → 변경` : '신규 매수'}
              highlight={newAvgCost < avgCost}
            />
            <ResultCard
              label="포트폴리오 비중"
              value={`${newWeight.toFixed(1)}%`}
              sub={oldWeight > 0 ? `${oldWeight.toFixed(1)}% → ${newWeight.toFixed(1)}%` : '신규'}
            />
            <ResultCard
              label="총 보유"
              value={`${newTotalShares}주`}
              sub={currency === 'KRW' ? `₩${fmtWon(newValue * usdKrw)}` : `$${newValue.toFixed(0)}`}
            />
          </div>
          {remainingCash > 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', textAlign: 'center' }}>
              잔여 {currency === 'KRW' ? `₩${Math.round(remainingCash * usdKrw).toLocaleString()}` : `$${remainingCash.toFixed(2)}`} (1주 미만 단수 차이)
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>
          금액이 1주 가격보다 적어요
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
