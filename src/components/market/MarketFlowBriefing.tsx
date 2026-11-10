'use client';

import { useId } from 'react';
import type { MarketFlowBrief } from '@/lib/marketFlowEngine';
import type { StockItem } from '@/config/constants';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import styles from './MarketFlowBriefing.module.css';
import readingUI from '../ui/ReadingUI.module.css';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const at = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul',
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
const amount = (value: string) => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const [whole, fraction] = value.replace(/^-/, '').split('.'); let rest = BigInt(whole);
  const parts: string[] = [];
  for (const [unit, label] of [[BigInt('1000000000000'), '조'], [BigInt('100000000'), '억'], [BigInt('10000'), '만']] as const) {
    const count = rest / unit; rest %= unit;
    if (count) parts.push(`${count.toLocaleString('ko-KR')}${label}`);
  }
  if (rest || fraction || !parts.length) parts.push(`${rest.toLocaleString('ko-KR')}${fraction ? `.${fraction}` : ''}`);
  return `${value.startsWith('-') ? '-' : ''}${parts.join(' ')}`;
};

/** Public report + browser-only connection to holdings. No holdings are sent
 * to the market endpoint or placed in notification text/analytics here.
 */
export default function MarketFlowBriefing({ brief, holdings, compact = false }: {
  brief: MarketFlowBrief; holdings: StockItem[]; compact?: boolean;
}) {
  const id = useId();
  const related = new Set([...brief.companies.map(item => item.symbol), ...brief.evidence.flatMap(item => item.symbols)].map(getStockIdentityKey));
  const mine = [...new Map(holdings.filter(stock => !stock.demo && Number.isFinite(stock.shares) && stock.shares > 0
    && related.has(getStockIdentityKey(stock.symbol))).map(stock => [getStockIdentityKey(stock.symbol), stock])).values()]
    .map(stock => stock.name || stock.symbol);
  return <article className={styles.root} aria-labelledby={id} data-market-flow-brief>
    <p className={styles.kicker}>{brief.market === 'us' ? '미국' : '한국'} {brief.sessionDate} 거래일 · 먼저 알아둘 흐름</p>
    <h3 id={id}>{brief.headline}</h3>
    <p className={styles.summary}>{brief.summary}</p>
    {brief.freshness === 'delayed' && <p role="status" className={styles.note}>갱신이 늦어 마지막 확인 자료를 보여드려요. 실시간 상황으로 해석하지 마세요.</p>}
    {brief.evidence.find(item => item.scope === 'market') && <p className={styles.lead}>{brief.evidence.find(item => item.scope === 'market')!.title}</p>}
    <details open={!compact} className={styles.detail}>
      <summary className={readingUI.disclosure}>왜 움직였고, 무엇을 이어서 볼까요?</summary>
      <section><h4>시장 전체와 회사별 움직임</h4>
        {brief.sectorExplanation && <p>{brief.sectorExplanation}</p>}
        {!brief.sectorExplanation && <p>업종 전반의 움직임을 설명할 자료는 아직 부족해요. 확인된 지수와 개별 기업부터 비교해요.</p>}
        {brief.companies.length > 0 && <ul className={styles.moves}>{brief.companies.map(item => <li key={item.symbol}>
          <strong>{item.label} {signed(item.change)}</strong><span>{brief.benchmarks[0].label}보다 {Math.abs(item.relativeToIndex).toFixed(2)}%포인트 {item.relativeToIndex < 0 ? '낮은' : '높은'} 등락률</span>
        </li>)}</ul>}
      </section>
      <section><h4>확인된 배경과 전달 과정</h4>
        {brief.explanationState === 'awaiting-evidence' && <p>{brief.companyExplanations?.length
          ? '주가 움직임과 함께 살펴볼 회사 발표를 모았어요. 이 발표가 주가를 움직인 원인인지는 아직 확인되지 않았어요.'
          : '가격 변화는 확인했지만, 하락·상승 배경을 설명할 근거는 확인 중이에요. 관련 기사 제목만으로 원인을 정하지 않아요.'}</p>}
        {brief.evidence.map(item => <div className={styles.explanation} key={item.id}>
          <h5>{item.title}</h5><p><b>발표한 사실</b> {item.fact}</p><p><b>어떻게 연결되나요?</b> {item.interpretation}</p>
          <div className={styles.sources}>{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗<span className="sr-only"> (새 창)</span></a>)}</div>
        </div>)}
        {brief.companyExplanations?.map(item => <details key={item.id} className={styles.companyExplanation} data-company-explanation>
          <summary className={readingUI.disclosure}>{item.title}</summary>
          <p className={styles.note}>발표 {at(item.publishedAt)} · 확인 {at(item.checkedAt)} (한국시간){item.corrected ? ' · 변경된 공시 반영' : ''}</p>
          {item.timing === 'after_observation' && <p className={styles.timing}>위 시세의 기준 시각 이후에 나온 발표예요. 앞선 주가 움직임을 설명하는 근거로 쓰지 않아요.</p>}
          {item.timing === 'earlier_background' && <p className={styles.timing}>시세 기준보다 이틀 이상 앞선 발표로, 최근 사업 배경을 이해하는 자료예요.</p>}
          <p>{item.summary}</p>
          {(item.comparisons ?? (item.comparison ? [item.comparison] : [])).map(comparison => <div key={comparison.label}>
            <h5>{comparison.label}</h5><dl className={styles.comparison}>
              <div><dt>이번 공시의 해당 기간<small>{comparison.currentPeriod}</small></dt><dd>{amount(comparison.current)} {comparison.unit}</dd></div>
              <div><dt>전년 대응 기간<small>{comparison.previousPeriod}</small></dt><dd>{amount(comparison.previous)} {comparison.unit}</dd></div>
            </dl></div>)}
          <p><b>무슨 뜻인가요?</b> {item.meaning}</p>
          <p><b>투자와 어떻게 이어지나요?</b> {item.path}</p>
          <p><b>다음에 볼 것</b> {item.next}</p>
          <p className={styles.note}>{item.condition}</p>
          <div className={styles.sources}>{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗<span className="sr-only"> (새 창)</span></a>)}</div>
        </details>)}
        {brief.recentReleases.map(item => <p key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗<span className="sr-only"> (새 창)</span></a> · {item.summary}</p>)}
      </section>
      <section><h4>내 투자와 연결해서 보면</h4><p>{mine.length
        ? `${mine.join(' · ')} 기록이 이 브리핑과 연결돼요. 시장 공통 요인과 회사별 전망을 나눠 살펴보세요. 모든 보유 종목의 하락 원인을 확인했다는 뜻은 아니에요.`
        : '이 브리핑에 직접 연결된 보유 종목은 확인되지 않았어요. 시장 지수의 등락률을 내 종목의 수익률로 해석하지 마세요.'}</p></section>
      <section><h4>다음에 주비와 확인할 것</h4><ul>{brief.nextChecks.map(item => <li key={item}>{item}</li>)}</ul></section>
      {brief.relatedNews.length > 0 && <section><h4>함께 확인할 보도</h4><p className={styles.note}>관련 기사예요. 본문 검증을 마친 원인 분석과는 구분해요.</p><ul>{brief.relatedNews.map(item => <li key={item.url}>
        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗<span className="sr-only"> (새 창)</span></a><small>{at(item.at)} (한국시간)</small>
      </li>)}</ul></section>}
      <details className={styles.method}><summary className={readingUI.disclosure}>자료 기준과 확인 범위</summary>
        <p>시세 기준 {at(brief.asOf)} (한국시간). 종목별 기준 시각은 출처에서 확인할 수 있어요.</p>
        <ul>{brief.limitations.map(item => <li key={item}>{item}</li>)}</ul>
        <div className={styles.sources}>{[...brief.benchmarks, ...brief.companies].map(item => <a key={item.symbol} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.label} 시세 ↗<span className="sr-only"> (새 창)</span></a>)}</div>
      </details>
    </details>
  </article>;
}
