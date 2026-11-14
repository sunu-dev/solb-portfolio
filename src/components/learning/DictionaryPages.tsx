'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DictionaryPages.module.css';

type Props = {
  children: ReactNode;
  label: string;
  resetKey?: string;
  busy?: boolean;
  turn?: (commit: () => void, reverse: boolean) => Promise<void>;
  previousEntry?: () => void;
  nextEntry?: () => void;
};

/** Native column fragmentation keeps every line in reading order, without a scrollable sheet. */
export default function DictionaryPages({ children, label, resetKey, busy, turn, previousEntry, nextEntry }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState({ width: 1, count: 1 });
  useLayoutEffect(() => {
    const view = viewport.current, content = flow.current;
    if (!view || !content) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = view.clientWidth;
        if (!width) return;
        content.style.columnWidth = `${width}px`;
        const count = Math.max(1, Math.ceil((content.scrollWidth + 40) / (width + 40) - .01));
        setLayout(current => current.width === width && current.count === count ? current : { width, count });
        setPage(current => Math.min(current, count - 1));
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(view);
    const mutation = new MutationObserver(measure);
    mutation.observe(content, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });
    document.fonts?.addEventListener('loadingdone', measure);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener('loadingdone', measure); };
  }, []);
  useLayoutEffect(() => { setPage(0); }, [resetKey]);
  const change = (reverse: boolean) => {
    const commit = () => {
      if (reverse && page === 0) previousEntry?.();
      else if (!reverse && page === layout.count - 1) nextEntry?.();
      else setPage(value => value + (reverse ? -1 : 1));
    };
    if (turn) void turn(commit, reverse); else commit();
  };
  return <div className={styles.pages}>
    <div ref={viewport} className={styles.viewport} onFocusCapture={event => {
      // Tabbing to a link on another leaf turns to that leaf instead of scrolling the book.
      if (!flow.current || !(event.target instanceof HTMLElement)) return;
      const offset = event.target.getBoundingClientRect().left - flow.current.getBoundingClientRect().left;
      setPage(Math.max(0, Math.min(layout.count - 1, Math.floor((offset + 1) / (layout.width + 40)))));
    }}>
      <div ref={flow} className={styles.flow} style={{ transform: `translateX(${-page * (layout.width + 40)}px)` }}>{children}</div>
    </div>
    <nav className={styles.navigation} aria-label={`${label} 책장 넘기기`}>
      <button type="button" disabled={busy || (page === 0 && !previousEntry)} aria-label={page === 0 && previousEntry ? '이전 단어' : `${label} 이전 쪽`} onClick={() => change(true)}><ChevronLeft size={18} aria-hidden="true" /><span>{page === 0 && previousEntry ? '이전 단어' : '이전 쪽'}</span></button>
      <span aria-live="polite">{page + 1} / {layout.count}쪽</span>
      <button type="button" disabled={busy || (page === layout.count - 1 && !nextEntry)} aria-label={page === layout.count - 1 && nextEntry ? '다음 단어' : `${label} 다음 쪽`} onClick={() => change(false)}><span>{page === layout.count - 1 && nextEntry ? '다음 단어' : '다음 쪽'}</span><ChevronRight size={18} aria-hidden="true" /></button>
    </nav>
  </div>;
}
