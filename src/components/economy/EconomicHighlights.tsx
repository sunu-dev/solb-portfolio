'use client';
import { useNow } from '@/hooks/useNow';
import { useEconomicEvents } from '@/hooks/useEconomicEvents';
import { ECON_EXPLAIN, eventTime, kstDay, recentResults, inUserPortfolio } from '@/lib/economicEvents';
import type { EconomicEvent } from '@/lib/economicEvents';
import { EventDefinition, ImpactPath } from './EventLearning';
import styles from './EconomicCalendar.module.css';
export function openEconomicCalendar(key?: string) { window.dispatchEvent(new CustomEvent('open-economic-calendar',{detail:{key}})); }
export function EventExplanation({ event, symbols }: { event: EconomicEvent; symbols: string[] }) {
  return <>
    <EventDefinition kind={event.kind} />
    {event.result && <>
      <p className={styles.title}>{event.result.headline}</p>
      {(event.result.actual || event.result.forecast) && <dl className={styles.numbers}>
        <div><dt>{event.kind === 'earnings' ? '주당순이익' : event.kind === 'jobs' ? '실업률' : event.kind === 'fomc' ? '발표 다음 날' : '확인 수치'}</dt><dd>{event.result.actual || '확인 중'}</dd></div>
        <div><dt>시장 예상</dt><dd>{event.result.forecast || '자료 없음'}</dd></div>
        <div><dt>{event.kind === 'fomc' ? '발표일 기준' : '이전 수치'}</dt><dd>{event.result.previous || '—'}</dd></div>
      </dl>}
      {event.result.note && <p className={styles.muted}>{event.result.note}</p>}
    </>}
    {event.result?.meaning && <div className={styles.explain}><h3>이번 발표는 어떤 의미인가요?</h3><p>{event.result.meaning}</p></div>}
    <ImpactPath kind={event.kind} />
    <div className={styles.explain}><h3>{inUserPortfolio(event,symbols) ? '내 종목과 함께 볼 것' : '무엇을 같이 봐야 하나요?'}</h3><p>{ECON_EXPLAIN[event.kind].watch}</p>
      {event.symbol && <p className={styles.muted}>관련 종목 · {event.symbol}</p>}
      {!event.symbol && inUserPortfolio(event,symbols) && <p className={styles.muted}>보유·관심 종목에 해당 시장의 종목이 있어요. 종목별 영향과 주가 방향을 확정하는 설명은 아니에요.</p>}
    </div>
    <a className={styles.link} href={event.result?.sourceUrl || event.sourceUrl} target="_blank" rel="noreferrer">{event.result ? '결과 출처 확인' : '공식 일정 확인'} ↗</a>
  </>;
}
export default function EconomicHighlights({ compact = false }: { compact?: boolean }) {
  const { data,error,symbols,retry } = useEconomicEvents();
  const now = useNow();
  const recent = data ? recentResults(data.events,now).slice(0,compact ? 1 : 3) : [];
  const upcoming = data?.events.filter(e=>Date.parse(e.at)>now && (!compact || e.kind !== 'holiday')).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(0,compact ? 1 : 2) || [];
  return <section className={styles.panel} aria-label="경제 일정 브리핑">
    <div className={styles.heading}><h2>{compact ? '주비가 챙긴 일정' : '발표 후, 알아둘 것'}</h2><button className={styles.link} onClick={()=>openEconomicCalendar()}>일정 보기 ›</button></div>
    {!data && !error && <p className={styles.muted} role="status">공식 일정과 발표 결과를 확인하고 있어요…</p>}
    {error && <p className={styles.muted}>{error} <button className={styles.link} onClick={retry}>다시 시도</button></p>}
    {recent.map(event=><article key={event.key} className={styles.row}>
      <div className={styles.meta}><span className={styles.badge}>결과 확인</span><span>{kstDay(event.at).slice(5).replace('-','/')} · {event.title}</span></div>
      {compact ? <><EventDefinition kind={event.kind} compact /><p className={styles.title}>{event.result!.headline}</p><p className={styles.summary}>{event.result?.meaning || ECON_EXPLAIN[event.kind].why}</p><button className={styles.link} onClick={()=>openEconomicCalendar(event.key)}>내 주식까지 이어지는 과정 ›</button></> : <EventExplanation event={event} symbols={symbols} />}
    </article>)}
    {data && !recent.length && <p className={styles.muted}>최근 7일간 확인된 새 발표 결과가 없어요. 예정된 일정을 먼저 살펴보세요.</p>}
    {upcoming.map(event=><button key={event.key} className={styles.upcoming} onClick={()=>openEconomicCalendar(event.key)}>{kstDay(event.at).slice(5).replace('-','/')} · {event.title}<span className={styles.muted} style={{display:'block'}}>{eventTime(event)}</span></button>)}
    {data && !compact && <p className={styles.muted}>한국시간 기준 · 확인된 결과만 표시해요. {data.warnings.length>0 && '일부 자료는 확인 중이에요. 일정에서 상태를 볼 수 있어요.'}</p>}
  </section>;
}
