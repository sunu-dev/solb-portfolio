"use client";

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChartNoAxesCombined } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, type QuoteData } from '@/config/constants';
import { resolveUsdKrwState } from '@/utils/koreanNumber';
import { convertStockAmount, getStockCurrency } from '@/utils/stockCurrency';

export default function PortfolioDNA({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { investing, macroData } = usePortfolioStore(useShallow(state => ({ investing: state.stocks.investing, macroData: state.macroData })));
  const fx = resolveUsdKrwState(macroData);
  const { rows, missing, total } = useMemo(() => {
    const grouped = new Map<string, { symbol: string; name: string; value: number; currency: 'KRW' | 'USD' }>();
    let missing = 0;
    for (const stock of investing || []) {
      const quote = macroData[stock.symbol] as QuoteData | undefined;
      if (!(stock.shares > 0) || !(quote?.c && quote.c > 0)) { missing++; continue; }
      const value = convertStockAmount(stock.symbol, quote.c, fx.rate, stock.currency).krw * stock.shares;
      const previous = grouped.get(stock.symbol);
      grouped.set(stock.symbol, { symbol: stock.symbol, name: STOCK_KR[stock.symbol] || stock.name || stock.symbol, value: (previous?.value || 0) + value, currency: getStockCurrency(stock.symbol, stock.currency) });
    }
    const rows = [...grouped.values()].sort((a, b) => b.value - a.value);
    return { rows, missing, total: rows.reduce((sum, row) => sum + row.value, 0) };
  }, [investing, macroData, fx.rate]);
  if (!investing?.length) return null;
  if (!total) return <p role="status" style={{ padding: 20, color: 'var(--text-secondary)', lineHeight: 1.7 }}>수량과 시세가 확인되면 종목별 비중을 볼 수 있어요.</p>;
  const leading = rows[0];
  if (variant === 'compact') return <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 12, background: 'var(--bg-subtle)' }}>
    <ChartNoAxesCombined size={24} aria-hidden="true" style={{ color: 'var(--text-body)' }} />
    <div><strong style={{ fontSize: 13 }}>가장 큰 비중 · {leading.name}</strong><p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>확인한 평가금액의 {(leading.value / total * 100).toFixed(1)}%</p></div>
  </div>;
  return <section style={{ padding: 20, border: '1px solid var(--border-light)', borderRadius: 16 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700 }}>종목별로 얼마나 담고 있나요?</h2>
    <p className="reading-copy" style={{ color: 'var(--text-body)', fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>{leading.name}의 비중이 가장 커요. 이 종목의 가격 변화가 전체 평가금액에 크게 반영돼요.</p>
    <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none' }}>{rows.map(row => {
      const percent = row.value / total * 100;
      return <li key={row.symbol} style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}><span>{row.name}</span><strong style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{percent.toFixed(1)}%</strong></div>
        <div aria-hidden="true" style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 8, marginTop: 8 }}><div style={{ width: `${percent}%`, height: '100%', borderRadius: 8, background: 'var(--text-body)' }} /></div>
      </li>;
    })}</ul>
    <p className="reading-copy" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 20 }}>시세와 수량이 확인된 {rows.length}개 종목의 평가금액 기준이에요. {missing > 0 ? `시세 또는 수량이 없는 ${missing}개 기록은 계산에서 제외했어요. ` : ''}미국 주식은 원화로 환산했으며, ETF 내부 구성까지 나눈 결과는 아니에요.</p>
    {fx.stale && rows.some(row => row.currency === 'USD') && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>현재 환율을 확인하지 못해 임시 환율로 계산했어요.</p>}
  </section>;
}
