"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { STOCK_LESSONS } from "@/config/stockLearning";
import { useDiscoveryHistory } from "@/hooks/useDiscoveryHistory";
import { updateDiscovery } from "@/lib/stockDiscovery";
import { usageEvent } from "@/lib/usageTelemetry";
import { logFeatureFirstUse } from "@/lib/tourTelemetry";
import { learningNeighbors, lessonById, restoreLearningReading, type LearningReadingState, type LearningInstrument } from "@/lib/learningNavigation";
import readingUI from '../ui/ReadingUI.module.css';
import styles from "./StockLearning.module.css";
import ReadingText from "@/components/common/ReadingText";
import LearningText from "./LearningText";
import type { StockContextPacket } from '@/lib/stockContextPacket';

export type { LearningReadingState } from "@/lib/learningNavigation";

interface Props {
  name: string;
  owner: string;
  tags: readonly string[];
  onChart?: () => void;
  onNews: () => void;
  onNotes?: () => void;
  initialLessonId?: string;
  onCompany: () => void;
  symbol?: string;
  instrument?: LearningInstrument;
  embedded?: boolean;
  returnLabel?: string;
  onReturn?: () => void;
  entrySequence?: number;
  initialReading?: LearningReadingState;
  onReadingChange?: (reading: LearningReadingState) => void;
  contextPacket?: StockContextPacket;
}

/** External entries reset the reader; following a concept inside it preserves its trail. */
export default function StockLearning(props: Props) {
  return <LearningReader key={`${props.owner}:${props.symbol ?? props.name}:${props.instrument ?? 'stock'}:${props.entrySequence ?? 0}:${props.initialLessonId ?? ''}`} {...props} />;
}

function LearningReader({ name, owner, tags, onChart, onNews, onNotes, initialLessonId, onCompany,
  instrument = 'stock', embedded = false, returnLabel = '원래 질문으로 돌아가기', onReturn, initialReading, onReadingChange, contextPacket }: Props) {
  const id = useId();
  const { history, ready } = useDiscoveryHistory(owner);
  const [restored] = useState(() => restoreLearningReading(initialReading, initialLessonId));
  const [active, setActive] = useState<string | null>(restored.active);
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const [trail, setTrail] = useState<LearningReadingState["trail"]>(restored.trail);
  const emitReading = useEffectEvent((reading: LearningReadingState) => onReadingChange?.(reading));
  useEffect(() => { emitReading({ active, trail }); }, [active, trail]);
  const [storageError, setStorageError] = useState(false);
  const lesson = instrument === 'stock' ? lessonById(active ?? undefined) : undefined;
  const related = lesson ? learningNeighbors(lesson.id, trail.map(item => item.id), instrument) : [];
  const resume = lessonById(history.resume);
  // Follow the incoming news-topic order, not the lesson catalog's first item.
  const entry = tags.map(tag => lessonById(tag)).find(Boolean);
  const scrollBody = () => root.current?.closest<HTMLElement>('.analysis-body');
  const openLesson = (lessonId: string) => {
    if (!lessonById(lessonId) || instrument === 'fund' || lessonId === active) return;
    if (active) {
      const focused = document.activeElement;
      const target = focused instanceof HTMLElement ? focused.dataset.learningTerm ?? focused.dataset.learningRelated : undefined;
      const kind = focused instanceof HTMLElement && focused.dataset.learningTerm ? 'term' : 'related';
      setTrail(previous => [...previous, { id: active, top: scrollBody()?.scrollTop ?? 0,
        trigger: target ? `[data-learning-${kind}="${target}"]` : undefined }].slice(-30));
    }
    setActive(lessonId);
    setStorageError(!updateDiscovery(owner, h => { h.resume = lessonId; }));
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    });
    usageEvent(active ? 'learning_continue' : 'learning_open');
    logFeatureFirstUse('stock-learning');
  };
  const goBack = () => {
    const previous = trail.at(-1);
    if (!previous) return;
    setTrail(items => items.slice(0, -1));
    setActive(previous.id);
    updateDiscovery(owner, h => { h.resume = previous.id; });
    requestAnimationFrame(() => {
      const trigger = previous.trigger ? root.current?.querySelector<HTMLElement>(previous.trigger) : null;
      (trigger ?? heading.current)?.focus({ preventScroll: true });
      scrollBody()?.scrollTo({ top: previous.top, behavior: 'instant' });
    });
  };

  return <section ref={root} className={`${styles.card}${embedded ? ` ${styles.embedded}` : ''}`} aria-labelledby={`${id}-title`} data-stock-learning data-learning-embedded={embedded || undefined}>
    {!embedded && <>
      <div className={styles.heading}><h2 className={styles.headingTitle} id={`${id}-title`}>{instrument === 'fund' ? '상품 구조 알아보기' : '주식 용어와 개념'}</h2></div>
      <p className={styles.intro}>{instrument === 'fund' ? '투자 대상과 수익 구조부터 살펴보세요.' : '뉴스나 공시에서 낯설었던 내용을 찾아보세요.'}</p>
    </>}
    {instrument === 'fund' ? <>
      {embedded && <h3 id={`${id}-title`}>상품 구조와 이어서 보기</h3>}
      <button type="button" onClick={onCompany}>{name}은 무엇을 추종하고 수익은 어떻게 생기나요? <ArrowRight size={14} /></button>
      {onReturn && <button type="button" className={styles.back} onClick={onReturn}>← {returnLabel}</button>}
    </> : <>
      {!embedded && !lesson && <div className={styles.recommendations}>
        {contextPacket && <button type="button" className={styles.entry} data-context-entry onClick={onNews}><span>공시 해설 미리보기</span><strong>{contextPacket.title}</strong><ArrowRight className={styles.entryArrow} size={20} aria-hidden="true" /></button>}
        {ready && resume && <button type="button" className={styles.entry} data-learning-resume onClick={() => openLesson(resume.id)}><span>읽던 설명 이어서</span><strong>{resume.title}</strong><ArrowRight className={styles.entryArrow} size={20} aria-hidden="true" /></button>}
        {entry && (!ready || resume?.id !== entry.id) && <button type="button" className={styles.entry} data-learning-suggestion="general-concept" data-lesson-id={entry.id} onClick={() => openLesson(entry.id)}><span>관련 개념</span><strong>{entry.title}</strong><ArrowRight className={styles.entryArrow} size={20} aria-hidden="true" /></button>}
      </div>}
      {lesson ? <article className={styles.lesson} data-open-lesson={lesson.id}>
        {!embedded && <button type="button" className={styles.back} onClick={() => {
          setActive(null); setTrail([]);
          requestAnimationFrame(() => {
            const entryButton = root.current?.querySelector<HTMLButtonElement>('[data-learning-resume], [data-lesson-id]');
            entryButton?.focus({ preventScroll: true });
            entryButton?.scrollIntoView({ block: 'nearest' });
          });
        }} data-learning-list>← 개념 목록으로</button>}
        {(trail.length > 0 || onReturn) && <nav className={styles.readingPath} aria-label="설명 읽기 경로">
          {trail.length > 0 && <button type="button" className={styles.back} data-learning-back onClick={goBack}>← {lessonById(trail.at(-1)?.id)?.title}</button>}
          {onReturn && <button type="button" className={styles.back} onClick={onReturn}>← {returnLabel}</button>}
        </nav>}
        <h3 id={embedded ? `${id}-title` : undefined} className="reading-title" ref={heading} tabIndex={-1}>{lesson.title}</h3>
        <p className={styles.scope}>일반 배경 해설 · 이 종목의 실제 결과나 당일 변동 원인을 뜻하지 않아요.</p>
        <p><LearningText text={lesson.explanation} current={lesson.id} onOpen={openLesson} /></p>
        <p className={styles.example}><ReadingText>{lesson.example}</ReadingText></p>
        <h4>실제 자료를 읽을 때</h4>
        <p className={styles.observation}><LearningText text={lesson.observation} current={lesson.id} onOpen={openLesson} /></p>
        {related.length > 0 && <div className={styles.related} aria-label="이어서 읽을 개념">
          <h4>이어서 읽기</h4>
          {related.map(({ lesson: item, reason, visited }, index) => <button type="button" key={item.id} data-learning-related={item.id} data-learning-primary={index === 0 || undefined} onClick={() => openLesson(item.id)}><span>{reason}</span><strong>{item.title} →</strong>{visited && <small>앞서 읽은 설명 다시 보기</small>}</button>)}
        </div>}
        {onReturn && <button type="button" className={styles.back} data-learning-return onClick={onReturn}>← {returnLabel}</button>}
        <details className={styles.explore}>
          <summary className={readingUI.disclosure}>출처와 다른 확인 방법</summary>
          <div className={styles.footer}><a href={lesson.source} target="_blank" rel="noopener noreferrer">{lesson.sourceLabel}<ExternalLink size={12} aria-label="새 창" /></a></div>
          <small>출처를 바탕으로 정리한 해설이며 예시는 가상이에요.</small>
          <div className={styles.actions}>
            {onChart && lesson.id === 'price' && <button type="button" onClick={onChart}>가격 차트 다시 보기</button>}
            {!embedded && <><button type="button" onClick={onNews}>이 종목의 뉴스 목록</button><button type="button" onClick={onCompany}>{name}의 사업 설명</button></>}
            {onNotes && <button type="button" onClick={onNotes}>필요한 내용 메모하기</button>}
          </div>
        </details>
      </article> : embedded ? <p id={`${id}-title`}>연결된 설명을 찾지 못했어요.{onReturn && <button type="button" onClick={onReturn}>{returnLabel}</button>}</p> : null}
      {!embedded && <details className={styles.explore} open={!entry && !resume && !lesson ? true : undefined}>
        <summary className={readingUI.disclosure}>{entry || resume || lesson ? '다른 개념 찾아보기' : '개념 찾아보기'}</summary>
        <div className={styles.topics} aria-label="개념 자료실">{STOCK_LESSONS.map(item => <button type="button" key={item.id} data-lesson-id={item.id} aria-expanded={active === item.id} onClick={() => openLesson(item.id)}>{item.label}</button>)}</div>
        <small className={styles.storageInfo}>읽던 설명은 이 브라우저에 저장해요. 로그아웃·계정 전환 때 지워지며 다른 기기와 동기화되지 않아요.</small>
      </details>}
      {storageError && <p role="status">읽기 기록을 저장하지 못했어요. 설명은 계속 볼 수 있어요.</p>}
    </>}
  </section>;
}
