'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import styles from './StockAnswerLoading.module.css';

interface StockAnswerLoadingProps {
  onCancel: () => void;
}

export default function StockAnswerLoading({ onCancel }: StockAnswerLoadingProps) {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayed(true), 20_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.loading} data-stock-answer-loading>
      <div className={styles.message} role="status" aria-live="polite" aria-atomic="true">
        <div className={styles.heading}>
          <span className={styles.spinner} data-loading-spinner aria-hidden="true">
            <LoaderCircle size={20} strokeWidth={1.8} />
          </span>
          <span>주비가 답변을 준비하고 있어요</span>
        </div>
        <p className={styles.description}>
          {delayed
            ? '답변이 평소보다 늦어지고 있어요. 기다리거나 요청을 취소할 수 있어요.'
            : '답변이 도착하면 여기에 보여드릴게요.'}
        </p>
      </div>

      <div className={styles.placeholders} aria-hidden="true">
        <span className={styles.placeholder} data-loading-placeholder />
        <span className={styles.placeholder} data-loading-placeholder />
        <span className={styles.placeholder} data-loading-placeholder />
      </div>

      <button type="button" className={styles.cancel} onClick={onCancel}>
        요청 취소
      </button>
    </div>
  );
}
