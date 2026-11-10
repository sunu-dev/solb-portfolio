'use client';

import { useState } from 'react';
import type { NewsItem } from '@/config/constants';
import { useDiscoveryHistory } from '@/hooks/useDiscoveryHistory';
import { useNow } from '@/hooks/useNow';
import { compareDiscovery, type DiscoverySnapshot } from '@/lib/stockDiscovery';
import styles from './StockReturnBrief.module.css';

interface Props {
  owner: string;
  symbol: string;
  items: NewsItem[];
  status: 'loading' | 'ok' | 'empty' | 'error';
  isFund: boolean;
  onCompany: () => void;
  onNews: () => void;
}

/** A stable starting point; full article titles appear only in the news section. */
export default function StockVisitSummary(props: Props) {
  const { history, ready } = useDiscoveryHistory(props.owner);
  return ready ? <Summary key={`${props.owner}:${props.symbol}`} {...props} previous={history.stocks[props.symbol]} /> : null;
}

function Summary({ previous, items, status, isFund, onCompany, onNews }: Props & { previous?: DiscoverySnapshot }) {
  const [baseline] = useState(previous);
  const now = useNow();
  const { newItems } = compareDiscovery(baseline, { viewedAt: now, news: [] }, items);
  if (!baseline) return null;
  return <aside className={styles.visit} aria-label="이어서 살펴볼 내용" data-visit-summary>
    {baseline ? <>
      <p>{status === 'loading' ? '지난 확인 이후의 소식을 확인하고 있어요.'
        : status === 'error' ? '최근 소식을 가져오지 못했어요. 상품·사업 설명은 계속 볼 수 있어요.'
        : newItems.length ? `지난 확인 뒤 발행된 새 기사가 ${newItems.length}건 있어요.`
        : '제공된 자료에서 지난 확인 뒤 발행된 새 기사는 찾지 못했어요.'}</p>
      <div><button type="button" onClick={onNews}>최근 소식과 확인할 점 보기 →</button>
        <button type="button" onClick={onCompany}>{isFund ? '상품 구조 다시 보기' : '사업 설명 다시 보기'}</button></div>
    </> : null}
  </aside>;
}
