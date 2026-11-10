'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { OPEN_DICTIONARY_EVENT } from '@/lib/dictionaryNavigation';
import { financialTerm } from '@/lib/financialTerms';
import { useModalViewport } from '@/hooks/useModalViewport';
import { usePersonalDictionary } from './PersonalLearningProvider';
import styles from './StockDictionary.module.css';

const StockDictionary = dynamic(() => import('./StockDictionary'), { loading: () => <p role="status">사전을 열고 있어요.</p> });
function DictionaryDialog({ initialTermId, onClose }: { initialTermId?: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useModalViewport(true, ref);
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); }, []);
  return createPortal(<dialog ref={ref} className={styles.overlay} aria-label="내 주식사전" aria-labelledby={id} onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><StockDictionary titleId={id} initialTermId={initialTermId} onClose={onClose} /></dialog>, document.body);
}
/** One listener at the account boundary, including when other pages or menus are open. */
export default function DictionaryOverlay() {
  const { owner } = usePersonalDictionary();
  const trigger = useRef<HTMLElement | null>(null);
  const [request, setRequest] = useState<{ termId?: string } | null>(null);
  useEffect(() => {
    let frame = 0;
    const open = (event: Event) => {
      const value: unknown = (event as CustomEvent<{ termId?: unknown }>).detail?.termId;
      const termId = typeof value === 'string' && financialTerm(value) ? value : undefined;
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      cancelAnimationFrame(frame);
      // Let a menu/term dialog finish unmounting and restoring its focus first.
      frame = requestAnimationFrame(() => setRequest({ termId }));
    };
    window.addEventListener(OPEN_DICTIONARY_EVENT, open);
    return () => { cancelAnimationFrame(frame); window.removeEventListener(OPEN_DICTIONARY_EVENT, open); };
  }, []);
  return request ? <DictionaryDialog key={`${owner}:${request.termId ?? ''}`} initialTermId={request.termId} onClose={() => {
    setRequest(null);
    requestAnimationFrame(() => {
      const candidates = [trigger.current, ...document.querySelectorAll<HTMLElement>('[aria-label="전체 메뉴 열기"], [data-learning-desk] button[aria-label="내 주식사전"]')];
      candidates.find(element => element?.isConnected && element.checkVisibility())?.focus({ preventScroll: true });
    });
  }} /> : null;
}
