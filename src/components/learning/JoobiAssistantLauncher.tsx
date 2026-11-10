'use client';

import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { useNoticeAcknowledgement } from '@/hooks/useNoticeAcknowledgement';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useModalViewport } from '@/hooks/useModalViewport';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getStockCurrency } from '@/utils/stockCurrency';
import { getUsClockChangeNotice } from '@/utils/usClockChange';
import UsMarketClockNotice from '@/components/portfolio/UsMarketClockNotice';
import { usePersonalDictionary } from './PersonalLearningProvider';
import JoobiAvatar from './JoobiAvatar';
import styles from './JoobiAssistantLauncher.module.css';

const AskJoobi = dynamic(() => import('./AskJoobi'), {
  loading: () => <p role="status">질문 입력창을 열고 있어요.</p>,
});

function AssistantDialog({ symbol, showUsNotice, now, onClose }: {
  symbol?: string; showUsNotice: boolean; now: number; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { owner } = usePersonalDictionary();
  useFocusTrap(true, panel, onClose);
  useModalViewport(true, viewport);

  return createPortal(<div ref={viewport} className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className={styles.header}>
        <JoobiAvatar size={36} />
        <div><h2 id={titleId} tabIndex={-1} data-dialog-initial-focus>주비에게 물어보기</h2>
          <p>나의 AI 주식비서</p></div>
        <button type="button" className={styles.close} aria-label="주비 질문창 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>
      <div className={styles.body}>
        <AskJoobi key={`${owner}:${symbol ?? 'general'}`} symbol={symbol} embedded notice={showUsNotice ? <UsMarketClockNotice now={now} compact /> : undefined} />
      </div>
    </div>
  </div>, document.body);
}

/** A visible entry on the app shell, or inside the detail dialog's focus boundary. */
export default function JoobiAssistantLauncher({ symbol, name, inline = false, iconOnly = false }: { symbol?: string; name?: string; inline?: boolean; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  const hasUsStocks = usePortfolioStore(state => [...state.stocks.investing, ...state.stocks.watching]
    .some(stock => !stock.demo && getStockCurrency(stock.symbol, stock.currency) === 'USD'));
  const showUsNotice = symbol ? getStockCurrency(symbol) === 'USD' : hasUsStocks;
  const notice = showUsNotice && now ? getUsClockChangeNotice(new Date(now)) : null;
  const acknowledged = useNoticeAcknowledgement(notice?.id);

  return <>
    <button type="button" className={`${styles.launcher} ${iconOnly ? styles.iconOnly : inline ? styles.inline : styles.floating}`}
      aria-label="주비에게 물어보기" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <JoobiAvatar size={iconOnly ? 28 : inline ? 44 : 48} />
      <span className={styles.label}><strong>주비에게 물어보기</strong>
        <span>{notice && !acknowledged ? notice.title : symbol ? `${name || symbol}, 어떤 점이 궁금하세요?` : '궁금한 주식 이야기를 들려주세요'}</span></span>
    </button>
    {open && <AssistantDialog symbol={symbol} showUsNotice={showUsNotice} now={now} onClose={() => setOpen(false)} />}
  </>;
}
