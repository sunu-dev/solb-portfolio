'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronRight, RefreshCw } from 'lucide-react';
import { useMarketWatch } from '@/hooks/useMarketWatch';
import { useNow } from '@/hooks/useNow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { isWatchNews, presentWatchEvent, watchFeedState, type WatchEvent } from '@/lib/marketWatch';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import type { StockItem } from '@/config/constants';
import styles from './MarketWatch.module.css';
import readingUI from '../ui/ReadingUI.module.css';
import MarketFlowBriefing from './MarketFlowBriefing';
import OfficialPolicyBriefing from './OfficialPolicyBriefing';

const date = (at: string) => Number.isFinite(Date.parse(at)) ? new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(at)) : '시각 미확인';
const statusLabels: Record<WatchEvent['status'], string> = {
  observed: '관찰한 변화', monitoring: '이후 흐름', halted: '거래 중단 공시', resumed: '해제 공시',
  closed: '당일 종료 공시', reported: '관련 기사', released: '확인된 발표', publication: '공식 원문 공개 · 수치 확인 중',
};
type Filter = 'all' | 'kr' | 'us' | 'industries' | 'following';
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: '주요 소식' }, { id: 'kr', label: '한국' }, { id: 'us', label: '미국' },
  { id: 'industries', label: '산업별' }, { id: 'following', label: '이후 달라진 점' },
];

export default function MarketWatch({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { data, error, loading, retry } = useMarketWatch();
  const clock = useNow(); const titleId = useId();
  const [filter, setFilter] = useState<Filter>('all'); const [showAll, setShowAll] = useState(false);
  const stocks = usePortfolioStore(state => state.stocks.investing);
  const setSection = usePortfolioStore(state => state.setCurrentSection);
  const setAnalysisSymbol = usePortfolioStore(state => state.setAnalysisSymbol);
  // News relevance does not require knowing the purchase price, in any broker.
  const holdings = stocks.filter(stock => !stock.demo && Number.isFinite(stock.shares) && stock.shares > 0);
  // The service timestamp anchors the first render until the client's minute clock starts.
  const now = Math.max(clock, data ? Date.parse(data.servedAt) : 0);
  const state = data ? watchFeedState(data, now) : 'pending';
  const presentedEvents = useMemo(() => (data?.events ?? []).map(presentWatchEvent), [data?.events]);
  const events = presentedEvents.filter(event => filter === 'all'
    || filter === 'kr' && event.market === 'kr' || filter === 'us' && event.market === 'us'
    || filter === 'industries' && event.sectors.length > 0 || filter === 'following' && event.history.length > 1);
  const visible = events.slice(0, compact ? 1 : showAll ? events.length : 5);
  const openReport = () => { onNavigate?.(); setSection('insights'); requestAnimationFrame(() => document.querySelector('[data-market-watch]')?.scrollIntoView({ block: 'start' })); };

  return <section className={`${styles.root} ${compact ? styles.compact : ''}`} aria-labelledby={titleId} data-market-watch>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>보유 종목이 없어도 챙겨보세요</p><h2 id={titleId}>지금 시장에서 알아둘 일</h2></div>
      {!compact && <button type="button" className={styles.iconButton} aria-label="시장 소식 다시 불러오기" onClick={retry} disabled={loading}><RefreshCw size={17} aria-hidden="true" /></button>}
    </header>
    {!data && loading && <p className={styles.message} role="status">시장 소식과 확인된 공시를 불러오고 있어요…</p>}
    {error && <p className={styles.message} role="status">{error}{data ? ' 마지막으로 불러온 기록을 보여드려요.' : ''} <button type="button" onClick={retry}>다시 불러오기</button></p>}
    {data && state !== 'ready' && <p className={styles.message} role="status">{
      state === 'stale' ? '정기 갱신이 늦어지고 있어요. 아래 내용은 마지막 확인 기록이에요.'
        : state === 'partial' ? '일부 자료를 확인 중이에요. 확인된 소식부터 보여드려요.'
          : '첫 정기 관찰 결과를 준비하고 있어요.'
    }</p>}
    {(data?.briefs ?? []).filter(brief => filter === 'all' || filter === brief.market).slice(0, compact ? 1 : 2)
      .map(brief => <MarketFlowBriefing key={brief.id} brief={brief} holdings={holdings} compact={compact} />)}
    {data?.briefs && data.briefs.length === 0 && <p className={styles.message} role="status">같은 거래일의 주요 지수 자료가 충분하지 않아 시장 전체 흐름은 아직 묶어 설명하지 못했어요. 확인된 개별 소식부터 보여드려요.</p>}
    {data && !compact && <div className={styles.filters} role="group" aria-label="시장 소식 범위">
      {filters.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id}
        onClick={() => { setFilter(item.id); setShowAll(false); }}>{item.label}</button>)}
    </div>}
    {!compact && ['all', 'kr', 'us'].includes(filter) && <OfficialPolicyBriefing feed={data?.officialPolicies} market={filter === 'kr' || filter === 'us' ? filter : undefined} />}
    <div className={styles.events}>
      {visible.map(event => compact ? <button type="button" key={event.id} className={styles.preview} onClick={openReport}>
        <span className={styles.meta}>{event.topic ? `${event.topic} · ` : ''}{statusLabels[event.status]} · {date(event.asOf)} (한국시간)</span>
        <strong>{event.title}</strong>{event.summary && <span className={styles.previewSummary}>{event.summary}</span>}<span className={styles.link}>{isWatchNews(event) ? '기사와 배경 보기' : '변화와 배경 보기'} <ChevronRight size={16} aria-hidden="true" /></span>
      </button> : <WatchEventCard key={event.id} event={event} holdings={holdings} onStock={symbol => { onNavigate?.(); setAnalysisSymbol(symbol); }} />)}
    </div>
    {data && !events.length && state !== 'pending' && <p className={styles.message}>{filter !== 'all'
      ? '이 범위에서 표시할 새 기록이 없어요. 다른 시장 소식도 살펴보세요.'
      : state === 'ready' ? '현재 관찰 범위에서 큰 움직임이나 새 소식이 잡히지 않았어요. 경제 일정과 지난 기록도 함께 살펴보세요.'
        : '자료가 부족해 시장 상황을 판단하지 않아요. 수집 상태와 경제 일정을 함께 확인해보세요.'}</p>}
    {compact ? <button type="button" className={styles.more} onClick={openReport}>시장 소식과 이후 변화 더 보기<ChevronRight size={17} aria-hidden="true" /></button>
      : <>{events.length > 5 && <button type="button" className={styles.more} onClick={() => setShowAll(value => !value)}>{showAll ? '주요 소식만 보기' : `관찰한 소식 ${events.length}개 모두 보기`}<ChevronRight size={17} aria-hidden="true" /></button>}
        <details className={styles.coverage}><summary className={readingUI.disclosure}>무엇을 얼마나 확인했나요?</summary>
          <p>지수·미국 업종 ETF·환율·원자재·국채금리와 거래소 시장조치는 10분마다, 산업 소식은 2시간마다 확인해요. 실시간 속보를 보장하지 않아요.</p>
          <p>기사 검색 성공 횟수는 검색 요청의 확인 범위예요. 표시한 기사 수·본문 사실 검증과는 구분해요.</p>
          <p>미국 업종 ETF는 해당 미국 상품의 관찰 기준이에요. 한국 산업 전체나 전 세계 모든 기업을 감시한다는 뜻은 아니에요.</p>
          {!data?.runs.length && <p>아직 완료된 관찰 기록이 없어요.</p>}
          {data?.runs.map(run => <div key={run.scope}><p>{run.scope === 'market' ? '시장 관찰' : '산업 소식'} · {date(run.checkedAt)} (한국시간)</p>
            <ul>{run.coverage.map(item => <li key={item.id}>{item.label}: {item.available}/{item.total} 확인{item.selected !== undefined ? ` · 표시 기준에 맞는 소식 ${item.selected}개` : ''}
              {item.lastSuccessAt && <span> · 마지막 전체 확인 {date(item.lastSuccessAt)}</span>}
              {!!item.consecutiveFailures && <span> · 연속 {item.consecutiveFailures}회 일부 미확인</span>}</li>)}</ul>
            {run.warnings.map(warning => <p key={warning}>{warning}</p>)}
          </div>)}
        </details></>}
  </section>;
}

function WatchEventCard({ event, holdings, onStock }: { event: WatchEvent; holdings: StockItem[]; onStock: (symbol: string) => void }) {
  const related = new Set((event.relatedSymbols ?? []).map(getStockIdentityKey));
  const connected = holdings.filter(stock => related.has(getStockIdentityKey(stock.symbol)));
  const unique = [...new Map(connected.map(stock => [getStockIdentityKey(stock.symbol), stock])).values()];
  const marketHoldings = holdings.some(stock => event.market === 'kr' ? /(?:^\d{6}$|\.K[SQ]$)/.test(stock.symbol)
    : event.market === 'us' ? !/(?:^\d{6}$|\.K[SQ]$)/.test(stock.symbol) : false);
  return <details className={styles.event}>
    <summary data-ui-disclosure="composite"><span className={styles.meta}>{event.topic ? `${event.topic} · ` : ''}{statusLabels[event.status]} · {date(event.asOf)} (한국시간)</span>
      <h3>{event.title}</h3>{event.summary && <p>{event.summary}</p>}<span className={styles.link}>{isWatchNews(event) ? '기사와 배경 보기' : '변화와 배경 보기'}<ChevronRight size={16} aria-hidden="true" /></span>
    </summary>
    <div className={styles.body}>
      {event.history.length > 1 && <section className={styles.history}><h4>{isWatchNews(event) ? '이전에 확인한 기사' : '이후 어떻게 달라졌나요?'}</h4><ol>{event.history.slice(-5).map((item, index) => <li key={`${item.asOf}:${index}`}><time dateTime={item.asOf}>{date(item.asOf)}</time><strong>{item.title}</strong>{item.summary && <p>{item.summary}</p>}</li>)}</ol></section>}
      <section><h4>무슨 뜻인가요?</h4><p>{event.meaning}</p></section>
      <section><h4>어떤 과정으로 이어지나요?</h4><p className={styles.meta}>이해를 돕는 일반적인 경로예요. 이번 사건의 원인으로 확정한 내용은 아니에요.</p><ol className={styles.path}>{event.path.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
      <section><h4>다음에 무엇을 확인하나요?</h4><p>{event.watch}</p></section>
      <section><h4>내 투자와 함께 보면</h4>{unique.length ? <><p>확인된 사업 분류가 겹치는 보유 종목이에요. 이번 사건의 직접적인 피해·수혜가 확인됐다는 뜻은 아니에요.</p><div className={styles.stocks}>{unique.map(stock => <button type="button" key={stock.symbol} onClick={() => onStock(stock.symbol)}>{stock.name || stock.symbol}<ChevronRight size={15} aria-hidden="true" /></button>)}</div></>
        : <p>{marketHoldings ? '이 소식과 같은 시장에 투자하고 있어요. 시장 전체의 변화와 회사별 실적·공시는 나눠서 확인해보세요.'
          : '보유 여부와 관계없이 알아둘 시장 소식이에요. 직접 연결이 확인되지 않은 종목에 영향을 단정하지 않아요.'}</p>}</section>
      <p className={styles.limits}>{event.limits}</p>
      <section className={styles.sources}><h4>확인한 자료</h4><ul>{event.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.label}<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (새 창)</span></a><span>{source.label} · {date(source.at)}</span></li>)}</ul><p>첫 관찰 {date(event.firstSeenAt)} · 내용 변경 {date(event.updatedAt)} (한국시간)</p></section>
    </div>
  </details>;
}
