'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData } from '@/hooks/useStockData';
import type { NewsTag } from '@/config/constants';
import { ExternalLink } from 'lucide-react';

function decodeHtml(text: string) {
  const el = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (!el) return text;
  el.innerHTML = text;
  return el.value;
}

const NEWS_TABS = [
  { id: 'all', label: '내 종목' },
  { id: 'us', label: '미국 시장' },
  { id: 'kr', label: '한국 시장' },
  { id: 'my', label: '관심 종목' },
  { id: 'hot', label: '인기' },
];

function getNewsTag(title: string): NewsTag {
  const t = title.toLowerCase();
  if (t.includes('이란') || t.includes('전쟁') || t.includes('중동'))
    return { label: '전쟁', bg: 'rgba(255,107,107,0.12)', color: '#ff6b6b' };
  if (t.includes('반도체') || t.includes('ai') || t.includes('hbm') || t.includes('엔비디아'))
    return { label: 'AI/반도체', bg: 'rgba(108,92,231,0.12)', color: '#a29bfe' };
  if (t.includes('마이크론') || t.includes('마이크로소프트') || t.includes('브로드코') || t.includes('아마존'))
    return { label: '보유종목', bg: 'rgba(0,210,160,0.12)', color: '#00d2a0' };
  if (t.includes('나스닥') || t.includes('s&p') || t.includes('증시') || t.includes('연준'))
    return { label: '시장', bg: 'rgba(255,167,38,0.12)', color: '#ffa726' };
  if (t.includes('코스피') || t.includes('코스닥') || t.includes('삼성'))
    return { label: '국장', bg: 'rgba(79,195,247,0.12)', color: '#4fc3f7' };
  return { label: '뉴스', bg: 'rgba(160,160,160,0.08)', color: '#a0a0a0' };
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
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#191F28]">뉴스</h1>
        <p className="text-[13px] text-[#8B95A1] mt-1">투자에 영향을 주는 최신 뉴스를 확인하세요</p>
      </div>

      {/* News tabs */}
      <div className="flex border-b border-[#F2F4F6] mb-6">
        {NEWS_TABS.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              relative pb-3.5 text-[15px] cursor-pointer whitespace-nowrap
              ${idx === 0 ? 'pr-5' : 'px-5'}
              ${currentNewsMarket === tab.id
                ? 'text-[#191F28] font-semibold'
                : 'text-[#8B95A1] font-normal hover:text-[#4E5968]'
              }
            `}
          >
            {tab.label}
            {currentNewsMarket === tab.id && (
              <span className={`absolute bottom-0 ${idx === 0 ? 'left-0 right-5' : 'left-5 right-5'} h-[2px] bg-[#191F28] rounded-[1px]`} />
            )}
          </button>
        ))}
      </div>

      {/* News list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-[13px] text-[#8B95A1]">
          뉴스를 불러오는 중...
        </div>
      ) : items.length > 0 ? (
        <div>
          {items.slice(0, 20).map((item, idx) => {
            const relTime = item.pubDate ? getRelativeTime(item.pubDate) : '';
            const tag = getNewsTag(item.title);

            return (
              <div
                key={idx}
                onClick={() => window.open(item.link, '_blank')}
                className={`flex items-start gap-4 py-5 cursor-pointer ${
                  idx < Math.min(items.length, 20) - 1 ? 'border-b border-[#F7F8FA]' : ''
                }`}
              >
                {/* Dot marker */}
                <div className="w-1 h-1 rounded-full bg-[#B0B8C1] mt-2 shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-[#191F28] leading-relaxed mb-2 line-clamp-2 hover:text-[#3182F6] transition-colors">
                    {decodeHtml(item.title)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{ background: tag.bg, color: tag.color }}
                    >
                      {tag.label}
                    </span>
                    {item.source && (
                      <span className="text-[12px] text-[#B0B8C1] font-medium">{item.source}</span>
                    )}
                    {item.source && relTime && (
                      <span className="w-0.5 h-0.5 rounded-full bg-[#B0B8C1]" />
                    )}
                    {relTime && (
                      <span className="text-[12px] text-[#B0B8C1]">{relTime}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-40">
          <div className="text-[32px] mb-2">📰</div>
          <div className="text-[13px] text-[#8B95A1]">뉴스를 불러올 수 없어요</div>
          <button
            onClick={() => {
              setLoading(true);
              fetchNews(activeMarket).finally(() => setLoading(false));
            }}
            className="mt-2 text-[12px] font-semibold text-[#3182F6] hover:underline cursor-pointer"
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
