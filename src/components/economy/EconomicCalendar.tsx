'use client';
import { useEffect, useRef, useState } from 'react';
import { useEconomicEvents } from '@/hooks/useEconomicEvents';
import { eventState, eventTime, kstDay } from '@/lib/economicEvents';
import { EventExplanation } from './EconomicHighlights';
import styles from './EconomicCalendar.module.css';
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`)+n*86400000).toISOString().slice(0,10);
const shiftMonth = (day: string, n: number) => { const date = new Date(`${day.slice(0,7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth()+n); return date.toISOString().slice(0,10); };
const monday = (day: string) => shift(day,-((new Date(`${day}T00:00:00Z`).getUTCDay()+6)%7));
const stateText = { scheduled:'발표 예정', pending:'결과 확인 중', released:'결과 확인', closed:'휴장' };
export function EconomicCalendarContent({ focusKey }: { focusKey?: string }) {
  const {data,error,symbols,retry}=useEconomicEvents();
  const [day,setDay]=useState(()=>kstDay(Date.now()));
  const [mode,setMode]=useState<'week'|'month'|'results'>('week');
  const [filter,setFilter]=useState('all');
  const focused = data?.events.find(e=>e.key===focusKey);
  const selectedDay = focused ? kstDay(focused.at) : day;
  const [manual,setManual]=useState(false);
  const activeDay = manual ? day : selectedDay;
  const chooseDay=(value:string)=>{setManual(true);setDay(value);};
  const start=monday(activeDay), end=shift(start,7);
  const events=(data?.events || []).filter(e=>filter==='all'||(filter==='macro'&&!['earnings','holiday'].includes(e.kind))||e.kind===filter);
  const visible=events.filter(e=>mode==='results' ? eventState(e)==='released' : mode==='week' ? kstDay(e.at)>=start&&kstDay(e.at)<end : kstDay(e.at)===activeDay).sort((a,b)=> mode==='results' ? Date.parse(b.at)-Date.parse(a.at):Date.parse(a.at)-Date.parse(b.at));
  const groups=[...new Set(visible.map(e=>kstDay(e.at)))];
  const monthStart=activeDay.slice(0,7)+'-01';
  const gridStart=shift(monthStart,-new Date(`${monthStart}T00:00:00Z`).getUTCDay());
  return <>
    <p className={styles.muted}>한국시간으로 챙기는 발표 일정. 결과를 열면 왜 중요한지 함께 설명해드려요.</p>
    <div className={styles.toolbar} aria-label="일정 보기 방식">{[['week','주간'],['month','월간'],['results','발표 결과']].map(([value,label])=><button key={value} className={styles.button} aria-pressed={mode===value} onClick={()=>setMode(value as typeof mode)}>{label}</button>)}</div>
    <div className={styles.toolbar} aria-label="일정 종류">{[['all','전체'],['macro','경제지표'],['earnings','내 종목 실적'],['holiday','휴장일']].map(([value,label])=><button key={value} className={styles.button} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {mode!=='results' && <div className={styles.heading}><button className={styles.button} aria-label="이전 기간" onClick={()=>chooseDay(mode==='week'?shift(activeDay,-7):shiftMonth(activeDay,-1))}>‹</button><strong>{mode==='week'?`${start.slice(5).replace('-','/')} – ${shift(end,-1).slice(5).replace('-','/')}`:activeDay.slice(0,7).replace('-','년 ')+'월'}</strong><button className={styles.button} aria-label="다음 기간" onClick={()=>chooseDay(mode==='week'?shift(activeDay,7):shiftMonth(activeDay,1))}>›</button><button className={styles.button} onClick={()=>chooseDay(kstDay(Date.now()))}>오늘</button></div>}
    {mode==='month' && <div className={styles.dates} aria-label="월간 날짜 선택">{['일','월','화','수','목','금','토'].map(d=><span key={d} className={styles.muted} style={{textAlign:'center'}}>{d}</span>)}{Array.from({length:42},(_,i)=>{const d=shift(gridStart,i), count=events.filter(e=>kstDay(e.at)===d).length;return <button className={styles.day} key={d} aria-pressed={d===activeDay} aria-label={`${d} 일정 ${count}개`} style={{opacity:d.slice(0,7)===activeDay.slice(0,7)?1:.45}} onClick={()=>chooseDay(d)}>{Number(d.slice(-2))}{count>0&&<span className={styles.dot}/>}</button>;})}</div>}
    {!data&&!error&&<p role="status" className={styles.muted}>발표 자료를 확인하고 있어요…</p>}
    {error&&<p role="alert">{error}<button className={styles.button} onClick={retry}>다시 시도</button></p>}
    {data&&!visible.length&&<p className={styles.muted}>이 기간에 확인된 일정이 없어요. {filter==='earnings'?'실적 일정은 제공처에서 확인된 미국 보유·관심 종목을 표시해요.':'기간이나 필터를 바꿔보세요.'}</p>}
    {groups.map(date=><section key={date}><h3 className={styles.dayHeading}>{date.slice(5).replace('-','/')} · {new Intl.DateTimeFormat('ko-KR',{weekday:'long',timeZone:'Asia/Seoul'}).format(new Date(`${date}T12:00:00+09:00`))}</h3>{visible.filter(e=>kstDay(e.at)===date).map(event=><details className={styles.row} key={event.key} open={focusKey===event.key||undefined}><summary><div className={styles.meta}><span>{eventTime(event)}</span><span className={styles.badge}>{stateText[eventState(event)]}</span>{event.symbol&&<span>내 종목</span>}</div><div className={styles.title}>{event.title} <span aria-hidden="true">⌄</span></div>{event.period&&<p className={styles.muted}>{event.period.replace('-','년 ')}월 지표</p>}</summary><EventExplanation event={event} symbols={symbols}/></details>)}</section>)}
    {data&&<details className={styles.row}><summary className={styles.muted}>자료 확인 상태 · {kstDay(data.checkedAt)}</summary><p className={styles.muted}>일정은 변경될 수 있어요. 발표 수치를 확인한 뒤에만 결과로 표시해요. 시장 반응을 발표의 영향으로 단정하지 않아요.</p>{data.warnings.map(w=><p key={w} className={styles.muted}>{w}</p>)}<p className={styles.muted}>실적 일정은 최대 30개 보유·관심 종목을 조회해요. {symbols.length>30?'30개를 넘어 일부 종목은 제외됐어요.':''}</p></details>}
  </>;
}
export default function EconomicCalendar() {
  const ref=useRef<HTMLDialogElement>(null);
  const [focusKey,setFocusKey]=useState<string>();
  const [open,setOpen]=useState(false);
  useEffect(()=>{const show=(event:Event)=>{setFocusKey((event as CustomEvent).detail?.key);setOpen(true);ref.current?.showModal();};window.addEventListener('open-economic-calendar',show);return ()=>window.removeEventListener('open-economic-calendar',show);},[]);
  return <dialog ref={ref} className={styles.dialog} aria-label="경제 일정" onClose={()=>setOpen(false)} onClick={e=>{if(e.target===ref.current)ref.current.close();}}><header className={styles.header}><div className={styles.heading}><h2>경제 일정</h2><button className={styles.button} onClick={()=>ref.current?.close()}>닫기</button></div></header><div className={styles.body}>{open&&<EconomicCalendarContent key={focusKey||'all'} focusKey={focusKey}/>}</div></dialog>;
}
