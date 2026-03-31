'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData } from '@/hooks/useStockData';
import type { NewsTag } from '@/config/constants';
import { ExternalLink } from 'lucide-react';

function decodeHtml(text: string) {
  // 안전한 HTML 엔티티 디코딩 (innerHTML XSS 방지)
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const NEWS_TABS = [
  { id: 'all', label: '내 종목' },
  { id: 'us', label: '미국 시장' },
  { id: 'kr', label: '한국 시장' },
  { id: 'my', label: '관심 종목' },
  { id: 'hot', label: '인기' },
];

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

export default function NewsSection() {
  const { currentNewsMarket, setCurrentNewsMarket, newsCache } = usePortfolioStore();
  const { fetchNews } = useNewsData();
  const [loading, setLoading] = useState(false);

  const activeMarket = currentNewsMarket === 'all' ? 'us' : currentNewsMarket;

  const loadNews = useCallback(async (market: string) => {
    const m = market === 'all' ? 'us' : market;
    if (newsCache[m]) return;
    setLoading(true);
    await fetchNews(m);
    setLoading(false);
  }, [newsCache, fetchNews]);

  useEffect(() => {
    loadNews(currentNewsMarket);
  }, [currentNewsMarket]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (market: string) => {
    setCurrentNewsMarket(market);
    const m = market === 'all' ? 'us' : market;
    if (!newsCache[m]) {
      setLoading(true);
      fetchNews(m).finally(() => setLoading(false));
    }
  };

  const items = newsCache[activeMarket] || [];

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#191F28', marginBottom: '4px' }}>뉴스</h1>
        <p style={{ fontSize: '13px', color: '#8B95A1' }}>투자에 영향을 주는 최신 뉴스를 확인하세요</p>
      </div>

      {/* News tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #F2F4F6', marginBottom: '24px' }}>
        {NEWS_TABS.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              position: 'relative',
              padding: idx === 0 ? '0 20px 14px 0' : '0 20px 14px',
              fontSize: '15px',
              fontWeight: currentNewsMarket === tab.id ? 600 : 400,
              color: currentNewsMarket === tab.id ? '#191F28' : '#8B95A1',
              cursor: 'pointer',
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
                left: idx === 0 ? 0 : undefined,
                right: '20px',
                ...(idx !== 0 ? { left: 0 } : {}),
                height: '2px',
                background: '#191F28',
                borderRadius: '1px',
                display: 'block',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* News list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', fontSize: '13px', color: '#8B95A1' }}>
          뉴스를 불러오는 중...
        </div>
      ) : items.length > 0 ? (
        <div>
          {items.slice(0, 20).map((item, idx) => {
            const relTime = item.pubDate ? getRelativeTime(item.pubDate) : '';
            const tag = getNewsTag(item.title);
            const isLast = idx === Math.min(items.length, 20) - 1;

            return (
              <div
                key={idx}
                onClick={() => window.open(item.link, '_blank')}
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
                    color: '#191F28',
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📰</div>
          <div style={{ fontSize: '13px', color: '#8B95A1' }}>뉴스를 불러올 수 없어요</div>
          <button
            onClick={() => {
              setLoading(true);
              fetchNews(activeMarket).finally(() => setLoading(false));
            }}
            style={{
              marginTop: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#3182F6',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            다시 시도
          </button>
        </div>
      )}
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
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR');
  } catch {
    return '';
  }
}
