'use client';

import { ChevronRight } from 'lucide-react';
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
  function row(connection: StockGuideConnection) {
    const { stock, evidence } = connection;
    const next = nextRelatedEvent({ kind: 'earnings', symbol: stock.symbol }, events ?? [], now ?? currentTime);
    return <details key={stock.symbol} className={styles.company}>
      <summary>
        <span className={styles.companyTitle}><strong>{connection.name}</strong><small>{connection.level === 'company' ? '공시에서 찾은 연결' : connection.level === 'currency' ? '거래 통화 기준' : '사업 연결 확인 필요'}</small></span>
        <span className={`${styles.path} reading-copy`}><ReadingText>{connection.path}</ReadingText></span>
        <ChevronRight size={18} className={styles.expand} aria-hidden="true" />
      </summary>
      <div className={styles.companyBody}>
        <p className="reading-copy"><strong>확인한 근거</strong><ReadingText>{connection.basis}</ReadingText></p>
        <p className="reading-copy"><strong>달라질 조건</strong><ReadingText>{connection.condition}</ReadingText></p>
        <p className="reading-copy"><strong>다음에 볼 것</strong><ReadingText>{connection.watch}</ReadingText></p>
        {next ? <button type="button" className={styles.textButton} onClick={() => openEconomicCalendar(next.key)}>다음 실적 · {dateLabel(next.at)} · {eventTime(next)}<ChevronRight size={16} aria-hidden="true" /></button>
          : <p className={styles.meta}>{events === undefined ? '실적 일정을 확인하고 있어요…' : events === null ? '실적 일정을 불러오지 못했어요. 회사의 공식 발표를 확인해주세요.' : '확인된 다음 실적 일정이 없어요. 회사의 공식 발표를 확인해주세요.'}</p>}
        <div className={styles.companyActions}>
          <button type="button" className={styles.textButton} onClick={() => usePortfolioStore.getState().setAnalysisSymbol(stock.symbol)}>{connection.name} 자세히<ChevronRight size={16} aria-hidden="true" /></button>
          {evidence && <a href={evidence.source.url} target="_blank" rel="noopener noreferrer">사업 근거 읽기<span className="sr-only"> (새 창)</span> ↗</a>}
        </div>
        {evidence && <p className={styles.meta}>{evidence.source.period} 자료 · {evidence.source.reviewedAt} 근거 확인<br />사업 자료를 바탕으로 정리한 점검 경로예요. 이번 발표의 실적 영향이 확인됐다는 뜻은 아니에요.</p>}
      </div>
    </details>;
  }
  return <div className={styles.companies}>
    {connections.slice(0, 2).map(row)}
    {connections.length > 2 && <details className={styles.moreCompanies}><summary>다른 등록 종목 {connections.length - 2}개도 보기</summary>{connections.slice(2).map(row)}</details>}
  </div>;
}
