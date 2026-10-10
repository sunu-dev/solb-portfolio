'use client';

import { useId, useState } from 'react';
import { INDUSTRY_GROUPS } from '@/lib/industryRegistry';
import styles from './ContextExploration.module.css';

export default function IndustryDirectory({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('all');
  const [limit, setLimit] = useState(24);
  const id = useId();
  const search = query.trim().toLocaleLowerCase();
  const groups = INDUSTRY_GROUPS.filter(group => (market === 'all' || group.market === market)
    && (!search || `${group.name} ${group.raw} ${group.examples.map(c => c.name + ' ' + c.symbol).join(' ')}`.toLocaleLowerCase().includes(search)));
  return <details className={styles.directory} data-industry-directory>
    <summary>세부 업종 전체 보기 <span>미국·한국 업종 {INDUSTRY_GROUPS.length}개</span></summary>
    <div className={styles.industryFilters}>
      <div className={styles.industryField}><label htmlFor={`${id}-query`}>업종 찾기</label><input id={`${id}-query`} type="search" value={query} placeholder="예: 보험, 철강, 소프트웨어" onChange={e => { setQuery(e.target.value); setLimit(24); }} /></div>
      <div className={styles.industryField}><label htmlFor={`${id}-market`}>분류 자료</label><select id={`${id}-market`} value={market} onChange={e => { setMarket(e.target.value); setLimit(24); }}><option value="all">미국·한국</option><option value="us">미국</option><option value="kr">한국</option></select></div>
    </div>
    <p className={styles.note}>나라별 자료의 업종 이름을 그대로 구분했어요. 비슷한 이름도 분류 범위가 다를 수 있어요.</p>
    <p className={styles.note} role="status">{groups.length}개 업종 중 {Math.min(limit, groups.length)}개 표시</p>
    <div className={styles.directoryGrid}>{groups.slice(0, limit).map(group => <button type="button" key={group.id} data-industry-choice={group.id} onClick={() => onSelect(group.id)}>{group.name} →<small className={styles.directoryMeta}>{group.market === 'us' ? '미국' : '한국'} · 자료에 포함된 종목 {group.count}개</small></button>)}</div>
    {groups.length === 0 && <p className={styles.note}>일치하는 업종이 없어요. 다른 이름으로 찾아보세요.</p>}
    {limit < groups.length && <button type="button" onClick={() => setLimit(value => value + 24)}>업종 더 보기 +</button>}
  </details>;
}
