"use client";
import { useState } from "react";
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
import { usageEvent } from "@/lib/usageTelemetry";
import styles from "./StockReturnBrief.module.css";
interface Props {
  owner: string;
  symbol: string;
  items: NewsItem[];
  newsStatus: "loading" | "ok" | "empty" | "error";
  price: number;
  quoteAt?: number;
  currency: string;
  onLearn: (topic?: string) => void;
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
  previous,
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
  const shown = (baseline ? newItems : news).slice(0, 5);
  current.news = shown.map(newsKey);
  const topics = discoveryTags(news.map((item) => item.title).join(" "));
  const watch = topics.includes("backlog")
    ? "계약 규모뿐 아니라 납품 시기·취소 조건·매출 반영을 회사 원문에서 확인해요."
    : topics.includes("earnings") || topics.includes("guidance")
      ? "다음 실적 자료에서는 같은 기간의 매출·이익과 회사 전망이 어떻게 달라지는지 확인해요."
      : topics.includes("rates")
        ? "금리 발표 뒤에는 이 회사의 차입 조건과 고객 수요가 실제로 바뀌었는지 확인해요."
        : "다음 공시나 실적 자료가 나오면 매출·이익·현금흐름의 변화와 회사가 밝힌 이유를 함께 확인해요.";
  const staleQuote = !current.quoteAt || now - current.quoteAt > 36 * 3600000;
  return (
    <section
      className={styles.brief}
      data-return-brief
      aria-label="지난 확인 이후의 자료"
    >
      <p className={styles.eyebrow}>
        {baseline
          ? `${date(baseline.viewedAt)}에 확인한 뒤`
          : "처음 살펴보는 종목이에요"}
      </p>
      <h3>
        {baseline
          ? "지난번 이후 무엇이 달라졌나요?"
          : "지금 확인할 소식부터 볼까요?"}
      </h3>
      {priceChange !== null && (
        <p data-return-price>
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
      {newsStatus === "loading" ? (
        <p role="status">최근 소식을 확인하고 있어요…</p>
      ) : newsStatus === "error" ? (
        <p role="status">
          뉴스를 가져오지 못했어요. 새 소식이 없는 것으로 판단하지 않아요.
        </p>
      ) : (
        <>
          {shown.length ? (
            <>
              <p>
                {baseline
                  ? `지난 확인 뒤 발행된 새 기사 ${newItems.length}건`
                  : "최근 7일 안에 발행된 기사"}{" "}
                · 제목에서 찾은 소식이에요.
              </p>
              <ul>
                {shown.map((item) => (
                  <li key={newsKey(item)}>
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
                    <button
                      type="button"
                      className={styles.backgroundLink}
                      data-news-background
                      onClick={() =>
                        onLearn(discoveryTags(item.title)[0] ?? "evidence")
                      }
                    >
                      이 소식의 배경은 무엇일까요? →
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p data-return-unchanged>
              {baseline
                ? "현재 제공된 자료에서 지난 확인 이후 발행된 새 기사는 찾지 못했어요."
                : "최근 7일 안의 날짜를 확인할 수 있는 기사가 없어요."}{" "}
              모든 소식을 확인했다는 뜻은 아니에요.
            </p>
          )}
          <small>
            기사 제목은 본문 요약이나 주가 변동의 원인 확인이 아니에요. 뉴스는
            제공 범위에서, 시세는 위 기준 시각으로 비교해요.
          </small>
        </>
      )}
      <p>
        <strong>다음에 확인할 것</strong>
        <br />
        {watch}
      </p>
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
          {acknowledged ? "이번 자료를 확인했어요" : "여기까지 확인했어요"}
        </button>
        <button type="button" onClick={() => onLearn(topics[0] ?? "evidence")}>
          관련 개념 더 알아보기 →
        </button>
      </div>
      <small>
        {storageError
          ? "브라우저 저장이 제한돼 다음 방문의 비교 기록을 저장하지 못했어요."
          : "확인 버튼을 누른 시점부터 다음 방문에 비교해요. 이 브라우저에만 저장하며 로그아웃·계정 전환 때 지워져요."}
      </small>
    </section>
  );
}
