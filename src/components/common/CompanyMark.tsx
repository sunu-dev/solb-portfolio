'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import styles from './CompanyMark.module.css';

const MARKS: Record<string, string> = {
  '005930.KS': 'samsung', NVDA: 'nvidia', AAPL: 'apple', MSFT: 'microsoft', TSLA: 'tesla',
};

/** Local brand assets; no third-party image requests or user data are sent. */
export default function CompanyMark({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const mark = MARKS[symbol];
  return <span className={styles.mark} aria-hidden="true">
    {mark && !failed ? <Image src={`/logos/companies/${mark}.svg`} alt="" width={28} height={28}
      className={mark === 'samsung' ? styles.wordmark : styles.image} onError={() => setFailed(true)} />
      : <Building2 size={22} />}
  </span>;
}
