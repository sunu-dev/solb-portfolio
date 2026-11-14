'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DictionaryPages.module.css';

type Props = {
  children: ReactNode;
  label: string;
  resetKey?: string;
  spread?: boolean;
  jump?: { id: string; revision: number };
  busy?: boolean;
  turn?: (commit: () => void, reverse: boolean) => Promise<void>;
  previousEntry?: () => void;
  nextEntry?: () => void;
};

/** Native column fragmentation keeps every line in reading order, without a scrollable sheet. */
export default function DictionaryPages({ children, label, resetKey, spread = false, jump, busy, turn, previousEntry, nextEntry }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState({ width: 1, count: 1, visible: 1 });
  useLayoutEffect(() => {
    const view = viewport.current, content = flow.current;
    if (!view || !content) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visible = spread && matchMedia('(min-width: 651px)').matches ? 2 : 1;
        const width = (view.clientWidth - 40 * (visible - 1)) / visible;
        if (!width) return;
        content.style.columnWidth = `${width}px`;
        content.style.columnCount = String(visible);
        const count = Math.max(1, Math.ceil((content.scrollWidth + 40) / (width + 40) - .01));
        setLayout(current => current.width === width && current.count === count && current.visible === visible ? current : { width, count, visible });
        setPage(current => Math.min(Math.floor(current / visible) * visible, Math.floor((count - 1) / visible) * visible));
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(view);
    const mutation = new MutationObserver(measure);
    mutation.observe(content, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });
    document.fonts?.addEventListener('loadingdone', measure);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener('loadingdone', measure); };
  }, [spread]);
  useLayoutEffect(() => { setPage(0); }, [resetKey]);
  useLayoutEffect(() => {
    const target = flow.current?.querySelector<HTMLElement>(`[data-book-entry="${CSS.escape(jump?.id ?? '')}"]`);
    if (!target || !flow.current || !jump) return;
    const offset = target.getBoundingClientRect().left - flow.current.getBoundingClientRect().left;
    const leaf = Math.round(offset / (layout.width + 40));
    setPage(Math.floor(leaf / layout.visible) * layout.visible);
  }, [jump, layout.width, layout.visible]);
  const change = (reverse: boolean) => {
    const commit = () => {
      if (reverse && page === 0) previousEntry?.();
      else if (!reverse && page + layout.visible >= layout.count) nextEntry?.();
      else setPage(value => Math.max(0, value + (reverse ? -layout.visible : layout.visible)));
    };
    if (turn) void turn(commit, reverse); else commit();
  };
  return <div className={styles.pages}>
    <div ref={viewport} className={styles.viewport} onFocusCapture={event => {
      // Tabbing to a link on another leaf turns to that leaf instead of scrolling the book.
      if (!flow.current || !(event.target instanceof HTMLElement)) return;
      const offset = event.target.getBoundingClientRect().left - flow.current.getBoundingClientRect().left;
      const leaf = Math.floor((offset + 1) / (layout.width + 40));
      setPage(Math.max(0, Math.floor(Math.min(layout.count - 1, leaf) / layout.visible) * layout.visible));
    }}>
      <div ref={flow} className={styles.flow} style={{ transform: `translateX(${-page * (layout.width + 40)}px)` }}>{children}</div>
    </div>
    <nav className={styles.navigation} aria-label={`${label} 책장 넘기기`}>
      <button type="button" disabled={busy || (page === 0 && !previousEntry)} aria-label={page === 0 && previousEntry ? '이전 단어' : `${label} 이전 쪽`} onClick={() => change(true)}><ChevronLeft size={18} aria-hidden="true" /><span>{page === 0 && previousEntry ? '이전 단어' : '이전 장'}</span></button>
      <span aria-live="polite">{page + 1}{layout.visible === 2 && page + 1 < layout.count ? `–${Math.min(layout.count, page + 2)}` : ''} / {layout.count}쪽</span>
      <button type="button" disabled={busy || (page + layout.visible >= layout.count && !nextEntry)} aria-label={page + layout.visible >= layout.count && nextEntry ? '다음 단어' : `${label} 다음 쪽`} onClick={() => change(false)}><span>{page + layout.visible >= layout.count && nextEntry ? '다음 단어' : '다음 장'}</span><ChevronRight size={18} aria-hidden="true" /></button>
    </nav>
  </div>;
}
