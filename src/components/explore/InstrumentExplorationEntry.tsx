'use client';
import FinancialText from '@/components/common/FinancialText';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { ChevronDown, Layers3 } from 'lucide-react';
import type { ExplorationReadingState } from './ContextExploration';
import type { SectorId, SectorProfile } from '@/lib/sectorExploration';
import { sectorArtwork } from '@/lib/sectorArtwork';
import styles from './InstrumentExplorationEntry.module.css';

const ContextExploration = dynamic(() => import('./ContextExploration'), {
  loading: () => <p role="status">산업 설명을 불러오고 있어요…</p>,
});

interface Props {
  label: string; description: string; meaning?: string; detail?: string; scope?: string;
  sector?: SectorId; symbol?: string; profile?: SectorProfile;
  image?: string;
  open?: boolean; onOpenChange?: (open: boolean) => void;
  reading?: ExplorationReadingState; onReadingChange?: (reading: ExplorationReadingState) => void;
  onOpenStock?: (symbol: string, reading: ExplorationReadingState) => void;
}

/** One small entry; the industry reader is loaded only when the user opens it. */
export default function InstrumentExplorationEntry(props: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const trigger = useRef<HTMLElement>(null);
  const open = props.open ?? localOpen;
  const image = props.sector ? sectorArtwork(props.sector)?.image ?? `/illustrations/sectors/${props.sector}-light.svg` : props.image;
  return <details className={styles.entry} data-explanation-entry open={open} onToggle={event => {
    const next = event.currentTarget.open;
    if (next !== open) { setLocalOpen(next); props.onOpenChange?.(next); }
  }}>
    <summary ref={trigger} className={styles.trigger} data-ui-disclosure="composite">
      <span className={styles.icon} aria-hidden="true">{image ? <Image src={image} alt="" width={72} height={48} sizes="72px" /> : <Layers3 size={26} />}</span>
      <span className={styles.copy}><strong>{props.label}</strong><small>{props.description}</small></span>
      <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
    </summary>
    {open && <div className={styles.content} data-exploration-content>
      {props.meaning && <p><FinancialText>{props.meaning}</FinancialText></p>}
      {props.detail && <p><FinancialText>{props.detail}</FinancialText></p>}
      {props.scope && <p className={styles.scope} data-explanation-scope>{props.scope}</p>}
      {(props.sector || props.symbol) && <ContextExploration
        topics={props.sector ? [`sector:${props.sector}`] : ['compare']}
        context={props.label} industryOnly symbol={props.symbol} profile={props.profile}
        initialReadingState={props.reading} onReadingChange={props.onReadingChange}
        onClose={() => { setLocalOpen(false); props.onOpenChange?.(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }}
        onOpenStock={props.onOpenStock} />}
    </div>}
  </details>;
}
