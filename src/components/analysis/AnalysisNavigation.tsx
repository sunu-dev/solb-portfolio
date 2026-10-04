'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import styles from './AnalysisNavigation.module.css';

interface AnalysisNavigationProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  hasChart: boolean;
  hasFundamentals: boolean;
  hasAssistant: boolean;
  layoutKey: string;
}

interface NavigationItem {
  id: string;
  label: string;
}

const DESTINATION_GAP = 16;

export default function AnalysisNavigation({
  scrollRef, hasChart, hasFundamentals, hasAssistant, layoutKey,
}: AnalysisNavigationProps) {
  const items = useMemo<NavigationItem[]>(() => [
    ...(hasChart ? [{ id: 'anchor-chart', label: '차트' }] : []),
    { id: 'anchor-news', label: '뉴스' },
    ...(hasFundamentals ? [{ id: 'anchor-fundamentals', label: '기업 지표' }] : []),
    ...(hasAssistant ? [{ id: 'anchor-assistant', label: '주비 노트' }] : []),
    { id: 'anchor-learning', label: '배우기' },
  ], [hasChart, hasFundamentals, hasAssistant]);
  const [activeId, setActiveId] = useState(items[0].id);
  const activeIdRef = useRef(activeId);
  const listRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef<{ id: string; top: number } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let frame: number | null = null;
    const targets = items.flatMap(item => {
      const element = root.querySelector<HTMLElement>(`#${item.id}`);
      return element ? [{ ...item, element }] : [];
    });

    const activate = (id: string) => {
      if (id === activeIdRef.current) return;
      activeIdRef.current = id;
      setActiveId(id);
    };
    const measure = () => {
      frame = null;
      if (!targets.length) return;
      const requested = requestedRef.current;
      if (requested) {
        // Keep the chosen item steady while native smooth scrolling passes
        // intermediate sections. Manual scrolling releases this immediately.
        if (Math.abs(root.scrollTop - requested.top) <= 2) {
          requestedRef.current = null;
          if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        activate(requested.id);
        return;
      }

      const readingLine = root.getBoundingClientRect().top + DESTINATION_GAP + 8;
      let current = targets[0];
      let closestTop = -Infinity;
      for (const target of targets) {
        const top = target.element.getBoundingClientRect().top;
        if (top <= readingLine && top >= closestTop) {
          current = target;
          closestTop = top;
        }
      }
      if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        current = targets[targets.length - 1];
      }
      activate(current.id);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    const releaseRequested = () => {
      requestedRef.current = null;
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
      schedule();
    };
    scheduleRef.current = schedule;
    requestedRef.current = null;
    root.addEventListener('scroll', schedule, { passive: true });
    root.addEventListener('wheel', releaseRequested, { passive: true });
    root.addEventListener('touchstart', releaseRequested, { passive: true });
    root.addEventListener('pointerdown', releaseRequested, { passive: true });
    root.addEventListener('keydown', releaseRequested);
    window.addEventListener('resize', releaseRequested);

    // Replies and expanded explanations can move section headings without a
    // window resize. Observe content blocks, not only the fixed-height viewport.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(root);
    for (const child of root.children) observer?.observe(child);
    schedule();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
      scheduleRef.current = null;
      requestedRef.current = null;
      observer?.disconnect();
      root.removeEventListener('scroll', schedule);
      root.removeEventListener('wheel', releaseRequested);
      root.removeEventListener('touchstart', releaseRequested);
      root.removeEventListener('pointerdown', releaseRequested);
      root.removeEventListener('keydown', releaseRequested);
      window.removeEventListener('resize', releaseRequested);
    };
  }, [items, layoutKey, scrollRef]);

  useEffect(() => {
    const list = listRef.current;
    const button = list?.querySelector<HTMLButtonElement>(`[data-analysis-section="${activeId}"]`);
    if (!list || !button) return;
    const listBounds = list.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    let offset = 0;
    if (buttonBounds.left < listBounds.left + 12) offset = buttonBounds.left - listBounds.left - 12;
    else if (buttonBounds.right > listBounds.right - 12) offset = buttonBounds.right - listBounds.right + 12;
    if (offset) list.scrollTo({ left: list.scrollLeft + offset, behavior: 'auto' });
  }, [activeId]);

  const goToSection = (id: string) => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`#${id}`);
    if (!root || !target) return;
    const desiredTop = root.scrollTop + target.getBoundingClientRect().top
      - root.getBoundingClientRect().top - DESTINATION_GAP;
    const top = Math.max(0, Math.min(desiredTop, root.scrollHeight - root.clientHeight));
    requestedRef.current = { id, top };
    activeIdRef.current = id;
    setActiveId(id);
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      requestedRef.current = null;
      settleTimerRef.current = null;
      scheduleRef.current?.();
    }, 1400);
    root.scrollTo({
      top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    scheduleRef.current?.();
  };

  return (
    <nav className={styles.navigation} aria-label="종목 상세 탐색">
      <div className={styles.list} ref={listRef}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className={styles.item}
            data-analysis-section={item.id}
            aria-controls={item.id}
            aria-current={activeId === item.id ? 'location' : undefined}
            onClick={() => goToSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
