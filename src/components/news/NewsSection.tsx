'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData, fetchKoreanNews } from '@/hooks/useStockData';
import { STOCK_KR } from '@/config/constants';
import type { NewsTag, NewsItem } from '@/config/constants';
import EmptyState from '@/components/common/EmptyState';

function decodeHtml(text: string) {
  // 안전한 HTML 엔티티 디코딩 (innerHTML XSS 방지)
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

const NEWS_TABS = [
  { id: 'all', label: '내 종목' },
  { id: 'us', label: '미국 시장' },
  { id: 'kr', label: '한국 시장' },
  { id: 'my', label: '관심 종목' },
  { id: 'hot', label: '인기' },
];

// 마지막 fetch가 어떻게 끝났는지 — EmptyState 분기에 사용
type FetchStatus = 'idle' | 'ok' | 'empty' | 'network' | 'server' | 'timeout';

function getNewsTag(title: string): NewsTag & { type: string } {
  const t = title.toLowerCase();
  if (t.includes('이란') || t.includes('전쟁') || t.includes('중동'))
    return { label: '전쟁', bg: '#FFF0F0', color: '#EF4452', type: 'kr' };
  if (t.includes('반도체') || t.includes('ai') || t.includes('hbm') || t.includes('엔비디아'))
    return { label: 'AI/반도체', bg: '#F0F4FF', color: '#3182F6', type: 'us' };
  if (t.includes('마이크론') || t.includes('마이크로소프트') || t.includes('브로드코') || t.includes('아마존'))
    return { label: '보유종목', bg: '#F0FAF0', color: '#20C997', type: 'interest' };
  if (t.includes('나스닥') || t.includes('s&p') || t.includes('증시') || t.includes('연준'))
    return { label: '시장', bg: '#FFF8E1', color: '#F59E0B', type: 'popular' };
  if (t.includes('코스피') || t.includes('코스닥') || t.includes('삼성'))
    return { label: '국장', bg: '#FFF0F0', color: '#EF4452', type: 'kr' };
  return { label: '뉴스', bg: '#F0F4FF', color: '#3182F6', type: 'us' };
}

// News skeleton item — 로딩 중 표시
function NewsSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '20px 0', borderBottom: '1px solid #F7F8FA' }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#E5E8EB', marginTop: 8, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-shimmer" style={{ height: 16, borderRadius: 4, marginBottom: 8, width: '85%' }} />
        <div className="skeleton-shimmer" style={{ height: 14, borderRadius: 4, marginBottom: 10, width: '65%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton-shimmer" style={{ height: 16, width: 48, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ height: 14, width: 70, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

export default function NewsSection() {
  const { currentNewsMarket, setCurrentNewsMarket, newsCache, newsCacheTimes, stocks } = usePortfolioStore();
  const { fetchNews } = useNewsData();
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);

  // '내 종목'(all) 탭 전용 — 보유 종목 기반 병렬 검색 결과
  const [portfolioNews, setPortfolioNews] = useState<(NewsItem & { tag: string })[]>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const activeMarket = currentNewsMarket === 'all' ? 'us' : currentNewsMarket;

  // 진행 중인 내 종목 fetch 식별자 — race condition 방지
  const portfolioFetchIdRef = useRef(0);

  const STALE_MS = 30 * 60 * 1000; // 30분

  const loadNews = useCallback(async (market: string) => {
    const m = market === 'all' ? 'us' : market;
    const cachedAt = newsCacheTimes[m] || 0;
    const isStale = Date.now() - cachedAt > STALE_MS;
    const hasCached = newsCache[m]?.length > 0;

    // 캐시 hit + fresh: 즉시 반환, 네트워크 호출 없음
    if (hasCached && !isStale) {
      setFetchStatus('ok');
      return;
    }
    // 캐시 hit + stale: SWR — 즉시 표시 + 백그라운드 갱신
    if (hasCached && isStale) {
      setFetchStatus('ok');
      const result = await fetchNews(m);
      if (result.status === 'error') setFetchStatus(result.reason as FetchStatus);
      else setFetchStatus(result.status);
      return;
    }
    // 캐시 miss: 스켈레톤 표시 + fetch
    setLoading(true);
    const result = await fetchNews(m);
    if (result.status === 'error') setFetchStatus(result.reason as FetchStatus);
    else setFetchStatus(result.status);
    setLoading(false);
  }, [newsCache, newsCacheTimes, fetchNews, STALE_MS]);

  // 내 종목 탭 전용: 보유 종목별 병렬 뉴스 검색 (progressive — 첫 결과 즉시 표시)
  useEffect(() => {
    if (currentNewsMarket !== 'all') return;
    const investingSymbols = (stocks.investing || []).map(s => s.symbol);
    if (!investingSymbols.length) {
      setPortfolioNews([]);
      setFetchStatus('empty');
      return;
    }

    const targets = investingSymbols
      .map(s => ({ sym: s, kr: STOCK_KR[s] }))
      .filter(t => t.kr)
      .slice(0, 3); // 5→3으로 축소 (rate limit + tail latency 보호)

    const queries = targets.length > 0
      ? targets.map(t => `${t.kr} 주가`)
      : ['미국 주식 증시'];

    // 진행 중 fetch id — 사용자가 빠르게 탭을 바꿔도 stale 결과로 덮어쓰지 않음
    const fetchId = ++portfolioFetchIdRef.current;

    setLoading(true);
    setFetchStatus('idle');

    const seen = new Set<string>();
    const merged: (NewsItem & { tag: string })[] = [];
    let okCount = 0;
    let firstResultShown = false;

    // 각 쿼리를 독립 Promise로 처리 — 첫 결과 도착 즉시 setState
    queries.forEach((q, i) => {
      fetchKoreanNews(q, undefined, 48).then(result => {
        // 이 fetch가 시작된 후 사용자가 탭을 바꿨으면 결과 무시
        if (fetchId !== portfolioFetchIdRef.current) return;
        if (result.status === 'ok' && result.items.length) {
          okCount++;
          const sym = targets[i]?.sym || investingSymbols[0];
          result.items.slice(0, 4).forEach(item => {
            if (seen.has(item.title)) return;
            seen.add(item.title);
            let tag = sym;
            for (const { sym: s, kr } of targets) {
              if (kr && (item.title.includes(kr) || item.title.includes(s))) { tag = s; break; }
            }
            merged.push({ ...item, tag });
          });
          const sorted = [...merged].sort((a, b) =>
            new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
          );
          setPortfolioNews(sorted.slice(0, 20));
          if (!firstResultShown) {
            firstResultShown = true;
            setLoading(false); // 첫 결과 도착 시 스켈레톤 제거
            setFetchStatus('ok');
          }
        }
      }).catch(() => { /* 개별 실패는 skip */ });
    });

    // 모든 쿼리가 끝났는데 한 건도 못 받았으면 status 갱신
    Promise.allSettled(queries.map(q => fetchKoreanNews(q, undefined, 48))).then(() => {
      if (fetchId !== portfolioFetchIdRef.current) return;
      if (okCount === 0) {
        setLoading(false);
        setFetchStatus(merged.length === 0 ? 'empty' : 'ok');
      }
    });
  }, [currentNewsMarket, stocks.investing, retryTrigger]);

  // 그 외 탭: 기존 로직
  useEffect(() => {
    if (currentNewsMarket === 'all') return;
    loadNews(currentNewsMarket);
  }, [currentNewsMarket]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (market: string) => {
    setRetryCount(0); // 탭 바꾸면 retry 카운터 리셋
    setCurrentNewsMarket(market);
    // 나머지는 useEffect가 처리
  };

  const handleRetry = useCallback(async () => {
    if (retryCount >= 3) return; // 3회 초과 차단
    setRetryCount(c => c + 1);
    if (currentNewsMarket === 'all') {
      // 내 종목 탭: useEffect dependency를 흔들어 재실행
      setRetryTrigger(t => t + 1);
    } else {
      setLoading(true);
      const result = await fetchNews(activeMarket);
      if (result.status === 'error') setFetchStatus(result.reason as FetchStatus);
      else setFetchStatus(result.status);
      setLoading(false);
    }
  }, [retryCount, currentNewsMarket, activeMarket, fetchNews]);

  // '내 종목' 탭이면 portfolioNews 사용, 아니면 newsCache
  const items: (NewsItem & { tag?: string })[] =
    currentNewsMarket === 'all' ? portfolioNews : (newsCache[activeMarket] || []);

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: '4px' }}>뉴스</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary, #8B95A1)' }}>투자에 영향을 주는 최신 뉴스를 확인해주세요</p>
      </div>

      {/* News tabs — 가로 스크롤 지원 */}
      <div data-tour="news-tabs" className="overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 'max-content' }}>
          {NEWS_TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="cursor-pointer shrink-0"
              style={{
                position: 'relative',
                padding: idx === 0 ? '0 20px 14px 0' : '0 20px 14px',
                fontSize: '15px',
                fontWeight: currentNewsMarket === tab.id ? 600 : 400,
                color: currentNewsMarket === tab.id ? 'var(--text-primary, #191F28)' : 'var(--text-secondary, #8B95A1)',
                whiteSpace: 'nowrap',
                background: 'none',
                border: 'none',
              }}
            >
              {tab.label}
              {currentNewsMarket === tab.id && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: idx === 0 ? 0 : '20px',
                  right: '20px',
                  height: '2px',
                  background: 'var(--text-primary, #191F28)',
                  borderRadius: '1px',
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* News list */}
      {loading ? (
        <div>
          {[0, 1, 2, 3, 4].map(i => <NewsSkeleton key={i} />)}
        </div>
      ) : items.length > 0 ? (
        <div className="cols-2-xl">
          {items.slice(0, 20).map((item, idx) => {
            const relTime = item.pubDate ? getRelativeTime(item.pubDate) : '';
            // 내 종목 탭: 종목 심볼 뱃지 우선, 없으면 키워드 기반
            const tag = item.tag
              ? { label: item.tag, bg: '#F0F4FF', color: '#3182F6' }
              : getNewsTag(item.title);
            const isLast = idx === Math.min(items.length, 20) - 1;

            return (
              <div
                key={idx}
                onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '20px 0',
                  borderBottom: isLast ? 'none' : '1px solid #F7F8FA',
                  cursor: 'pointer',
                }}
              >
                {/* Dot marker */}
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#B0B8C1',
                  marginTop: '8px',
                  flexShrink: 0,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #191F28)',
                    lineHeight: 1.5,
                    marginBottom: '8px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {decodeHtml(item.title)}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#B0B8C1',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: tag.bg,
                      color: tag.color,
                    }}>
                      {tag.label}
                    </span>
                    {item.source && (
                      <span style={{ fontWeight: 500 }}>{item.source}</span>
                    )}
                    {item.source && relTime && (
                      <span style={{
                        width: '2px',
                        height: '2px',
                        borderRadius: '50%',
                        background: '#B0B8C1',
                        display: 'inline-block',
                      }} />
                    )}
                    {relTime && (
                      <span>{relTime}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (() => {
        // 탭별·상태별 빈 상태 분기
        const investingCount = (stocks.investing || []).length;
        const watchingCount = (stocks.watching || []).length;

        // 1. 내 종목 탭 — 투자 중 종목 없으면 가이드
        if (currentNewsMarket === 'all' && investingCount === 0) {
          return (
            <EmptyState
              icon="📰"
              title="투자 중 종목이 없어요"
              description="포트폴리오에 종목을 추가하면 관련 뉴스를 모아서 보여드려요."
              primaryAction={{
                label: '종목 추가하기',
                onClick: () => {
                  const btn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
                  if (btn) btn.click();
                },
              }}
            />
          );
        }

        // 2. 관심 종목 탭 — 관심 종목 없으면 가이드
        if (currentNewsMarket === 'my' && watchingCount === 0) {
          return (
            <EmptyState
              icon="⭐"
              title="관심 종목이 없어요"
              description="관심 가는 종목을 추가하면 해당 종목 관련 뉴스를 볼 수 있어요."
              primaryAction={{
                label: '관심 종목 추가',
                onClick: () => {
                  const btn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
                  if (btn) btn.click();
                },
              }}
            />
          );
        }

        // 3. fetch 결과별 분기
        const retryDisabled = retryCount >= 3;
        const retryLabel = retryDisabled ? '연결을 확인해주세요' : `다시 시도${retryCount > 0 ? ` (${retryCount}/3)` : ''}`;

        if (fetchStatus === 'network' || fetchStatus === 'timeout') {
          return (
            <EmptyState
              icon="⚠️"
              title="연결을 확인해주세요"
              description={fetchStatus === 'timeout'
                ? '응답이 평소보다 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.'
                : '인터넷이 불안정해요. 연결을 확인하고 다시 시도해주세요.'}
              primaryAction={{
                label: retryLabel,
                onClick: retryDisabled ? () => {} : handleRetry,
                variant: retryDisabled ? 'ghost' : 'primary',
              }}
            />
          );
        }

        if (fetchStatus === 'server') {
          return (
            <EmptyState
              icon="🔧"
              title="뉴스 서비스 점검 중이에요"
              description="다른 탭은 정상적으로 이용할 수 있어요. 잠시 후 다시 시도해주세요."
              primaryAction={{
                label: retryLabel,
                onClick: retryDisabled ? () => {} : handleRetry,
                variant: retryDisabled ? 'ghost' : 'primary',
              }}
            />
          );
        }

        // 정상 빈 응답 (status === 'empty') 또는 'idle'/'ok'이지만 items 0건
        return (
          <EmptyState
            icon="📭"
            title="지금은 새 뉴스가 없어요"
            description="시장이 휴장 중이거나 평소보다 조용한 시간일 수 있어요."
            primaryAction={{
              label: retryLabel,
              onClick: retryDisabled ? () => {} : handleRetry,
              variant: retryDisabled ? 'ghost' : 'primary',
            }}
          />
        );
      })()}
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days <= 2) return `${days}일 전`;
    return ''; // 2일 초과 뉴스는 날짜 미표시
  } catch {
    return '';
  }
}
