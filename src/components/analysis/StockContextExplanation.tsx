'use client';
import type { StockContextPacket } from '@/lib/stockContextPacket';
import styles from './StockContextExplanation.module.css';
import readingUI from '../ui/ReadingUI.module.css';

export default function StockContextExplanation({packet}:{packet:StockContextPacket}) {
  return <section className={styles.context} data-stock-context={packet.id} data-context-version={packet.version} aria-label="공시에서 확인한 내용">
    <p className={styles.preview}>검토 중인 설명 · 운영 미공개</p>
    <h3>{packet.title}</h3>
    <p className={styles.summary}>{packet.summary}</p>
    <div className={styles.questions}>{packet.questions.map(q=><details key={q.id} data-context-question={q.id}>
      <summary className={readingUI.disclosure}>{q.title}</summary><p>{q.answer}</p>
    </details>)}</div>
    <p className={styles.watch}><strong>다음 공시에서 확인할 것</strong>{packet.watch}</p>
    <a className={styles.source} href={packet.source.url} target="_blank" rel="noopener noreferrer">{packet.source.label} · {packet.source.publishedAt.slice(0,10)} 공시 ↗</a>
  </section>;
}
