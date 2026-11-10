'use client';
import { useRef, useState } from 'react';
import { getUsClockChangeNotice } from '@/utils/usClockChange';
import { useNoticeAcknowledgement } from '@/hooks/useNoticeAcknowledgement';
import { acknowledgeNotice } from '@/lib/noticeAcknowledgement';
import { US_CALENDAR_SOURCE } from '@/config/usTradingCalendar';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './UsMarketClockNotice.module.css';
import JoobiAvatar from '@/components/learning/JoobiAvatar';

export default function UsMarketClockNotice({ now, compact = false, home = false }: { now: number; compact?: boolean; home?: boolean }) {
  const notice = now ? getUsClockChangeNotice(new Date(now)) : null;
  const acknowledged = useNoticeAcknowledgement(notice?.id);
  const summary = useRef<HTMLElement>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  if (!notice) return null;
  const content = <section className={styles.notice} aria-label="미국 주식 거래 시간 변경 안내" data-us-clock-change={notice.id}>
    {!home && <div className={styles.heading}><JoobiAvatar size={48} /><div><span className={styles.byline}>주비가 챙겨드려요</span><h3>{notice.title}</h3></div></div>}
    <p>{notice.message}</p><p className={styles.hours}>{notice.hours}</p>
    <details>
      <summary className={readingUI.disclosure}>왜 시간이 바뀌나요?</summary>
      <p>{notice.explanation}</p>
      <p>미국 정규장 기준이에요. 휴장일과 일찍 끝나는 날, 증권사별 시간외 거래는 따로 확인해 주세요.</p>
      <div className={styles.sources}>
        <a href={US_CALENDAR_SOURCE} target="_blank" rel="noopener noreferrer">뉴욕증권거래소 거래 일정 (새 창)</a>
        <a href="https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst" target="_blank" rel="noopener noreferrer">미국 표준기술연구소 서머타임 안내 (새 창)</a>
      </div>
    </details>
    {!acknowledged && <div className={styles.confirm}><button type="button" onClick={() => {
      const saved = acknowledgeNotice(notice.id); setSaveFailed(!saved);
      if (saved) requestAnimationFrame(() => summary.current?.focus());
    }}>확인했어요</button><span>확인한 안내는 이 브라우저에서 접어둘게요.</span></div>}
    {saveFailed && <p role="alert">확인 여부를 저장하지 못했어요. 이 안내가 다시 보일 수 있어요.</p>}
  </section>;
  return compact || home || acknowledged ? <details key={`${notice.id}:${acknowledged}`} className={`${styles.compact}${home ? ` ${styles.home}` : ''}`}>
    <summary ref={summary} className={readingUI.disclosure}>
      {home && !acknowledged && <JoobiAvatar size={32} />}
      <span className={styles.summaryLabel}>{acknowledged ? '거래시간 안내 다시 보기' : home ? notice.title : '미국장 거래시간 변경 안내'}</span>
      {acknowledged && <small>확인한 안내</small>}
    </summary>{content}
  </details> : content;
}
