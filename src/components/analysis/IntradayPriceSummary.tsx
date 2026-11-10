import type { IntradayCandles } from '@/lib/intradayCandles';
import { formatKrw, formatUsd } from '@/utils/koreanNumber';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './IntradayPriceSummary.module.css';

/** The range includes trades within each bar, while the basic line plots bar closes. */
export default function IntradayPriceSummary({ data, currency, level = 'basic' }: { data: IntradayCandles; currency: 'KRW' | 'USD'; level?: 'basic' | 'detail' }) {
  if (!data.l.length || data.l.length !== data.h.length || ![...data.l, ...data.h].every(value => Number.isFinite(value) && value > 0)) return null;
  const low = Math.min(...data.l), high = Math.max(...data.h);
  if (low > high) return null;
  const close = data.c.at(-1);
  const last = close !== undefined && Number.isFinite(close) && close > 0 && close >= low && close <= high ? close : null;
  const position = last === null ? null : high === low ? 50 : (last - low) / (high - low) * 100;
  const measurable = last !== null && high > low;
  const money = (value: number) => currency === 'KRW' ? formatKrw(value, { prefix: false, suffix: '원', short: false }) : formatUsd(value);
  return <section className={styles.range} aria-label="차트 자료의 최저·최고 가격">
    <p className={styles.label}>장중 가격 범위</p>
    {last !== null && <div className={styles.lastPrice}>
      <div><p className={styles.lastLabel}><span aria-hidden="true" />마지막 가격</p><strong>{money(last)}</strong></div>
      <p className={styles.positionNote}>{high === low ? '받은 자료에서는 가격이 같았어요.' : last === low ? '받은 자료의 최저 가격이에요.' : last === high ? '받은 자료의 최고 가격이에요.' : money(last - low) === money(0) ? '최저 가격 근처에 있어요.' : money(high - last) === money(0) ? '최고 가격 근처에 있어요.' : <>최저보다 <span>{money(last - low)}</span> 높아요.</>}</p>
    </div>}
    <div className={styles.track} role={measurable ? 'meter' : undefined} aria-hidden={measurable ? undefined : true}
      aria-label={measurable ? '장중 가격 범위에서 마지막 가격의 위치' : undefined}
      aria-valuemin={measurable ? low : undefined} aria-valuemax={measurable ? high : undefined} aria-valuenow={measurable ? last : undefined}
      aria-valuetext={measurable ? money(last!) : undefined}>
      {position !== null && <>
        {high > low && <span className={styles.fill} style={{ width: `${position}%` }} />}
        <span className={styles.marker} style={{ left: `${position}%` }} />
      </>}
    </div>
    <dl className={styles.values}>
      <div><dt>최저</dt><dd>{money(low)}</dd></div>
      <div><dt>최고</dt><dd>{money(high)}</dd></div>
    </dl>
    <details className={styles.explanation}>
      <summary className={readingUI.disclosure}>{level === 'basic' ? '차트의 선과 가격 범위가 다른 이유' : '가격 범위는 어디까지 포함하나요?'}</summary>
      <p>{level === 'basic' ? '선은 5분마다 마지막으로 거래된 가격을 이은 거예요. 그 사이에 더 낮거나 높은 가격으로 거래되기도 해요. 위 범위에는 그 가격도 포함했어요.' : '차트 자료가 있는 구간에서 가장 낮게 거래된 가격과 가장 높게 거래된 가격이에요.'}</p>
      <p>받아온 정규장 자료가 기준이에요. 아직 받지 못한 거래와 장전·장후 거래는 포함하지 않아요.</p>
    </details>
  </section>;
}
