"use client";
import { useState, type ReactNode } from "react";
import { ArrowRight, Check, Newspaper } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import type { NewsItem } from "@/config/constants";
import { useDiscoveryHistory } from "@/hooks/useDiscoveryHistory";
import {
  compareDiscovery,
  newsKey,
  updateDiscovery,
  type DiscoverySnapshot,
} from "@/lib/stockDiscovery";
import { discoveryTags } from "@/config/stockQuestions";
import { lessonById } from "@/lib/learningNavigation";
import { usageEvent } from "@/lib/usageTelemetry";
import { matchesStockContext, type StockContextPacket } from '@/lib/stockContextPacket';
import StockContextExplanation from './StockContextExplanation';
import readingUI from '../ui/ReadingUI.module.css';
import styles from "./StockReturnBrief.module.css";
interface Props {
  owner: string;
  symbol: string;
  items: NewsItem[];
  newsStatus: "loading" | "ok" | "empty" | "error";
  price: number;
  quoteAt?: number;
  currency: string;
  onLearn: (topic: string, originId: string) => void;
  onRetryNews?: () => void;
  renderExplanation?: (originId: string) => ReactNode;
  isFund?: boolean;
  contextPacket?: StockContextPacket;
}
const date = (time: number) =>
  new Date(time).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function StockReturnBrief(props: Props) {
  const { history, ready } = useDiscoveryHistory(props.owner);
  return ready ? (
    <ReturnVisit
      key={`${props.owner}:${props.symbol}`}
      {...props}
      previous={history.stocks[props.symbol]}
    />
  ) : null;
}
function ReturnVisit({
  owner,
  symbol,
  items,
  newsStatus,
  price,
  quoteAt,
  currency,
  onLearn,
  onRetryNews,
  renderExplanation,
  previous,
  isFund,
  contextPacket,
}: Props & { previous?: DiscoverySnapshot }) {
  // Acknowledge updates storage for the NEXT visit; it never erases the comparison being read now.
  const [baseline] = useState(previous);
  const [acknowledged, setAcknowledged] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const now = useNow();
  const current: DiscoverySnapshot = {
    viewedAt: now,
    news: [],
    ...(price > 0 && quoteAt && quoteAt <= now + 60000
      ? { price, quoteAt, currency }
      : {}),
  };
  const { news, newItems, priceChange } = compareDiscovery(
    baseline,
    current,
    items,
  );
  const freshKeys = new Set(newItems.map(newsKey));
  const shown = [...newItems, ...news.filter(item => !freshKeys.has(newsKey(item)))].slice(0, 5);
  current.news = shown.map(newsKey);
  const topics = [...new Set(news.flatMap(item => discoveryTags(item.title)))];
  const context = !isFund && contextPacket && newsStatus === 'ok' && shown.some(item => matchesStockContext(contextPacket, symbol, item, now)) ? contextPacket : undefined;
  const backgroundTopics = shown.map(item => context && matchesStockContext(context, symbol, item, now) ? null : isFund ? 'watch' : discoveryTags(item.title)[0] ?? 'evidence');
  const watch = isFund
    ? "운용사 공지에서 투자 대상·배수·분배금·분할 및 병합 여부가 바뀌었는지 확인해요. 상품 구조와 실제 가격 변동 원인은 나눠 봐요."
    : topics.includes("backlog")
    ? "계약 규모뿐 아니라 납품 시기·취소 조건·매출 반영을 회사 원문에서 확인해요."
    : topics.includes("earnings") || topics.includes("guidance")
      ? "다음 실적 자료에서는 같은 기간의 매출·이익과 회사 전망이 어떻게 달라지는지 확인해요."
      : topics.includes("rates")
        ? "금리 발표 뒤에는 이 회사의 차입 조건과 고객 수요가 실제로 바뀌었는지 확인해요."
        : undefined;
  const staleQuote = !current.quoteAt || now - current.quoteAt > 36 * 3600000;
  return (
    <section
      className={styles.brief}
      data-return-brief
      aria-label="지난 확인 이후의 자료"
    >
      <header className={styles.header}>
      <div>
      <p className={styles.eyebrow}>{baseline ? `${date(baseline.viewedAt)}에 확인한 뒤` : "뉴스와 공시 · 최근 7일"}</p>
      <h3 className={styles.title}>
        {baseline
          ? "지난번 이후 무엇이 달라졌나요?"
          : "이 종목의 최근 소식"}
      </h3>
      </div>
      {shown.length > 0 && <span className={styles.period}>{shown.length}건</span>}
      </header>
      {priceChange !== null && (
        <p className={styles.priceChange} data-return-price>
          지난 확인 시세 대비{" "}
          <strong>
            {priceChange > 0 ? "+" : ""}
            {priceChange.toFixed(2)}%
          </strong>{" "}
          · 두 시점의 가격 차이이며 수익률이나 변동 원인 분석은 아니에요.
        </p>
      )}
      <p className={styles.meta}>
        {current.quoteAt
          ? `시세 기준 ${date(current.quoteAt)}`
          : "시세 기준 시각 미확인"}
        {staleQuote
          ? " · 최신 거래 자료인지 확인이 필요해요. 휴장 중일 수도 있어요."
          : ""}
      </p>
      {context && <StockContextExplanation packet={context} />}
      {newsStatus === "loading" ? (
        <p role="status">최근 소식을 확인하고 있어요…</p>
      ) : newsStatus === "error" ? (
        <div><p role="status">
          뉴스를 가져오지 못했어요. 새 소식이 없는 것으로 판단하지 않아요.
        </p>{onRetryNews && <button type="button" onClick={onRetryNews}>뉴스 다시 불러오기</button>}</div>
      ) : (
        <>
          {shown.length ? (
            <>
              <p className={styles.newsCount}>
                {baseline
                  ? `지난 확인 뒤 발행된 새 기사 ${newItems.length}건`
                  : "최근 7일 안에 발행된 기사"}{" "}
                · 제목에서 찾은 소식이에요.
              </p>
              <ul>
                {shown.map((item, index) => (
                  <li key={newsKey(item)}>
                    {baseline && freshKeys.has(newsKey(item)) && <span className={styles.fresh}>지난 확인 뒤 발행</span>}
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => usageEvent("fresh_news_open")}
                    >
                      {item.title}
                      <span className={styles.meta}>
                        {item.source || "출처 미표기"} ·{" "}
                        {date(Date.parse(item.pubDate))} · 원문 새 창
                      </span>
                    </a>
                    {backgroundTopics[index] && (backgroundTopics.indexOf(backgroundTopics[index]) === index || !!renderExplanation?.(`news-${newsKey(item)}`)) && <button
                      type="button"
                      className={styles.backgroundLink}
                      data-news-background
                      data-reading-return={`news-${newsKey(item)}`}
                      id={`news-background-${newsKey(item)}`}
                      aria-expanded={!!renderExplanation?.(`news-${newsKey(item)}`)}
                      onClick={() => onLearn(discoveryTags(item.title)[0] ?? "evidence", `news-${newsKey(item)}`)}
                    >
                      {isFund ? "상품 구조 알아보기" : `관련 개념 · ${lessonById(discoveryTags(item.title)[0] ?? "evidence")?.title ?? "자료 확인하기"}`} →
                    </button>}
                    {renderExplanation?.(`news-${newsKey(item)}`)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className={styles.empty} data-return-unchanged>
              <Newspaper size={22} strokeWidth={1.5} aria-hidden="true" />
              <div><p className={styles.emptyTitle}>확인된 새 기사가 아직 없어요</p><p>
              {baseline
                ? "현재 제공된 자료에서 지난 확인 이후 발행된 새 기사는 찾지 못했어요."
                : "최근 7일 안의 날짜를 확인할 수 있는 기사가 없어요."}{" "}
              모든 소식을 확인했다는 뜻은 아니에요.
              </p>{onRetryNews && <button type="button" onClick={onRetryNews}>뉴스 다시 불러오기</button>}</div>
            </div>
          )}
        </>
      )}
      {watch && !context && newsStatus === 'ok' && shown.length > 0 && <aside className={styles.watch}>
        <span className={styles.watchIcon} aria-hidden="true"><ArrowRight size={18} /></span>
        <div><h4>다음에 확인할 것</h4><p>{watch}</p></div>
      </aside>}
      <footer className={styles.footer}>
      <div className={styles.actions}>
        <button
          type="button"
          data-brief-ack
          disabled={
            acknowledged || newsStatus === "loading" || newsStatus === "error"
          }
          onClick={() => {
            const snapshot = { ...current, viewedAt: Date.now() };
            const saved = updateDiscovery(owner, (h) => {
              const prior = h.stocks[symbol];
              if (prior && prior.viewedAt > snapshot.viewedAt) return;
              h.stocks[symbol] = {
                ...snapshot,
                news: [
                  ...new Set([...snapshot.news, ...(prior?.news ?? [])]),
                ].slice(0, 30),
              };
            });
            setStorageError(!saved);
            setAcknowledged(true);
            usageEvent("brief_read");
          }}
        >
          {acknowledged && <Check size={15} aria-hidden="true" />}{acknowledged ? "이번 자료를 확인했어요" : "여기까지 확인했어요"}
        </button>
      </div>
      <details className={styles.notice}><summary className={readingUI.disclosure}>자료·비교 기록 안내</summary><div className={styles.noticeContent}>
        <p>기사 제목과 연결한 배경 설명은 본문 요약이나 이번 주가 변동의 원인 분석이 아니에요. 뉴스는 제공 범위에서, 시세는 위 기준 시각으로 비교해요.</p>
        <p>확인 버튼을 누른 시점부터 다음 방문에 비교해요. 이 브라우저에만 저장하며 로그아웃·계정 전환 때 지워져요.</p>
      </div></details>
      </footer>
      {storageError && <p role="status">브라우저 저장이 제한돼 다음 방문의 비교 기록을 저장하지 못했어요.</p>}

    </section>
  );
}
