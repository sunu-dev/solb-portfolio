"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Scale,
  Search,
  Shield,
  Sprout,
} from "lucide-react";
import styles from "./StockAnalysisQuestions.module.css";

import {
  STOCK_QUESTIONS,
  rankQuestions,
  type StockQuestion,
} from "@/config/stockQuestions";
import { useDiscoveryHistory } from "@/hooks/useDiscoveryHistory";
import { updateDiscovery } from "@/lib/stockDiscovery";

const QUESTIONS = STOCK_QUESTIONS;
type Question = StockQuestion;
type QuotaStatus = "checking" | "ready" | "unavailable" | "signed-out";
const EMPTY_CACHED_IDS: readonly string[] = [];

export function getStockAnalysisAnswerTitle(id: string, name: string): string {
  const subjects: Record<string, string> = {
    safe: "먼저 살펴볼 위험",
    value: "실적과 가격의 관계",
    growth: "성장 근거와 달라질 조건",
    balance: "다른 종목과 함께 볼 점",
    trend: "최근 가격과 거래량 흐름",
    simple: "시장 전체 투자와 비교할 점",
  };
  return `${name} · ${subjects[id] ?? QUESTIONS.find((item) => item.id === id)?.question ?? "질문에 대한 설명"}`;
}

export function getStockAnalysisQuestion(id: string): string {
  return (
    QUESTIONS.find((question) => question.id === id)?.question ??
    "선택한 관점으로 살펴보기"
  );
}

interface StockAnalysisQuestionsProps {
  onLearn: (id: string) => void;
  owner: string;
  tags: readonly string[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  answer?: ReactNode;
  remaining?: number | null;
  quotaStatus?: QuotaStatus;
  cachedQuestionIds?: readonly string[];
}

interface QuestionButtonProps extends StockAnalysisQuestionsProps {
  item: Question;
  quotaMessageId: string;
}

function QuestionButton({
  item,
  onLearn,
  tags,
  selectedId,
  loading,
  onSelect,
  remaining,
  quotaMessageId,
  quotaStatus = "ready",
  cachedQuestionIds = EMPTY_CACHED_IDS,
}: QuestionButtonProps) {
  const selected = item.id === selectedId;
  const cached = cachedQuestionIds.includes(item.id);
  const exhausted = quotaStatus === "ready" && remaining === 0;
  const quotaBlocked =
    !selected && !cached && (quotaStatus === "checking" || exhausted);
  const disabled = loading || quotaBlocked;
  const Icon =
    (
      {
        safe: Shield,
        value: Search,
        growth: Sprout,
        balance: Scale,
        trend: Activity,
        simple: Layers,
      } as Record<string, typeof Shield>
    )[item.id] ?? Search;

  return (
    <div className={styles.questionGroup}>
      <button
        type="button"
        className={styles.question}
        data-question-id={item.id}
        aria-expanded={selected}
        aria-disabled={disabled}
        aria-describedby={quotaBlocked ? quotaMessageId : undefined}
        aria-controls={selected ? "stock-assistant-answer" : undefined}
        onClick={() => {
          if (!disabled) onSelect(item.id);
        }}
      >
        <Icon
          className={styles.icon}
          size={20}
          strokeWidth={1.7}
          aria-hidden="true"
        />
        <span className={styles.copy}>
          <span className={styles.questionTitle}>{item.question}</span>
          <span className={styles.description}>{item.description}</span>
          {item.tags.some((tag) => tags.includes(tag)) ? (
            <span className={styles.cached}>
              최근 뉴스 제목과 이어지는 질문
            </span>
          ) : null}
          {cached ? <span className={styles.cached}>받은 답변</span> : null}
        </span>
        {selected && loading ? (
          <LoaderCircle
            className={`${styles.arrow} ${styles.pendingIcon}`}
            size={18}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        ) : selected ? (
          <ChevronDown
            className={styles.arrow}
            size={18}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        ) : quotaBlocked && exhausted ? (
          <LockKeyhole
            className={styles.arrow}
            size={16}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className={styles.arrow}
            size={18}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        )}
      </button>
      <button
        type="button"
        className={styles.background}
        data-question-background={item.id}
        onClick={() => onLearn(item.id)}
      >
        배경 개념부터 읽기 →
      </button>
    </div>
  );
}

export default function StockAnalysisQuestions({
  onLearn,
  owner,
  tags,
  selectedId,
  loading,
  onSelect,
  answer,
  remaining,
  quotaStatus = "ready",
  cachedQuestionIds = EMPTY_CACHED_IDS,
}: StockAnalysisQuestionsProps) {
  const { history } = useDiscoveryHistory(owner);
  const questions = rankQuestions(tags, Object.keys(history.questions));
  const select = (id: string) => {
    updateDiscovery(owner, (h) => {
      h.questions[id] = Date.now();
    });
    onSelect(id);
  };
  const headingId = useId();
  const moreId = useId();
  const quotaMessageId = useId();
  const [showMore, setShowMore] = useState(false);
  const selectedAdditionalQuestion = questions
    .slice(3)
    .find((question) => question.id === selectedId);
  const exhausted = quotaStatus === "ready" && remaining === 0;
  const hasCachedAnswer = QUESTIONS.some((question) =>
    cachedQuestionIds.includes(question.id),
  );
  const questionProps = {
    onLearn,
    owner,
    tags,
    selectedId,
    loading,
    onSelect: select,
    remaining,
    quotaStatus,
    cachedQuestionIds,
    quotaMessageId,
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h3 id={headingId} className={styles.title}>
          주비에게 더 물어보기
        </h3>
        <p className={styles.intro}>
          뉴스 제목과 연결되는 주제를 먼저 보여드려요. 열어본 질문은 다음 방문에
          다른 질문 뒤로 이어져요.
        </p>
        <div
          id={quotaMessageId}
          className={`${styles.usage}${exhausted ? ` ${styles.exhausted}` : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {quotaStatus === "checking" ? (
            "오늘 남은 횟수를 확인하고 있어요"
          ) : quotaStatus === "unavailable" ? (
            "남은 횟수를 확인하지 못했어요. 질문할 때 다시 확인할게요."
          ) : quotaStatus === "signed-out" ? (
            "AI 분석은 로그인 후 이용할 수 있어요."
          ) : exhausted ? (
            <>
              <strong className={styles.usageTitle}>오늘 0회 남음</strong>
              <span>내일 0시(한국시간)에 다시 이용할 수 있어요.</span>
              {hasCachedAnswer ? (
                <span>이 화면에서 받은 답변은 다시 볼 수 있어요.</span>
              ) : null}
            </>
          ) : typeof remaining === "number" && remaining > 0 ? (
            `AI 분석 ${remaining}회 남음 · 새 답변 1회 사용`
          ) : (
            "새 답변은 AI 분석 1회를 사용해요."
          )}
        </div>
      </div>

      <div className={styles.list}>
        {questions.slice(0, 3).map((item) => (
          <Fragment key={item.id}>
            <QuestionButton item={item} {...questionProps} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        ))}
        {!showMore && selectedAdditionalQuestion ? (
          <>
            <QuestionButton
              item={selectedAdditionalQuestion}
              {...questionProps}
            />
            {answer}
          </>
        ) : null}
      </div>

      <button
        type="button"
        className={styles.more}
        data-question-more
        aria-expanded={showMore}
        aria-controls={moreId}
        onClick={() => setShowMore((previous) => !previous)}
      >
        <span>{showMore ? "다른 관점 접기" : "다른 관점도 보기"}</span>
        <ChevronDown
          className={styles.expandIcon}
          size={16}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      <div id={moreId} className={styles.additional} hidden={!showMore}>
        {showMore
          ? questions.slice(3).map((item) => (
              <Fragment key={item.id}>
                <QuestionButton item={item} {...questionProps} />
                {item.id === selectedId ? answer : null}
              </Fragment>
            ))
          : null}
      </div>
    </section>
  );
}
