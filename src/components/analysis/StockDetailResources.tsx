'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Building2, ChartNoAxesCombined, ChevronRight, Hash, X } from 'lucide-react';
import styles from './StockDetailResources.module.css';

interface Resource { id:string; title:string; description:string; content:ReactNode }

export default function StockDetailResources({ items, initialId }: { items:Resource[]; initialId?:string }) {
  const [activeId, setActiveId] = useState(initialId);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const active = items.find(item => item.id === activeId);
  if (!items.length) return null;

  return <section id="anchor-resources" className={styles.section} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className={styles.title}>더 살펴볼 자료</h3>
    <div className={styles.choices}>
      {items.map(item => <button key={item.id} type="button" className={styles.choice}
        ref={element => { if (element) triggers.current.set(item.id, element); else triggers.current.delete(item.id); }}
        aria-expanded={activeId === item.id} aria-controls={`${id}-panel`}
        onClick={() => {
          if (activeId === item.id) { setActiveId(undefined); return; }
          setActiveId(item.id);
          requestAnimationFrame(() => { heading.current?.focus({preventScroll:true}); heading.current?.scrollIntoView({block:'nearest'}); });
        }}>
        <span className={styles.icon} aria-hidden="true">{item.id === 'industry' ? <Building2 size={19} /> : item.id === 'numbers' ? <Hash size={19} /> : <ChartNoAxesCombined size={19} />}</span>
        <span className={styles.copy}><span className={styles.choiceTitle}>{item.title}</span><span className={styles.description}>{item.description}</span></span>
        <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
      </button>)}
    </div>
    {active && <div id={`${id}-panel`} className={styles.panel}>
      <div className={styles.panelHeader}>
        <h4 ref={heading} tabIndex={-1}>{active.title}</h4>
        <button type="button" aria-label={`${active.title} 닫기`} onClick={() => { setActiveId(undefined); triggers.current.get(active.id)?.focus(); }}><X size={18} aria-hidden="true" /></button>
      </div>
      {active.content}
    </div>}
  </section>;
}
