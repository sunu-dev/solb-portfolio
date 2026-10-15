'use client';

import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNow } from '@/hooks/useNow';
import { nextRelatedEvent, type StockGuideConnection } from '@/lib/guideConnections';
import { eventTime, type EconomicEvent } from '@/lib/economicEvents';
import { openEconomicCalendar } from '@/components/economy/EconomicHighlights';
import ReadingText from '@/components/common/ReadingText';
import styles from './PersonalMarketReport.module.css';

const dateLabel = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(at));

export default function CompanyConnections({ connections, events, now }: {
  connections: StockGuideConnection[];
  events?: EconomicEvent[] | null;
  now?: number;
}) {
  const currentTime = useNow();
  if (!connections.length) return null;
  const supported = [...connections.filter(item => item.level === 'company'), ...connections.filter(item => item.level === 'currency')];
  const unverified = connections.filter(item => item.level === 'unverified');
  const openStock = (symbol: string) => usePortfolioStore.getState().setAnalysisSymbol(symbol);
  function row(connection: StockGuideConnection) {
    const { stock, evidence } = connection;
    // A fund or a currency-only connection must not acquire a fictitious company earnings schedule.
    const next = connection.level === 'company' ? nextRelatedEvent({ kind: 'earnings', symbol: stock.symbol }, events ?? [], now ?? currentTime) : undefined;
    return <details key={stock.symbol} className={styles.company}>
      <summary>
        <span className={styles.companyTitle}><strong>{connection.name}</strong><small>{connection.level === 'company' ? '사업 자료로 확인' : '거래 통화 기준'}</small></span>
        <span className={`${styles.path} reading-copy`}><ReadingText>{connection.path}</ReadingText></span>
        <span className={styles.rowHint}>근거와 확인할 점</span>
        <ChevronRight size={18} className={styles.expand} aria-hidden="true" />
      </summary>
      <div className={styles.companyBody}>
        <dl className={styles.connectionFacts}>
          <div><dt>연결의 근거</dt><dd className="reading-copy"><ReadingText>{connection.basis}</ReadingText></dd></div>
          <div><dt>달라질 조건</dt><dd className="reading-copy"><ReadingText>{connection.condition}</ReadingText></dd></div>
          <div><dt>다음에 볼 것</dt><dd className="reading-copy"><ReadingText>{connection.watch}</ReadingText></dd></div>
        </dl>
        {connection.level === 'company' && (next ? <button type="button" className={styles.textButton} onClick={() => openEconomicCalendar(next.key)}>다음 실적 · {dateLabel(next.at)} · {eventTime(next)}<ChevronRight size={16} aria-hidden="true" /></button>
          : <p className={styles.meta}>{events === undefined ? '실적 일정을 확인하고 있어요…' : events === null ? '실적 일정을 불러오지 못했어요. 회사의 공식 발표를 확인해주세요.' : '확인된 다음 실적 일정이 없어요. 회사의 공식 발표를 확인해주세요.'}</p>)}
        <div className={styles.companyActions}>
          <button type="button" className={styles.textButton} onClick={() => openStock(stock.symbol)}>{connection.name} 알아보기<ChevronRight size={16} aria-hidden="true" /></button>
          {evidence && <a href={evidence.source.url} target="_blank" rel="noopener noreferrer">사업 자료 원문<span className="sr-only"> (새 창)</span><ArrowUpRight size={14} aria-hidden="true" /></a>}
        </div>
        {evidence && <p className={styles.meta}>{evidence.source.period} 자료 · {evidence.source.reviewedAt} 근거 확인<br />사업 자료로 정리한 점검 경로이며, 이번 발표의 실적 영향이 확인됐다는 뜻은 아니에요.</p>}
      </div>
    </details>;
  }
  const stockLink = (connection: StockGuideConnection) => <button key={connection.stock.symbol} type="button" className={styles.stockChip} onClick={() => openStock(connection.stock.symbol)}>{connection.name}<ChevronRight size={14} aria-hidden="true" /></button>;
  return <div className={styles.companies}>
    {supported.length > 0 && <>
      <div className={styles.connectionHeading}><strong>확인된 연결 <span>{supported.length}</span></strong><p>사업 근거가 있는 종목부터 보여드려요. 주가 영향 순위는 아니에요.</p></div>
      {supported.slice(0, 2).map(row)}
      {supported.length > 2 && <details className={styles.moreCompanies}><summary>확인된 다른 연결 {supported.length - 2}개</summary>{supported.slice(2).map(row)}</details>}
    </>}
    {unverified.length > 0 && <div className={styles.unverified}>
      <div className={styles.connectionHeading}><strong>연결을 더 확인할 종목 <span>{unverified.length}</span></strong></div>
      <p>이번 발표와의 구체적인 사업 연결 근거는 아직 확인하지 못했어요. 종목을 눌러 사업이나 상품 구조부터 살펴보세요.</p>
      <div className={styles.stockChips}>{unverified.slice(0, 6).map(stockLink)}</div>
      {unverified.length > 6 && <details className={styles.moreCompanies}><summary>다른 종목 {unverified.length - 6}개 보기</summary><div className={styles.stockChips}>{unverified.slice(6).map(stockLink)}</div></details>}
    </div>}
  </div>;
}
