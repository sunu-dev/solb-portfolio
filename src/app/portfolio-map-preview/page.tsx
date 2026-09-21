import Link from 'next/link';
import { notFound } from 'next/navigation';
import PortfolioTreemap from '@/components/portfolio/PortfolioTreemap';
import styles from './preview.module.css';

const scenarios = {
  global: {
    label: '한국·미국·ETF 혼합 예시',
    entries: [
      { symbol: '005930.KS', shares: 150, avgCost: 68000, c: 76000, dp: 2.19 },
      { symbol: '000660.KS', shares: 30, avgCost: 185000, c: 210000, dp: 3.25 },
      { symbol: '035420.KS', shares: 20, avgCost: 200000, c: 190000, dp: -1.4 },
      { symbol: '005380.KS', shares: 10, avgCost: 210000, c: 250000, dp: .8 },
      { symbol: '207940.KS', shares: 4, avgCost: 700000, c: 760000, dp: -2.1 },
      { symbol: '105560.KS', shares: 25, avgCost: 69000, c: 78000, dp: 1.5 },
      { symbol: 'NVDA', shares: 60, avgCost: 100, c: 150, dp: 5.95 },
      { symbol: 'MSFT', shares: 25, avgCost: 380, c: 420, dp: 2.11 },
      { symbol: 'AAPL', shares: 40, avgCost: 180, c: 210, dp: 2.19 },
      { symbol: 'GOOGL', shares: 25, avgCost: 140, c: 175, dp: 2.35 },
      { symbol: 'AMZN', shares: 20, avgCost: 190, c: 210, dp: 1.63 },
      { symbol: 'TSLA', shares: 10, avgCost: 280, c: 300, dp: 5.09 },
      { symbol: 'META', shares: 7, avgCost: 620, c: 590, dp: -1.3 },
      { symbol: 'JPM', shares: 14, avgCost: 185, c: 200, dp: -.43 },
      { symbol: 'V', shares: 10, avgCost: 250, c: 280, dp: -.35 },
      { symbol: 'LLY', shares: 4, avgCost: 750, c: 810, dp: -2.13 },
      { symbol: 'UNH', shares: 4, avgCost: 420, c: 450, dp: 2.75 },
      { symbol: 'PFE', shares: 50, avgCost: 34, c: 30, dp: -2.96 },
      { symbol: 'XOM', shares: 16, avgCost: 100, c: 115, dp: .56 },
      { symbol: 'KO', shares: 25, avgCost: 55, c: 62, dp: 1.58 },
      { symbol: 'COST', shares: 3, avgCost: 900, c: 950, dp: 1.6 },
      { symbol: 'CAT', shares: 6, avgCost: 300, c: 330, dp: -1.31 },
      { symbol: 'BA', shares: 8, avgCost: 190, c: 210, dp: -.26 },
      { symbol: 'LIN', shares: 4, avgCost: 390, c: 420, dp: .06 },
      { symbol: 'T', shares: 60, avgCost: 20, c: 22, dp: -.78 },
      { symbol: 'QQQ', shares: 10, avgCost: 450, c: 480, dp: 1.12 },
      { symbol: 'SCHD', shares: 40, avgCost: 26, c: 29, dp: .44 },
      { symbol: 'TSLL', shares: 150, avgCost: 17.4, c: 9.71, dp: 4.3 },
      { symbol: 'KORU', shares: 50, avgCost: 42, c: 20.41, dp: 11.65 },
      { symbol: 'MUU', shares: 25, avgCost: 50, c: 31.28, dp: 10.65 },
      { symbol: '069500.KS', shares: 50, avgCost: 34000, c: 37000, dp: 1.2 },
    ],
  },
  current: {
    label: '기존 포트폴리오 예시',
    entries: [
      { symbol: 'TSLL', shares: 3154, avgCost: 17.4, c: 9.71, dp: 4.3 },
      { symbol: 'KORU', shares: 213, avgCost: 372.46, c: 20.41, dp: 11.65 },
      { symbol: 'MUU', shares: 1, avgCost: 423.43, c: 31.28, dp: 10.65 },
    ],
  },
  mixed: {
    label: '여러 종목 예시',
    entries: [
      { symbol: 'NVDA', shares: 120, avgCost: 120, c: 150, dp: 3.4 },
      { symbol: 'AAPL', shares: 50, avgCost: 240, c: 200, dp: -1.2 },
      { symbol: '005930.KS', shares: 120, avgCost: 65000, c: 78000, dp: 1.8 },
      { symbol: 'TSLA', shares: 20, avgCost: 310, c: 250, dp: -2.7 },
      { symbol: 'GOOGL', shares: 22, avgCost: 150, c: 180, dp: 0.6 },
      { symbol: 'MSFT', shares: 7, avgCost: 380, c: 420, dp: 1.1 },
      { symbol: '000660.KS', shares: 10, avgCost: 180000, c: 210000, dp: 2.2 },
      { symbol: 'IONQ', shares: 18, avgCost: 36, c: 40, dp: -0.3 },
    ],
  },
  long: {
    label: '긴 종목명 예시',
    entries: [
      { symbol: 'NVDA', shares: 100, avgCost: 130, c: 150, dp: 1.2 },
      { symbol: '207940.KS', shares: 10, avgCost: 720000, c: 700000, dp: -1.1 },
      { symbol: '005930.KS', shares: 60, avgCost: 65000, c: 70000, dp: 0.8 },
      { symbol: 'MSFT', shares: 10, avgCost: 400, c: 420, dp: 1.5 },
      { symbol: 'GOOGL', shares: 20, avgCost: 170, c: 180, dp: 0.5 },
    ],
  },
  single: {
    label: '한 종목·100% 예시',
    entries: [{ symbol: '005930.KS', shares: 100000000, avgCost: 60000, c: 70000, dp: 2.3 }],
  },
  edge: {
    label: '큰 수익률·미확인 예시',
    entries: [
      { symbol: 'NVDA', shares: 100, avgCost: 10, c: 150, dp: 0 },
      { symbol: '005930.KS', shares: 180, avgCost: 0, c: 70000, dp: 0 },
      { symbol: 'AAPL', shares: 10, avgCost: 0, c: 200, dp: Number.NaN },
      { symbol: 'MUU', shares: 0.01, avgCost: 30, c: 31.28, dp: 0.1 },
      { symbol: 'TSLA', shares: 10, avgCost: 250, c: 0, dp: 0 },
    ],
  },
  overlap: {
    label: '같은 좌표의 8종목 예시',
    entries: ['AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD'].map(symbol => ({ symbol, shares: 1, avgCost: 100, c: 100, dp: 0 })),
  },
  unknown: {
    label: '수익률 모두 미확인 예시',
    entries: [
      { symbol: 'AAPL', shares: 10, avgCost: 0, c: 200, dp: Number.NaN },
      { symbol: '005930.KS', shares: 100, avgCost: 0, c: 70000, dp: Number.NaN },
    ],
  },
};

export default async function PortfolioMapPreview({ searchParams }: { searchParams: Promise<{ case?: string; view?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const params = await searchParams;
  const scenarioKey = params.case && params.case in scenarios ? params.case as keyof typeof scenarios : 'current';
  const mobile = params.view === 'mobile';
  const scenario = scenarios[scenarioKey];
  const stocks = scenario.entries.map(entry => ({ ...entry, targetReturn: 20 }));
  const macroData = Object.fromEntries(scenario.entries.map(entry => [entry.symbol, { c: entry.c, dp: entry.dp }]));
  // Deliberate preview fixtures, never used in the signed-in portfolio.
  const shapes = [[1.18, 1.16, 1.2, 1.15, 1.12, 1.14, 1.09, 1.12, 1.05, 1.08, 1.02, 1.06, 1.04, 1], [.8, .84, .82, .85, .9, .88, .92, .95, .91, .96, .94, .98, .96, 1]];
  const rawCandles = scenarioKey === 'edge' ? undefined : Object.fromEntries(scenario.entries.map((entry, index) => [entry.symbol, {
    s: 'ok', c: shapes[index % 2].map(factor => entry.c * factor),
    t: [1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].map(day => Date.UTC(2026, 8, day) / 1000), h: [], l: [], o: [], v: [],
  }]));
  return <main className={styles.preview} data-map-preview>
    <header className={styles.controls}>
      <p>미리보기 <span>예시 데이터 · 운영 미반영</span></p>
      <details><summary>예시와 화면 너비 바꾸기</summary>
      <nav aria-label="예시 선택">{Object.entries(scenarios).map(([key, item]) => <Link key={key} href={`?case=${key}${mobile ? '&view=mobile' : ''}`} aria-current={key === scenarioKey ? 'page' : undefined}>{item.label}</Link>)}</nav>
      <nav aria-label="미리보기 너비"><Link href={`?case=${scenarioKey}`} aria-current={!mobile ? 'page' : undefined}>넓게 보기</Link><Link href={`?case=${scenarioKey}&view=mobile`} aria-current={mobile ? 'page' : undefined}>모바일 너비</Link></nav>
      </details>
    </header>
    <div className={styles.canvas} data-mobile={mobile}><PortfolioTreemap stocks={stocks} macroData={macroData} rawCandles={rawCandles} usdKrw={1400} currency="KRW" /></div>
    <Link className={styles.back} href="/analysis-preview">분석 탭 안에서 보기 →</Link>
  </main>;
}
