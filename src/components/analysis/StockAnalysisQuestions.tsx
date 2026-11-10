"use client";

import LearningDesk from '@/components/learning/LearningDesk';
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
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
  ArrowRight,
} from "lucide-react";
import styles from "./StockAnalysisQuestions.module.css";

import {
  STOCK_QUESTIONS,
  rankQuestions,
  type StockQuestion,
} from "@/config/stockQuestions";
import { useDiscoveryHistory } from "@/hooks/useDiscoveryHistory";
import { readQuestionsForSymbol, recordAnsweredQuestion } from "@/lib/stockDiscovery";

const QUESTIONS = STOCK_QUESTIONS;
type Question = StockQuestion;
type QuotaStatus = "checking" | "ready" | "unavailable" | "signed-out";
const EMPTY_CACHED_IDS: readonly string[] = [];
const INITIAL_QUESTIONS = 3;

export function getStockAnalysisAnswerTitle(id: string, name: string): string {
  const subjects: Record<string, string> = {
    "fund-target": "상품의 투자대상",
    "fund-returns": "상품의 수익 구조",
    "fund-risk": "보유 기간과 상품 위험",
    "fund-compare": "비슷한 상품의 비교 기준",
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
  instrument?: "stock" | "fund";
  symbol?: string;
  answeredId?: string;
  backgroundQuestionId?: string;
  onLearn: (id: string) => void;
  renderBackground?: (id: string) => ReactNode;
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
  renderBackground,
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
  const backgroundContent = renderBackground?.(item.id);
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
        aria-label={`${item.question} · AI 답변`}
        aria-expanded={selected}
        aria-disabled={disabled}
        aria-describedby={quotaMessageId}
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
        aria-label={`${item.question} · 개념 먼저 읽기`}
        data-reading-return={`question-${item.id}`}
        aria-expanded={renderBackground ? Boolean(backgroundContent) : undefined}
        onClick={() => onLearn(item.id)}
      >
        개념 먼저 읽기 <ArrowRight size={13} aria-hidden="true" />
      </button>
      {backgroundContent}
    </div>
  );
}

export default function StockAnalysisQuestions({
  instrument = "stock",
  symbol,
  answeredId,
  backgroundQuestionId,
  onLearn,
  renderBackground,
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
  const hasAnswer = Boolean(answer);
  const { history } = useDiscoveryHistory(owner);
  const questions = rankQuestions(tags, readQuestionsForSymbol(history, symbol), instrument);
  useEffect(() => {
    if (answeredId && answeredId === selectedId && !loading && hasAnswer) {
      recordAnsweredQuestion(owner, symbol, answeredId);
    }
  }, [owner, symbol, answeredId, selectedId, loading, hasAnswer]);
  const headingId = useId();
  const moreId = useId();
  const quotaMessageId = useId();
  const [showMore, setShowMore] = useState(false);
  const selectedAdditionalQuestion = questions
    .slice(INITIAL_QUESTIONS)
    .find((question) => question.id === selectedId);
  const backgroundAdditionalQuestion = questions.slice(INITIAL_QUESTIONS).find(question => question.id === backgroundQuestionId && question.id !== selectedAdditionalQuestion?.id);
  const exhausted = quotaStatus === "ready" && remaining === 0;
  const hasCachedAnswer = QUESTIONS.some((question) =>
    cachedQuestionIds.includes(question.id),
  );
  const questionProps = {
    onLearn,
    renderBackground,
    owner,
    tags,
    selectedId,
    loading,
    onSelect,
    remaining,
    quotaStatus,
    cachedQuestionIds,
    quotaMessageId,
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <p className={styles.kicker}>주비와 함께 짚어보기</p>
        <h3 id={headingId} className={styles.title}>
          {instrument === 'fund' ? '이 상품, 더 알아볼까요?' : '이 회사, 더 알아볼까요?'}
        </h3>
        <p className={styles.intro}>궁금한 질문을 골라보세요. 개념 설명은 바로 읽을 수 있어요.</p>
      </div>

      <LearningDesk key={`${owner}:${symbol}`} symbol={symbol} />
      <div className={styles.list}>
        {questions.slice(0, INITIAL_QUESTIONS).map((item) => (
          <Fragment key={item.id}>
            <QuestionButton item={item} {...questionProps} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        ))}
        {!showMore && backgroundAdditionalQuestion ? <QuestionButton item={backgroundAdditionalQuestion} {...questionProps} /> : null}
        {!showMore && selectedAdditionalQuestion ? (
          <>
            <QuestionButton item={selectedAdditionalQuestion} {...questionProps} />
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
        <span>{showMore ? "다른 질문 접기" : `다른 질문 ${Math.max(0, questions.length - INITIAL_QUESTIONS)}개 보기`}</span>
        <ChevronDown className={styles.expandIcon} size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div id={moreId} className={styles.additional} hidden={!showMore}>
        {showMore ? questions.slice(INITIAL_QUESTIONS).map((item) => (
          <Fragment key={item.id}>
            <QuestionButton item={item} {...questionProps} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        )) : null}
      </div>
      <footer className={styles.footer}>
        <span className={styles.aiLabel}>AI 답변</span>
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
            "로그인 후 질문할 수 있어요. 개념 읽기는 로그인 없이 이용해요."
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
      </footer>
    </section>
  );
}
