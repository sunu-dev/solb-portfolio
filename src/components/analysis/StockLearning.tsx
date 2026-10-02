'use client';

import { Fragment, useId, useState } from 'react';
import { ArrowRight, BookOpen, Check, ExternalLink } from 'lucide-react';
import { STOCK_LESSONS } from '@/config/stockLearning';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import styles from './StockLearning.module.css';
import ReadingText from '@/components/common/ReadingText';

interface Props {
  name: string;
  onChart?: (days: number) => void;
  onNews: () => void;
  onNotes?: () => void;
}

function LessonTitle({ lesson }: { lesson: (typeof STOCK_LESSONS)[number] }) {
  return lesson.titlePhrases.map((phrase, index) => (
    <Fragment key={phrase}>
      {index > 0 && ' '}
      <span className="reading-phrase">{phrase}</span>
    </Fragment>
  ));
}

export default function StockLearning({ name, onChart, onNews, onNotes }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const lesson = active === null ? null : STOCK_LESSONS[active];
  const answer = lesson ? answers[lesson.id] : undefined;
  const completed = STOCK_LESSONS.filter(item => answers[item.id] === item.correct).length;

  const openLesson = (index: number) => {
    setActive(index);
    logFeatureFirstUse('stock-learning');
  };

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <BookOpen size={19} aria-hidden="true" />
        <h2 id={`${id}-title`}>종목을 읽는 눈</h2>
        <span className={styles.progress} aria-label={`개념 확인 ${completed}개 완료, 전체 3개`}>{completed}/3</span>
      </div>
      <p className={styles.intro}>{name}에서 무엇을 더 살펴볼까요?</p>
      {active === null && (
        <button type="button" className={styles.entry} onClick={() => openLesson(0)}>
          <strong className="reading-title"><LessonTitle lesson={STOCK_LESSONS[0]} /></strong>
          <span>실적 뉴스를 읽을 때 함께 확인할 두 숫자</span>
          <span className={styles.entryLink}>설명 읽기 <ArrowRight size={16} aria-hidden="true" /></span>
        </button>
      )}
      <details className={styles.explore}>
        <summary>차트와 다른 개념 살펴보기</summary>
      {onChart && (
        <div className={styles.chartActions}>
          <span>기간을 바꿔 보면 다른 모습이 보여요</span>
          <div className={styles.actions}>
            <button type="button" onClick={() => { onChart(22); logFeatureFirstUse('stock-learning-chart'); }}>1개월 차트</button>
            <button type="button" onClick={() => { onChart(0); logFeatureFirstUse('stock-learning-chart'); }}>1년 차트</button>
          </div>
          <small>제공된 과거 데이터 범위에서 표시해요.</small>
        </div>
      )}
      <div className={styles.topics} aria-label="배울 주제 선택">
        {STOCK_LESSONS.map((item, index) => (
          <button type="button" key={item.id} aria-expanded={active === index}
            aria-controls={`${id}-lesson`} onClick={() => active === index ? setActive(null) : openLesson(index)}>
            {answers[item.id] === item.correct && <Check size={14} aria-hidden="true" />}
            {item.label}
          </button>
        ))}
      </div>
      </details>
      <div id={`${id}-lesson`}>
        {lesson && (
          <article className={styles.lesson}>
            <h3 className="reading-title"><LessonTitle lesson={lesson} /></h3>
            <p><ReadingText>{lesson.explanation}</ReadingText></p>
            <p className={styles.example}><ReadingText>{lesson.example}</ReadingText></p>
            <fieldset className={styles.quiz}>
              <legend>{lesson.question}</legend>
              {lesson.options.map((option, index) => (
                <label key={option}>
                  <input type="radio" name={`${id}-${lesson.id}`} checked={answer === index}
                    onChange={() => {
                      setAnswers(previous => ({ ...previous, [lesson.id]: index }));
                      if (index === lesson.correct) logFeatureFirstUse(`stock-learning-${lesson.id}`);
                    }} />
                  {option}
                </label>
              ))}
            </fieldset>
            <div role="status" className={styles.feedback}>
              {answer !== undefined && <p><strong>{answer === lesson.correct ? '맞아요. ' : '함께 다시 볼까요? '}</strong>{lesson.answer}</p>}
            </div>
            <p className={styles.observation}><ReadingText>{lesson.observation}</ReadingText></p>
            <div className={styles.actions}>
              <button type="button" onClick={() => { onNews(); logFeatureFirstUse('stock-learning-news'); }}>관련 뉴스에서 확인 <ArrowRight size={14} aria-hidden="true" /></button>
              {onNotes && <button type="button" onClick={() => { onNotes(); logFeatureFirstUse('stock-learning-notes'); }}>내 생각 메모하기</button>}
            </div>
            <div className={styles.footer}>
              <a href={lesson.source} target="_blank" rel="noopener noreferrer">{lesson.sourceLabel}<ExternalLink size={12} aria-label="새 창" /></a>
              {active !== null && active < STOCK_LESSONS.length - 1 && <button type="button" onClick={() => openLesson(active + 1)}>다음 개념 <ArrowRight size={14} aria-hidden="true" /></button>}
            </div>
            <small>기업 재무자료를 읽는 일반 개념이에요. 이 종목의 실제 실적 분석은 아니에요.</small>
          </article>
        )}
      </div>
    </section>
  );
}
