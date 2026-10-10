'use client';

import { ChevronRight } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useEconomicEvents } from '@/hooks/useEconomicEvents';
import { useNow } from '@/hooks/useNow';
import { ECON_EXPLAIN, eventTime, type EconomicEvent } from '@/lib/economicEvents';
import { guideForEconomicEvent, nextRelatedEvent, recentPersonalResults, stockGuideConnections, uniqueGuideStocks } from '@/lib/guideConnections';
import { openEconomicCalendar } from '@/components/economy/EconomicHighlights';
import ReadingText from '@/components/common/ReadingText';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import CompanyConnections from './CompanyConnections';
import styles from './PersonalMarketReport.module.css';
import ContextExploration from '@/components/explore/ContextExploration';
import { eventExploration } from '@/lib/contextExploration';

const dateLabel = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(at));
function checkedLabel(at: string) {
  if (!Number.isFinite(Date.parse(at))) return null;
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at));
}

export default function PersonalMarketReport() {
  const stocks = usePortfolioStore(state => state.stocks);
  const holdings = uniqueGuideStocks([...stocks.investing, ...stocks.watching]);
  const { data, error, retry } = useEconomicEvents();
  const now = useNow();
  const recent = recentPersonalResults(data?.events ?? [], holdings, now);
  const featured = recent[0];
  const stockIdentities = new Set(holdings.map(stock => getStockIdentityKey(stock.symbol)));
  const next = featured ? nextRelatedEvent(featured, data?.events ?? [], now) : data?.events
    .filter(event => now > 0 && event.kind !== 'holiday' && Date.parse(event.at) > now && (!event.symbol || stockIdentities.has(getStockIdentityKey(event.symbol))))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];

  return <section className={styles.report} aria-labelledby="personal-report-title">
    <div className={styles.heading}><h2 id="personal-report-title">발표에서 달라진 점</h2><button type="button" className={styles.textButton} onClick={() => openEconomicCalendar()}>일정 보기<ChevronRight size={16} aria-hidden="true" /></button></div>
    {!data && !error && <p className={styles.empty} role="status">확인된 발표와 내 종목의 연결을 살펴보고 있어요…</p>}
    {error && <p className={styles.empty} role="status">{error}<button type="button" className={styles.textButton} onClick={retry}>다시 불러오기</button></p>}
    {featured && data && <EventReport event={featured} stocks={holdings} events={data.events} now={now} />}
    {data && now > 0 && !featured && <p className={`${styles.empty} reading-copy`}>최근 7일간 확인된 새 발표 결과가 없어요. 다음 발표에서 확인할 내용을 먼저 살펴보세요.</p>}
    {!featured && next && data && holdings.length > 0 && <UpcomingConnections event={next} stocks={holdings} events={data.events} now={now} />}
    {next && <button type="button" className={styles.next} onClick={() => openEconomicCalendar(next.key)}><span><small>{featured ? '같은 발표, 다음 확인' : '다음에 확인할 발표'}</small><strong>{next.title}</strong><span>{dateLabel(next.at)} · {eventTime(next)} (한국시간)</span></span><ChevronRight size={19} aria-hidden="true" /></button>}
    {(featured || next) && <ContextExploration key={(featured || next)!.key} topics={eventExploration((featured || next)!.kind)} context={(featured || next)!.title} />}
    {recent.length > 1 && <details className={styles.moreResults}><summary>최근 확인된 다른 발표 {recent.length - 1}개</summary>{recent.slice(1).map(event => <button type="button" key={event.key} className={styles.resultLink} onClick={() => openEconomicCalendar(event.key)}><span><small>{dateLabel(event.at)} · {event.title}</small><strong className="reading-copy">{event.result?.headline}</strong></span><ChevronRight size={17} aria-hidden="true" /></button>)}</details>}
    {data && <p className={styles.meta}>{checkedLabel(data.checkedAt) ? `자료 확인 ${checkedLabel(data.checkedAt)} (한국시간) · ` : ''}확인된 발표 수치를 표시해요.{data.warnings.length > 0 ? ' 일부 자료는 확인 중이에요.' : ''}</p>}
  </section>;
}

function UpcomingConnections({ event, stocks, events, now }: { event: EconomicEvent; stocks: ReturnType<typeof uniqueGuideStocks>; events: EconomicEvent[]; now: number }) {
  const topic = guideForEconomicEvent(event);
  const connections = topic ? stockGuideConnections(topic, stocks, event) : [];
  if (!connections.length) return null;
  return <div>
    <div className={styles.personalHeading}><h4>발표 전에 내 종목에서 볼 것</h4><p>{event.title}의 결과가 나오면 이 경로와 조건을 함께 확인해요.</p></div>
    <CompanyConnections connections={connections} events={events} now={now} />
  </div>;
}

function EventReport({ event, stocks, events, now }: { event: EconomicEvent; stocks: ReturnType<typeof uniqueGuideStocks>; events: EconomicEvent[]; now: number }) {
  const topic = guideForEconomicEvent(event);
  const connections = topic ? stockGuideConnections(topic, stocks, event) : [];
  const result = event.result!;
  return <article className={styles.event}>
    <p className={styles.meta}>{dateLabel(event.at)} · {event.title}{event.period ? ` · ${event.period}` : ''}</p>
    <h3 className="reading-title">{result.headline}</h3>
    {(result.actual || result.previous || result.forecast) && <dl className={styles.figures}>
      {result.previous && <div><dt>{event.kind === 'fomc' ? '발표일 기준' : '이전 수치'}</dt><dd>{result.previous}</dd></div>}
      {result.actual && <div><dt>{event.kind === 'fomc' ? '발표 다음 날' : '이번 수치'}</dt><dd>{result.actual}</dd></div>}
      {result.forecast && <div><dt>시장 예상</dt><dd>{result.forecast}</dd></div>}
    </dl>}
    {result.note && <p className={`${styles.resultNote} reading-copy`}><ReadingText>{result.note}</ReadingText></p>}
    <p className={`${styles.meaning} reading-copy`}><ReadingText>{result.meaning || ECON_EXPLAIN[event.kind].why}</ReadingText></p>
    <div className={styles.personalHeading}><h4>내 종목에서 확인할 것</h4><p>발표가 전달될 수 있는 경로와 조건을 함께 봐요.</p></div>
    {connections.length > 0 ? <CompanyConnections connections={connections} events={events} now={now} />
      : <p className={`${styles.empty} reading-copy`}>{stocks.length === 0 ? '보유·관심 종목을 추가하면 확인된 사업 근거와 연결해 볼 수 있어요. 샘플 종목은 실제 보유로 연결하지 않아요.' : '현재 등록한 종목과 이 발표의 사업 연결은 확인하지 못했어요. 회사의 수요·비용 설명을 함께 확인해주세요.'}</p>}
    <div className={styles.eventActions}>
      <button type="button" className={styles.textButton} onClick={() => openEconomicCalendar(event.key)}>발표 내용 자세히<ChevronRight size={16} aria-hidden="true" /></button>
      {topic && <button id={`report-guide-${topic}`} type="button" className={styles.textButton} onClick={() => window.dispatchEvent(new CustomEvent('open-market-guide', { detail: { id: topic, returnFocusId: `report-guide-${topic}` } }))}>영향이 전해지는 과정<ChevronRight size={16} aria-hidden="true" /></button>}
      <a href={result.sourceUrl || event.sourceUrl} target="_blank" rel="noopener noreferrer">결과 출처<span className="sr-only"> (새 창)</span> ↗</a>
    </div>
  </article>;
}
