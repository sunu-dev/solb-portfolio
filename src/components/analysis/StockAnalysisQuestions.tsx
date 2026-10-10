'use client';

import { Fragment, useId, useState, type ReactNode } from 'react';
import { Activity, ChevronDown, ChevronRight, Layers, LoaderCircle, LockKeyhole, Scale, Search, Shield, Sprout } from 'lucide-react';
import styles from './StockAnalysisQuestions.module.css';

const QUESTIONS = [
  {
    id: 'safe',
    question: '어떤 위험부터 봐야 하나요?',
    description: '가격 변동과 안정성에서 확인할 점을 짚어요.',
    Icon: Shield,
  },
  {
    id: 'value',
    question: '가격은 실적에 비해 어떤가요?',
    description: '회사가 버는 돈과 주가를 함께 읽어요.',
    Icon: Search,
  },
  {
    id: 'growth',
    question: '앞으로 성장할 근거가 있나요?',
    description: '사업의 성장 가능성과 달라질 조건을 살펴봐요.',
    Icon: Sprout,
  },
  {
    id: 'balance',
    question: '함께 보유할 때 무엇을 볼까요?',
    description: '한 종목에 치우치지 않는 투자 방법을 알아봐요.',
    Icon: Scale,
  },
  {
    id: 'trend',
    question: '최근 주가 흐름은 어떤가요?',
    description: '가격과 거래량이 함께 움직였는지 살펴봐요.',
    Icon: Activity,
  },
  {
    id: 'simple',
    question: '시장 전체에 투자하면 어떨까요?',
    description: '개별 종목과 시장 지수를 비교하는 관점이에요.',
    Icon: Layers,
  },
] as const;

type Question = (typeof QUESTIONS)[number];
type QuotaStatus = 'checking' | 'ready' | 'unavailable' | 'signed-out';
const EMPTY_CACHED_IDS: readonly string[] = [];

export function getStockAnalysisAnswerTitle(id: string, name: string): string {
  const subjects: Record<string, string> = {
    safe: '먼저 살펴볼 위험', value: '실적과 가격의 관계', growth: '성장 근거와 달라질 조건',
    balance: '다른 종목과 함께 볼 점', trend: '최근 가격과 거래량 흐름', simple: '시장 전체 투자와 비교할 점',
  };
  return `${name} · ${subjects[id] ?? '질문에 대한 설명'}`;
}

export function getStockAnalysisQuestion(id: string): string {
  return QUESTIONS.find(question => question.id === id)?.question ?? '선택한 관점으로 살펴보기';
}

interface StockAnalysisQuestionsProps {
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
  item, selectedId, loading, onSelect, remaining, quotaMessageId,
  quotaStatus = 'ready', cachedQuestionIds = EMPTY_CACHED_IDS,
}: QuestionButtonProps) {
  const selected = item.id === selectedId;
  const cached = cachedQuestionIds.includes(item.id);
  const exhausted = quotaStatus === 'ready' && remaining === 0;
  const quotaBlocked = !selected && !cached && (quotaStatus === 'checking' || exhausted);
  const disabled = loading || quotaBlocked;
  const { Icon } = item;

  return (
    <button
      type="button"
      className={styles.question}
      data-question-id={item.id}
      aria-expanded={selected}
      aria-disabled={disabled}
      aria-describedby={quotaBlocked ? quotaMessageId : undefined}
      aria-controls={selected ? 'stock-assistant-answer' : undefined}
      onClick={() => {
        if (!disabled) onSelect(item.id);
      }}
    >
      <Icon className={styles.icon} size={20} strokeWidth={1.7} aria-hidden="true" />
      <span className={styles.copy}>
        <span className={styles.questionTitle}>{item.question}</span>
        <span className={styles.description}>{item.description}</span>
        {cached ? <span className={styles.cached}>받은 답변</span> : null}
      </span>
      {selected && loading ? (
        <LoaderCircle className={`${styles.arrow} ${styles.pendingIcon}`} size={18} strokeWidth={1.7} aria-hidden="true" />
      ) : selected ? (
        <ChevronDown className={styles.arrow} size={18} strokeWidth={1.7} aria-hidden="true" />
      ) : quotaBlocked && exhausted ? (
        <LockKeyhole className={styles.arrow} size={16} strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <ChevronRight className={styles.arrow} size={18} strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  );
}

export default function StockAnalysisQuestions({
  selectedId, loading, onSelect, answer, remaining,
  quotaStatus = 'ready', cachedQuestionIds = EMPTY_CACHED_IDS,
}: StockAnalysisQuestionsProps) {
  const headingId = useId();
  const moreId = useId();
  const quotaMessageId = useId();
  const [showMore, setShowMore] = useState(false);
  const selectedAdditionalQuestion = QUESTIONS.slice(3).find(question => question.id === selectedId);
  const exhausted = quotaStatus === 'ready' && remaining === 0;
  const hasCachedAnswer = QUESTIONS.some(question => cachedQuestionIds.includes(question.id));
  const questionProps = { selectedId, loading, onSelect, remaining, quotaStatus, cachedQuestionIds, quotaMessageId };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h3 id={headingId} className={styles.title}>주비에게 더 물어보기</h3>
        <p className={styles.intro}>궁금한 질문을 고르면 확인할 점을 풀어드려요.</p>
        <div id={quotaMessageId} className={`${styles.usage}${exhausted ? ` ${styles.exhausted}` : ''}`}
          role="status" aria-live="polite" aria-atomic="true">
          {quotaStatus === 'checking' ? '오늘 남은 횟수를 확인하고 있어요'
            : quotaStatus === 'unavailable' ? '남은 횟수를 확인하지 못했어요. 질문할 때 다시 확인할게요.'
              : quotaStatus === 'signed-out' ? 'AI 분석은 로그인 후 이용할 수 있어요.'
                : exhausted ? <>
                  <strong className={styles.usageTitle}>오늘 0회 남음</strong>
                  <span>내일 0시(한국시간)에 다시 이용할 수 있어요.</span>
                  {hasCachedAnswer ? <span>이 화면에서 받은 답변은 다시 볼 수 있어요.</span> : null}
                </>
                  : typeof remaining === 'number' && remaining > 0
                    ? `AI 분석 ${remaining}회 남음 · 새 답변 1회 사용`
                    : '새 답변은 AI 분석 1회를 사용해요.'}
        </div>
      </div>

      <div className={styles.list}>
        {QUESTIONS.slice(0, 3).map(item => (
          <Fragment key={item.id}>
            <QuestionButton item={item} {...questionProps} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        ))}
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
        onClick={() => setShowMore(previous => !previous)}
      >
        <span>{showMore ? '다른 관점 접기' : '다른 관점도 보기'}</span>
        <ChevronDown className={styles.expandIcon} size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <div id={moreId} className={styles.additional} hidden={!showMore}>
        {showMore ? QUESTIONS.slice(3).map(item => (
          <Fragment key={item.id}>
            <QuestionButton item={item} {...questionProps} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        )) : null}
      </div>

    </section>
  );
}
