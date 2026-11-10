'use client';

import { useEffect, useState } from 'react';
import styles from './ChartAnalysisLoading.module.css';

const TIPS = [
  '같은 종목도 어느 기간을 보느냐에 따라 차트의 모양이 달라져요.',
  '거래량은 거래된 주식 수예요. 가격의 움직임과 함께 살펴봐요.',
  '차트의 한 가지 모양만으로 다음 가격을 알 수는 없어요.',
];

export default function ChartAnalysisLoading() {
  const [tip, setTip] = useState(0);
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const rotation = setInterval(() => setTip(value => (value + 1) % TIPS.length), 6500);
    const delay = setTimeout(() => setDelayed(true), 20_000);
    return () => { clearInterval(rotation); clearTimeout(delay); };
  }, []);
  return <div className={styles.loading} data-chart-analysis-loading>
    <div className={styles.header}>
      <svg className={styles.drawing} viewBox="0 0 116 56" fill="none" aria-hidden="true" focusable="false">
        <path className={styles.grid} d="M4 15H112M4 29H112M4 43H112" />
        {[12, 30, 48, 66, 84].map((x, index) => <g key={x} className={styles.candle} style={{ animationDelay: `${index * 180}ms` }}>
          <path d={`M${x} 12V43`} /><rect x={x - 3} y={18 + index % 3 * 3} width="6" height={12 + index % 2 * 4} rx="1" />
        </g>)}
        <path className={styles.guide} d="M5 37L22 30L39 34L56 20L73 27L90 15L110 22" />
        <path className={styles.trace} d="M5 37L22 30L39 34L56 20L73 27L90 15L110 22" pathLength="1" />
        <circle className={styles.point} cx="110" cy="22" r="3" />
      </svg>
      <div className={styles.message} role="status" aria-live="polite" aria-atomic="true">
        <p className={styles.title}>차트 해설을 준비하고 있어요</p>
        <p className={styles.description}>{delayed ? '답변이 조금 늦어지고 있어요. 잠시만 기다려 주세요.' : '답변이 도착하면 여기에 보여드릴게요.'}</p>
      </div>
    </div>
    <div className={styles.tip} aria-live="off"><span>기다리는 동안 알아두기</span><p>{TIPS[tip]}</p></div>
  </div>;
}
