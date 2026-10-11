'use client';

import { useId, useState } from 'react';
import { INDUSTRY_GROUPS } from '@/lib/industryRegistry';
import { SECTORS, sectorCompany, type SectorId } from '@/lib/sectorExploration';
import styles from './ContextExploration.module.css';

export default function IndustryDirectory({ onSelect, onSector }: { onSelect: (id: string) => void; onSector?: (id: SectorId) => void }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('all');
  const [limit, setLimit] = useState(24);
  const id = useId();
  const search = query.trim().toLocaleLowerCase();
  const groups = INDUSTRY_GROUPS.filter(group => (market === 'all' || group.market === market)
    && (!search || `${group.name} ${group.raw} ${group.examples.map(c => c.name + ' ' + c.symbol).join(' ')}`.toLocaleLowerCase().includes(search)));
  const businessAreas = SECTORS.filter(area => area.parent && area.companies.some(symbol => market === 'all' || (market === 'kr') === /\.(KS|KQ)$/.test(symbol))
    && (!search || `${area.name} ${area.companies.map(symbol => `${symbol} ${sectorCompany(symbol)?.name ?? ''}`).join(' ')}`.toLocaleLowerCase().includes(search)));
  return <details className={styles.directory} data-industry-directory>
    <summary>사업 분야·세부 업종 전체 보기 <span>미국·한국 원본 업종 {INDUSTRY_GROUPS.length}개</span></summary>
    <div className={styles.industryFilters}>
      <div className={styles.industryField}><label htmlFor={`${id}-query`}>업종 찾기</label><input id={`${id}-query`} type="search" value={query} placeholder="예: 양자, 서버, 저장장치, 의약" onChange={e => { setQuery(e.target.value); setLimit(24); }} /></div>
      <div className={styles.industryField}><label htmlFor={`${id}-market`}>분류 자료</label><select id={`${id}-market`} value={market} onChange={e => { setMarket(e.target.value); setLimit(24); }}><option value="all">미국·한국</option><option value="us">미국</option><option value="kr">한국</option></select></div>
    </div>
    {onSector && businessAreas.length > 0 && <div data-business-directory><h4>실제 사업 분야로 찾기</h4><p className={styles.note}>공식 사업 자료를 확인한 기업을 제품·서비스의 역할로 연결했어요. 모든 관련 기업을 조사한 목록은 아니에요.</p><div className={styles.directoryGrid}>{businessAreas.map(area => <button type="button" key={area.id} data-business-choice={area.id} onClick={() => onSector(area.id)}>{area.name} →</button>)}</div></div>}
    <h4>자료 제공처의 업종으로 찾기</h4>
    <p className={styles.note}>나라별 자료의 업종 이름을 그대로 구분했어요. 비슷한 이름도 분류 범위가 다를 수 있어요.</p>
    <p className={styles.note} role="status">{groups.length}개 업종 중 {Math.min(limit, groups.length)}개 표시</p>
    <div className={styles.directoryGrid}>{groups.slice(0, limit).map(group => <button type="button" key={group.id} data-industry-choice={group.id} onClick={() => onSelect(group.id)}>{group.name} →<small className={styles.directoryMeta}>{group.market === 'us' ? '미국' : '한국'} · 자료에 포함된 종목 {group.count}개</small></button>)}</div>
    {groups.length === 0 && businessAreas.length === 0 && <p className={styles.note}>일치하는 업종이 없어요. 다른 이름으로 찾아보세요.</p>}
    {limit < groups.length && <button type="button" onClick={() => setLimit(value => value + 24)}>업종 더 보기 +</button>}
  </details>;
}
