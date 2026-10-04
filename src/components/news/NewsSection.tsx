'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Newspaper, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { formatRelativeKo } from '@/utils/koreanDate';
import { useNow } from '@/hooks/useNow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { NEWS_QUERIES } from '@/config/constants';
import { decodeNewsTitle, getNewsTargets, mergeRelatedNews, newsClient, NEWS_BATCH_SIZE, NEWS_STALE_MS,
  type NewsQuery, type NewsResponse, type NewsTarget, type RelatedNewsItem } from '@/lib/newsFeed';
import styles from './NewsSection.module.css';

const NEWS_TABS = [
  { id: 'all', label: '내 종목' }, { id: 'us', label: '미국 시장' },
  { id: 'kr', label: '한국 시장' }, { id: 'my', label: '관심 종목' }, { id: 'hot', label: '주요 경제' },
];
type FeedState = { key: string; items: RelatedNewsItem[]; pending: boolean; failures: number;
  completed: number; total: number; fetchedAt: number; error: 'network' | 'server' | 'timeout' | null };
const INITIAL_FEED: FeedState = { key: '', items: [], pending: true, failures: 0,
  completed: 0, total: 0, fetchedAt: 0, error: null };

export default function NewsSection() {
  const { currentNewsMarket, setCurrentNewsMarket, investing, watching, autoRefresh } = usePortfolioStore(useShallow(state => ({
    currentNewsMarket: state.currentNewsMarket, setCurrentNewsMarket: state.setCurrentNewsMarket,
    investing: state.stocks.investing, watching: state.stocks.watching, autoRefresh: state.autoRefresh,
  })));
  const [batch, setBatch] = useState(0);
  const [refresh, setRefresh] = useState({ key: '', count: 0 });
  const [feed, setFeed] = useState<FeedState>(INITIAL_FEED);
  const lastForcedRefresh = useRef('');
  const now = useNow();
  const personal = currentNewsMarket === 'all' || currentNewsMarket === 'my';
  const targets = useMemo(() => getNewsTargets(currentNewsMarket === 'all' ? investing : watching),
    [currentNewsMarket, investing, watching]);
  const batchCount = Math.ceil(targets.length / NEWS_BATCH_SIZE);
  const activeBatch = Math.min(batch, Math.max(0, batchCount - 1));
  const selectedTargets = useMemo(() => targets.slice(activeBatch * NEWS_BATCH_SIZE, (activeBatch + 1) * NEWS_BATCH_SIZE),
    [targets, activeBatch]);
  const queries = useMemo<{ query: NewsQuery; target?: NewsTarget }[]>(() => personal
    ? selectedTargets.map(target => ({ target, query: { q: target.query, locale: 'ko', maxHours: 48 } }))
    : [{ query: NEWS_QUERIES[currentNewsMarket] || NEWS_QUERIES.us }], [personal, selectedTargets, currentNewsMarket]);
  const requestKey = JSON.stringify([currentNewsMarket, queries]);
  const visible = feed.key === requestKey ? feed : { ...INITIAL_FEED, total: queries.length };
  // useNow ticks once a minute; a response received between ticks is already in the past.
  const displayNow = Math.max(now, visible.fetchedAt);
  const refreshCount = refresh.key === requestKey ? refresh.count : 0;

  useEffect(() => {
    let active = true;
    const refreshKey = `${requestKey}:${refreshCount}`;
    const force = refreshCount > 0 && lastForcedRefresh.current !== refreshKey;
    if (force) lastForcedRefresh.current = refreshKey;
    const responses = new Map<number, NewsResponse>();
    const completed = new Set<number>();
    const errors = new Map<number, 'network' | 'server' | 'timeout'>();
    const publish = () => {
      if (!active) return;
      const entries = [...responses].sort(([a], [b]) => a - b);
      const items = personal
        ? mergeRelatedNews(entries.map(([index, response]) => ({ target: queries[index].target!, response })))
        : (entries[0]?.[1].result.items || []).map(item => ({ ...item, relatedNames: [] }));
      const times = entries.map(([, response]) => response.fetchedAt);
      setFeed({ key: requestKey, items, pending: completed.size < queries.length,
        failures: errors.size, completed: completed.size, total: queries.length,
        fetchedAt: times.length ? Math.min(...times) : 0, error: errors.values().next().value || null });
    };
    queries.forEach(({ query }, index) => {
      const cached = newsClient.peek(query);
      if (cached) responses.set(index, cached);
    });
    publish();
    // Each target creates one Promise. Progressive results and completion use the same request.
    queries.forEach(({ query }, index) => {
      void newsClient.load(query, force).then(response => {
        if (!active) return;
        completed.add(index);
        if (response.result.status === 'error') errors.set(index, response.result.reason);
        else responses.set(index, response);
        publish();
      });
    });
    return () => { active = false; };
  }, [requestKey, queries, personal, refreshCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && feed.key === requestKey && !feed.pending
        && Date.now() - feed.fetchedAt >= NEWS_STALE_MS) {
        setRefresh(previous => ({ key: requestKey, count: previous.key === requestKey ? previous.count + 1 : 1 }));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = autoRefresh ? setInterval(onVisibility, 60_000) : undefined;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearInterval(timer);
    };
  }, [feed.key, feed.fetchedAt, feed.pending, requestKey, autoRefresh]);

  const retry = () => setRefresh(previous => ({ key: requestKey, count: previous.key === requestKey ? previous.count + 1 : 1 }));
  const openSearch = () => document.querySelector<HTMLButtonElement>('[data-slot="search-trigger"]')?.click();
  const isEmptyPortfolio = personal && targets.length === 0;
  const errorMessage = visible.error === 'timeout' ? '뉴스를 가져오는 데 시간이 오래 걸리고 있어요.'
    : visible.error === 'network' ? '연결 상태를 확인하고 다시 시도해주세요.' : '뉴스를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

  return (
    <section className={styles.section} aria-labelledby="news-title">
      <header className={styles.header}>
        <div><h1 id="news-title">소식</h1><p>내 종목과 시장에서 어떤 일이 있었는지 살펴보세요.</p></div>
        {!isEmptyPortfolio && <button type="button" className={styles.refresh} onClick={retry} disabled={visible.pending}
          aria-label="뉴스 새로고침"><RefreshCw size={18} aria-hidden="true" /></button>}
      </header>
      <div className={styles.tabs} data-tour="news-tabs" role="group" aria-label="뉴스 범위">
        {NEWS_TABS.map(tab => <button key={tab.id} type="button" aria-pressed={currentNewsMarket === tab.id}
          onClick={() => { setBatch(0); setCurrentNewsMarket(tab.id); }}>{tab.label}</button>)}
      </div>

      {personal && targets.length > 0 && <div className={styles.coverage}>
        <p className={styles.companyNames}>{selectedTargets.map(target => target.name).join(' · ')}</p>
        <p>회사명으로 찾은 최근 48시간의 기사예요. 검색 결과에는 다른 회사 이야기가 섞일 수 있어요.</p>
        {batchCount > 1 && <div className={styles.pagination}>
          <span>전체 {targets.length}개 중 {activeBatch * NEWS_BATCH_SIZE + 1}–{Math.min((activeBatch + 1) * NEWS_BATCH_SIZE, targets.length)}번째 종목</span>
          <div><button type="button" aria-label="이전 종목 뉴스" disabled={activeBatch === 0} onClick={() => setBatch(activeBatch - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <button type="button" aria-label="다음 종목 뉴스" disabled={activeBatch + 1 >= batchCount} onClick={() => setBatch(activeBatch + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div>
        </div>}
      </div>}

      {!isEmptyPortfolio && <div className={styles.status} role="status">
        {visible.pending ? visible.items.length ? '나머지 소식을 확인하고 있어요.' : '소식을 불러오고 있어요.'
          : visible.failures > 0 ? visible.items.length ? `${visible.failures}개 검색을 완료하지 못해 확인된 기사부터 보여드려요.` : errorMessage
            : visible.fetchedAt > 0 ? `기사 목록 ${formatRelativeKo(visible.fetchedAt, displayNow)} 확인` : ''}
        {!visible.pending && visible.failures > 0 && visible.fetchedAt > 0 && <span>목록 확인: {formatRelativeKo(visible.fetchedAt, displayNow)}</span>}
        {!visible.pending && visible.failures > 0 && visible.items.length > 0 && <button type="button" onClick={retry}>다시 확인</button>}
      </div>}

      {visible.items.length > 0 ? <ul className={styles.list}>
        {visible.items.slice(0, 20).map(item => {
          const title = decodeNewsTitle(item.title);
          const published = item.pubDate ? formatRelativeKo(item.pubDate, displayNow) : '';
          return <li key={item.link}>
            <a className={styles.article} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`${title} (새 창)`}>
              <div className={styles.articleBody}>
                {item.relatedNames.length > 0 && <span className={styles.related}>{item.relatedNames.join(' · ')} 관련 검색</span>}
                <h2>{title}</h2>
                <div className={styles.meta}>{item.source && <span>{item.source}</span>}{published && <time dateTime={item.pubDate}>{published}</time>}</div>
              </div><ArrowUpRight className={styles.external} size={17} aria-hidden="true" />
            </a>
          </li>;
        })}
      </ul> : visible.pending && !isEmptyPortfolio ? <div className={styles.skeleton} aria-hidden="true">
        {[0, 1, 2, 3].map(index => <div key={index}><div className="skeleton-shimmer" /><div className="skeleton-shimmer" /></div>)}
      </div> : <div className={styles.empty}>
        <Newspaper size={30} aria-hidden="true" />
        <h2>{isEmptyPortfolio ? currentNewsMarket === 'my' ? '관심 종목을 추가해보세요' : '보유 종목을 추가해보세요'
          : visible.failures ? '소식을 확인하지 못했어요' : '지금 검색된 기사가 없어요'}</h2>
        <p>{isEmptyPortfolio ? '등록한 회사와 관련된 기사를 모아서 보여드려요.'
          : visible.failures ? errorMessage : personal ? '최근 48시간 동안 이 회사명으로 찾은 기사가 없어요. 다른 종목이나 시장 소식도 살펴보세요.'
            : '현재 검색 범위에서 기사가 확인되지 않았어요. 다른 시장 소식도 살펴보세요.'}</p>
        <button type="button" onClick={isEmptyPortfolio ? openSearch : retry}>{isEmptyPortfolio ? '종목 찾기' : '다시 확인하기'}</button>
      </div>}
    </section>
  );
}
