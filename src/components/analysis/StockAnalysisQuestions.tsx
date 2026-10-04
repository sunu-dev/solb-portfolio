'use client';

import { Fragment, useId, useState, type ReactNode } from 'react';
import { Activity, ChevronDown, ChevronRight, Layers, Scale, Search, Shield, Sprout } from 'lucide-react';
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

export function getStockAnalysisQuestion(id: string): string {
  return QUESTIONS.find(question => question.id === id)?.question ?? '선택한 관점으로 살펴보기';
}

interface StockAnalysisQuestionsProps {
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  answer?: ReactNode;
  remaining?: number | null;
}

interface QuestionButtonProps extends StockAnalysisQuestionsProps {
  item: Question;
}

function QuestionButton({ item, selectedId, loading, onSelect }: QuestionButtonProps) {
  const selected = item.id === selectedId;
  const { Icon } = item;

  return (
    <button
      type="button"
      className={styles.question}
      data-question-id={item.id}
      aria-expanded={selected}
      aria-disabled={loading}
      aria-controls={selected ? 'stock-assistant-answer' : undefined}
      onClick={() => {
        if (!loading) onSelect(item.id);
      }}
    >
      <Icon className={styles.icon} size={20} strokeWidth={1.7} aria-hidden="true" />
      <span className={styles.copy}>
        <span className={styles.questionTitle}>{item.question}</span>
        <span className={styles.description}>{item.description}</span>
      </span>
      {selected ? (
        <ChevronDown className={styles.arrow} size={18} strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <ChevronRight className={styles.arrow} size={18} strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
  );
}

export default function StockAnalysisQuestions({ selectedId, loading, onSelect, answer, remaining }: StockAnalysisQuestionsProps) {
  const headingId = useId();
  const moreId = useId();
  const [showMore, setShowMore] = useState(false);
  const selectedQuestion = QUESTIONS.find(question => question.id === selectedId);
  const selectedAdditionalQuestion = QUESTIONS.slice(3).find(question => question.id === selectedId);

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h3 id={headingId} className={styles.title}>주비에게 더 물어보기</h3>
        <p className={styles.intro}>궁금한 질문을 고르면 확인할 점을 풀어드려요.</p>
        <p className={styles.usage}>
          {remaining === 0
            ? '오늘 새 답변을 모두 사용했어요. 이 화면에서 받은 답변은 다시 볼 수 있어요.'
            : typeof remaining === 'number' && remaining > 0
              ? `AI 분석 ${remaining}회 남음 · 새 답변 1회 사용`
              : '새 답변은 AI 분석 1회를 사용해요.'}
        </p>
      </div>

      <div className={styles.list}>
        {QUESTIONS.slice(0, 3).map(item => (
          <Fragment key={item.id}>
            <QuestionButton item={item} selectedId={selectedId} loading={loading} onSelect={onSelect} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        ))}
        {!showMore && selectedAdditionalQuestion ? (
          <>
            <QuestionButton item={selectedAdditionalQuestion} selectedId={selectedId} loading={loading} onSelect={onSelect} />
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
            <QuestionButton item={item} selectedId={selectedId} loading={loading} onSelect={onSelect} />
            {item.id === selectedId ? answer : null}
          </Fragment>
        )) : null}
      </div>

      <p className={styles.screenReaderOnly} role="status" aria-live="polite" aria-atomic="true">
        {loading && selectedQuestion ? `주비가 ‘${selectedQuestion.question}’ 설명을 준비하고 있어요.` : ''}
      </p>
    </section>
  );
}
