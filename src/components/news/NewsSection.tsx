'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData } from '@/hooks/useStockData';
import type { NewsItem, NewsTag } from '@/config/constants';

function decodeHtml(text: string) {
  const el = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (!el) return text;
  el.innerHTML = text;
  return el.value;
}

const NEWS_TABS = [
  { id: 'us', label: '미장' },
  { id: 'kr', label: '국장' },
  { id: 'my', label: '관심종목' },
  { id: 'hot', label: '인기' },
];

// --- News tag detection (from render.js) ---
function getNewsTag(title: string): NewsTag {
  const t = title.toLowerCase();
  if (t.includes('이란') || t.includes('전쟁') || t.includes('중동'))
    return { label: '전쟁', bg: 'rgba(255,107,107,0.15)', color: '#ff6b6b' };
  if (t.includes('반도체') || t.includes('ai') || t.includes('hbm') || t.includes('엔비디아'))
    return { label: 'AI/반도체', bg: 'rgba(108,92,231,0.15)', color: '#a29bfe' };
  if (t.includes('마이크론') || t.includes('마이크로소프트') || t.includes('브로드코') || t.includes('아마존'))
    return { label: '보유종목', bg: 'rgba(0,210,160,0.15)', color: '#00d2a0' };
  if (t.includes('나스닥') || t.includes('s&p') || t.includes('증시') || t.includes('연준'))
    return { label: '시장', bg: 'rgba(255,167,38,0.15)', color: '#ffa726' };
  if (t.includes('코스피') || t.includes('코스닥') || t.includes('삼성'))
    return { label: '국장', bg: 'rgba(79,195,247,0.15)', color: '#4fc3f7' };
  return { label: '뉴스', bg: 'rgba(160,160,160,0.12)', color: '#a0a0a0' };
}

export default function NewsSection() {
  const { currentNewsMarket, setCurrentNewsMarket, newsCache } = usePortfolioStore();
  const { fetchNews } = useNewsData();
  const [loading, setLoading] = useState(false);

  const loadNews = useCallback(async (market: string) => {
    if (newsCache[market]) return;
    setLoading(true);
    await fetchNews(market);
    setLoading(false);
  }, [newsCache, fetchNews]);

  useEffect(() => {
    loadNews(currentNewsMarket);
  }, [currentNewsMarket]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabClick = (market: string) => {
    setCurrentNewsMarket(market);
    if (!newsCache[market]) {
      setLoading(true);
      fetchNews(market).finally(() => setLoading(false));
    }
  };

  const items = newsCache[currentNewsMarket] || [];

  return (
    <div className="mt-4">
      {/* News market tabs */}
      <div className="flex gap-2 mb-4">
        {NEWS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              px-4 py-2 rounded-full text-[13px] font-semibold transition-all
              ${currentNewsMarket === tab.id
                ? 'bg-[#191F28] text-white'
                : 'bg-white text-[#4E5968] border border-black/[0.06] hover:bg-[#F7F8FA]'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* News grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-[13px] text-[#8B95A1]">
          뉴스를 불러오는 중...
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 15).map((item, idx) => {
            const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : '';
            const tag = getNewsTag(item.title);

            return (
              <div
                key={idx}
                onClick={() => window.open(item.link, '_blank')}
                className="bg-white rounded-[14px] border border-black/[0.06] p-4 cursor-pointer hover:bg-[#F7F8FA] transition-colors active:scale-[0.99]"
              >
                {/* Tag + date */}
                <div className="flex justify-between items-center mb-2">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                    style={{ background: tag.bg, color: tag.color }}
                  >
                    {tag.label}
                  </span>
                  <span className="text-[10px] text-[#8B95A1]">{date}</span>
                </div>

                {/* Headline */}
                <div className="text-[13px] font-semibold text-[#191F28] leading-snug mb-1">
                  {decodeHtml(item.title)}
                </div>

                {/* Description */}
                {item.description && (
                  <div className="text-[12px] text-[#8B95A1] leading-relaxed line-clamp-2">
                    {decodeHtml(item.description)}
                  </div>
                )}

                {/* Source */}
                {item.source && (
                  <div className="text-[10px] text-[#B0B8C1] mt-1.5">
                    {item.source}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-[13px] text-[#FF9500]">
          뉴스를 불러올 수 없어요.
        </div>
      )}
    </div>
  );
}
