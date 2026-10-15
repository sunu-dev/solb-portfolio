"use client";

import { useId, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ExternalLink } from "lucide-react";
import { STOCK_LESSONS } from "@/config/stockLearning";
import { useDiscoveryHistory } from "@/hooks/useDiscoveryHistory";
import { updateDiscovery } from "@/lib/stockDiscovery";
import { usageEvent } from "@/lib/usageTelemetry";
import { logFeatureFirstUse } from "@/lib/tourTelemetry";
import styles from "./StockLearning.module.css";
import ReadingText from "@/components/common/ReadingText";
import LearningText from "./LearningText";
import { LEARNING_LINKS } from "@/config/stockLearningGraph";

interface Props {
  name: string;
  owner: string;
  tags: readonly string[];
  onChart?: (days: number) => void;
  onNews: () => void;
  onNotes?: () => void;
  initialLessonId?: string;
  onCompany: () => void;
}
export default function StockLearning({
  name,
  owner,
  tags,
  onChart,
  onNews,
  onNotes,
  initialLessonId,
  onCompany,
}: Props) {
  const id = useId();
  const { history, ready } = useDiscoveryHistory(owner);
  const [active, setActive] = useState<string | null>(initialLessonId ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [trail, setTrail] = useState<{ id: string; top: number }[]>([]);
  const [storageError, setStorageError] = useState(false);
  const lesson = STOCK_LESSONS.find((item) => item.id === active);
  const ranked = STOCK_LESSONS.map((item, index) => ({
    item,
    index,
    score:
      (tags.includes(item.id) ? 5 : 0) - (history.lessons[item.id] ? 2 : 0),
  }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
  const resume = STOCK_LESSONS.find((item) => item.id === history.resume);
  const completed = STOCK_LESSONS.filter(
    (item) => history.lessons[item.id],
  ).length;
  const openLesson = (lessonId: string, continuing = false) => {
    if (active && active !== lessonId)
      setTrail((previous) =>
        [
          ...previous,
          {
            id: active,
            top: document.querySelector(".analysis-body")?.scrollTop ?? 0,
          },
        ].slice(-30),
      );
    setActive(lessonId);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start" });
    });
    setStorageError(
      !updateDiscovery(owner, (h) => {
        h.resume = lessonId;
      }),
    );
    usageEvent(continuing ? "learning_continue" : "learning_open");
    logFeatureFirstUse("stock-learning");
  };
  const relatedId =
    lesson && "next" in lesson
      ? lesson.next
      : lesson?.id === "earnings"
        ? "cash"
        : lesson?.id === "cash"
          ? "debt"
          : "evidence";
  const next = lesson
    ? (ranked.find(
        (item) =>
          item.id === relatedId &&
          item.id !== lesson.id &&
          !history.lessons[item.id],
      ) ??
      ranked.find((item) => item.id !== lesson.id && !history.lessons[item.id]))
    : undefined;
  const related = lesson
    ? (LEARNING_LINKS[lesson.id] ?? [])
        .map(([target, reason]) => ({
          item: STOCK_LESSONS.find((item) => item.id === target)!,
          reason,
        }))
        .filter((row) => row.item)
        .sort(
          (a, b) =>
            Number(!!history.lessons[a.item.id]) -
            Number(!!history.lessons[b.item.id]),
        )
    : [];
  return (
    <section
      className={styles.card}
      aria-labelledby={`${id}-title`}
      data-stock-learning
    >
      <div className={styles.heading}>
        <BookOpen size={19} aria-hidden="true" />
        <h2 id={`${id}-title`}>종목을 읽는 눈</h2>
        <span className={styles.progress}>
          {completed}/{STOCK_LESSONS.length} 읽음
        </span>
      </div>
      <p className={styles.intro}>
        {name}에서 생긴 궁금증을 사업·실적·산업·경제로 이어가요. 설명 읽기는 AI
        횟수를 쓰지 않아요.
      </p>
      {ready && (
        <>
          {!lesson && (
            <div className={styles.recommendations}>
              {resume && (
                <button
                  type="button"
                  className={styles.entry}
                  data-learning-resume
                  onClick={() => openLesson(resume.id, true)}
                >
                  <span>
                    {history.lessons[resume.id]
                      ? "지난 설명 다시 보기"
                      : "읽던 설명 이어 보기"}
                  </span>
                  <strong>{resume.title}</strong>
                  <ArrowRight size={16} />
                </button>
              )}
              {ranked
                .filter((item) => item.id !== resume?.id)
                .slice(0, 3)
                .map((item) => (
                  <button
                    type="button"
                    className={styles.entry}
                    key={item.id}
                    data-lesson-id={item.id}
                    onClick={() => openLesson(item.id)}
                  >
                    <span>
                      {history.lessons[item.id]
                        ? "다시 살펴보기"
                        : tags.includes(item.id)
                          ? "최근 뉴스 제목과 이어지는 개념"
                          : "아직 읽지 않은 개념"}
                    </span>
                    <strong>{item.title}</strong>
                    <span className={styles.entryLink}>
                      설명 읽기 <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
            </div>
          )}
          <details className={styles.explore}>
            <summary>전체 {STOCK_LESSONS.length}개 주제 살펴보기</summary>
            <div className={styles.topics} aria-label="배울 주제 선택">
              {STOCK_LESSONS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  data-lesson-id={item.id}
                  aria-expanded={active === item.id}
                  aria-controls={`${id}-lesson`}
                  onClick={() =>
                    active === item.id ? setActive(null) : openLesson(item.id)
                  }
                >
                  {history.lessons[item.id] ? (
                    <Check size={14} aria-label="읽음" />
                  ) : null}
                  {item.label}
                </button>
              ))}
            </div>
          </details>
          <div id={`${id}-lesson`} aria-live="polite">
            {lesson && (
              <article className={styles.lesson} data-open-lesson={lesson.id}>
                {trail.length > 0 && (
                  <button
                    type="button"
                    className={styles.back}
                    data-learning-back
                    onClick={() => {
                      const previous = trail.at(-1)!;
                      setTrail((items) => items.slice(0, -1));
                      setActive(previous.id);
                      updateDiscovery(owner, (h) => {
                        h.resume = previous.id;
                      });
                      requestAnimationFrame(() => {
                        heading.current?.focus({ preventScroll: true });
                        document
                          .querySelector(".analysis-body")
                          ?.scrollTo({ top: previous.top });
                      });
                    }}
                  >
                    ← 방금 읽던 설명으로
                  </button>
                )}
                <h3 className="reading-title" ref={heading} tabIndex={-1}>
                  {lesson.title}
                </h3>
                <p>
                  <LearningText
                    text={lesson.explanation}
                    current={lesson.id}
                    onOpen={(id) => openLesson(id, true)}
                  />
                </p>
                <p className={styles.example}>
                  <ReadingText>{lesson.example}</ReadingText>
                </p>
                <h4>이 종목에서는 무엇을 확인하나요?</h4>
                <p className={styles.observation}>
                  <LearningText
                    text={lesson.observation}
                    current={lesson.id}
                    onOpen={(id) => openLesson(id, true)}
                  />
                </p>
                <div className={styles.actions}>
                  <button type="button" onClick={onNews}>
                    관련 뉴스 확인 <ArrowRight size={14} />
                  </button>
                  {onNotes && (
                    <button type="button" onClick={onNotes}>
                      내 생각 메모하기
                    </button>
                  )}
                </div>
                <div
                  className={styles.related}
                  aria-label="이어서 궁금해지는 질문"
                >
                  <h4>여기까지 읽으니, 이것도 궁금하지 않나요?</h4>
                  {related.map(({ item, reason }) => (
                    <button
                      type="button"
                      key={item.id}
                      data-learning-related={item.id}
                      onClick={() => openLesson(item.id, true)}
                    >
                      <span>{reason}</span>
                      <strong>{item.title} →</strong>
                      <small>
                        {history.lessons[item.id]
                          ? "읽은 설명 다시 보기"
                          : "아직 읽지 않은 설명"}
                      </small>
                    </button>
                  ))}
                  <button type="button" onClick={onCompany}>
                    <span>개념을 실제 사업과 연결해 보기</span>
                    <strong>
                      {name}의 사업과 관련 기업은 어떻게 이어질까요? →
                    </strong>
                  </button>
                </div>
                <div className={styles.footer}>
                  <a
                    href={lesson.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {lesson.sourceLabel}
                    <ExternalLink size={12} aria-label="새 창" />
                  </a>
                </div>
                <small>
                  출처를 바탕으로 주비가 정리한 일반 해설이에요. 예시는 가상이며
                  이 회사의 실제 실적이나 계약을 뜻하지 않아요.
                </small>
                <div className={styles.actions}>
                  <button
                    type="button"
                    data-lesson-complete
                    onClick={() => {
                      setStorageError(
                        !updateDiscovery(owner, (h) => {
                          h.lessons[lesson.id] = Date.now();
                          h.resume = next?.id ?? lesson.id;
                        }),
                      );
                      usageEvent("learning_read");
                      if (next) openLesson(next.id, true);
                      else setActive(null);
                    }}
                  >
                    {next ? "읽었어요 · 다음 설명" : "읽었어요 · 목록으로"}{" "}
                    <ArrowRight size={14} />
                  </button>
                  <button type="button" onClick={() => setActive(null)}>
                    주제 목록
                  </button>
                </div>
                {next && (
                  <p className={styles.nextTopic}>이어서: {next.title}</p>
                )}
              </article>
            )}
          </div>
        </>
      )}
      {onChart && (
        <div className={styles.chartActions}>
          <span>배운 관점으로 기간을 바꿔 살펴봐요</span>
          <div className={styles.actions}>
            {[
              [6, "1주일"],
              [22, "1개월"],
              [0, "1년"],
            ].map(([days, label]) => (
              <button
                type="button"
                key={days}
                onClick={() => onChart(Number(days))}
              >
                {label} 차트
              </button>
            ))}
          </div>
          <small>제공된 과거 데이터 범위에서 표시해요.</small>
        </div>
      )}
      <small>
        읽은 주제와 이어 읽기는 이 브라우저에 저장해요. 로그아웃·계정 전환 때
        지워지며 다른 기기와 동기화되지 않아요.
      </small>
      {storageError && (
        <p role="status">
          브라우저 저장이 제한돼 읽기 기록을 저장하지 못했어요. 설명은 계속 볼
          수 있어요.
        </p>
      )}
    </section>
  );
}
