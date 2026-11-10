'use client';
import {useEffect,useState} from 'react';
import {isBriefDelayed, publicDailyBrief, type DailyBrief} from '@/lib/stockDailyBrief';
import styles from './StockDailyBrief.module.css';
import readingUI from '../ui/ReadingUI.module.css';
type Feed={status:'ok'|'pending'|'unsupported';brief:DailyBrief|null};
export default function StockDailyBrief({symbol}:{symbol:string}) {
 const [feed,setFeed]=useState<Feed|null>(null); const [error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();let active=true;
 fetch(`/api/stock-daily-brief?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])}).then(async r=>{if(!r.ok) throw new Error('unavailable');return r.json() as Promise<Feed>}).then(value=>{if(active)setFeed(value)}).catch(()=>{if(active)setError(true)});
 return()=>{active=false;controller.abort();};},[symbol]);
 const b=feed?.brief ? publicDailyBrief(feed.brief) : null;
 const paragraphs=b?.background?.split(/\n\s*\n/).filter(Boolean)??[];
 if (!b) return <aside className={styles.availability} aria-label="최근 거래일 브리핑">
   {error ? <p role="status">거래일 브리핑을 불러오지 못했어요. 아래 최근 소식을 확인해 주세요.</p> : !feed ? <p role="status">최근 거래일 브리핑을 확인하고 있어요…</p> :
     <details><summary className={readingUI.disclosure}>{feed.status === 'unsupported' ? '거래일 브리핑 · 지원 범위 안내' : '거래일 브리핑 · 첫 자료 준비 중'}</summary>
       <p>{feed.status === 'unsupported' ? '자동 브리핑은 미국 주요 18개 종목을 지원해요. 이 종목은 아래의 최근 소식과 회사 자료를 함께 살펴보세요.' : '첫 브리핑을 준비하고 있어요. 자료가 없는 상태를 특별한 일이 없는 것으로 판단하지 않아요.'}</p>
     </details>}
 </aside>;
 return <section className={styles.brief} aria-label="최근 거래일 브리핑">
 <p className={styles.kicker}>{b?`${b.quote.day} · 미국 거래일`:'최근 거래일'}</p>
 <h3 className={styles.title}>같은 거래일의 주가 비교</h3>
 <div className={styles.comparisons}>{[b.quote,...b.comparisons].map(q=><div key={q.symbol}><span>{q.label}</span><strong>{q.change>0?'+':''}{q.change.toFixed(2)}%</strong></div>)}</div>
 <p className={styles.summary}>{b.summary}</p>
 <p className={styles.meta}>시세 {new Date(b.quote.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 한국시간 · 장중에는 수치가 달라질 수 있어요</p>
 <>{paragraphs[0] && <><h4>보도에서 제기된 배경</h4><p>{paragraphs[0]}</p></>}</>
 {paragraphs.length>1&&<details><summary className={readingUI.disclosure}>배경 더 읽기</summary>{paragraphs.slice(1).map((p,i)=><p key={i}>{p}</p>)}</details>}
 {b.watch&&<div className={styles.watch}><h4>이어서 확인할 것</h4><p>{b.watch}</p></div>}
 {b.searchEntry&&<iframe title="Google 검색 제안" srcDoc={b.searchEntry} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className={styles.searchSuggestions} />}
 {b.warnings.map(w=><p className={styles.meta} key={w}>{w}</p>)}
 {isBriefDelayed(b.checkedAt)&&<p role="status">브리핑 갱신이 지연돼 마지막 확인 자료를 보여드려요.</p>}
 <details><summary className={readingUI.disclosure}>출처와 확인 범위</summary><p className={styles.meta}>시세 비교와 보도 배경을 구분해요. 자동 배경 설명은 표시를 중단한 상태예요. 아래 검색 출처는 사실 검증을 마쳤다는 뜻이 아니에요. 업종 ETF는 미국 상장 상품의 움직임이에요.</p>
 <a href={`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`} target="_blank" rel="noopener noreferrer">가격 자료 · Yahoo Finance</a>
 <ul>{b.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><small>{s.searched?'출처 확인':s.publisher} · {new Date(s.at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</small></li>)}</ul>
 <p className={styles.meta}>변동 폭은 과거 최대 60거래일의 절대 등락률과 비교해요. 비교 자료가 40일 미만이면 평소 대비 판정을 하지 않아요. 자동 브리핑은 미국 주요 18개 종목을 관찰하며 미국장 마감 후 한국시간 오전 6시 10분에 수집을 시작해요.</p>
 </details>
 </section>;
}
