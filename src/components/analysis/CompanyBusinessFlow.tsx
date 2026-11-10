'use client';
import { useEffect, useRef, useState } from 'react';
import { Building2, Monitor, ReceiptText, RotateCcw } from 'lucide-react';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import styles from './CompanyBusinessFlow.module.css';

// A schematic of reviewed business facts, not revenue proportions or a live transaction.
const flows: Record<string, readonly [string, string, string]> = {
  MSFT: ['개인·기업·기관', '업무 도구·클라우드', '구독료·사용료 등'],
  PLTR: ['정부기관·민간 기업', '데이터·AI 소프트웨어', '구독·운영·서비스'],
  ORCL: ['기업·기관', '데이터베이스·클라우드', '소프트웨어·서비스 매출'],
};
export default function CompanyBusinessFlow({ symbol }: { symbol: string }) {
  const labels = flows[getStockIdentityKey(symbol)];
  const ref = useRef<HTMLElement>(null);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    sync(); media.addEventListener('change', sync);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        if (!media.matches) { setRun(1); setPlaying(true); }
        observer.disconnect();
      }
    }, { threshold: .6 });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); media.removeEventListener('change', sync); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), 3000);
    return () => clearTimeout(timer);
  }, [playing, run]);
  if (!labels) return null;
  const icons = [Building2, Monitor, ReceiptText];
  return <figure ref={ref} className={styles.figure} aria-label="고객의 사용이 매출로 이어지는 사업 구조" data-business-motion={playing && !reduced ? 'playing' : 'static'}>
    <figcaption className={styles.caption}>고객의 사용이 매출로 이어져요</figcaption>
    <ol key={run} className={styles.flow} data-playing={playing && !reduced}>
      {labels.map((label, index) => { const Icon = icons[index]; return <li key={label} className={styles.step}>
        <span className={styles.drawing}><Icon size={32} strokeWidth={1.25} aria-hidden="true" /></span>
        <span className={styles.label}>{label}</span>
        {index < 2 && <span className={styles.connection} aria-hidden="true"><span /></span>}
      </li>; })}
    </ol>
    <div className={styles.footer}><small>주요 사업의 연결을 간추린 그림이에요. 매출 비중을 뜻하지 않아요.</small>
      <button type="button" className={styles.replay} disabled={playing || reduced} onClick={() => {setRun(value => value + 1); setPlaying(true);}} aria-label="사업 흐름 다시 재생"><RotateCcw size={14} aria-hidden="true" />다시 보기</button>
    </div>
  </figure>;
}
