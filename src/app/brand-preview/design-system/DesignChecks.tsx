'use client';

import { useEffect, useRef, useState } from 'react';
import { reviewChecklist } from './designReference';
import styles from './guidelines.module.css';

const pairs = [
  {id:'body',label:'본문 / 기본 바탕',fg:'--text-primary',bg:'--surface'},
  {id:'caption',label:'보조 설명 / 기본 바탕',fg:'--text-secondary',bg:'--surface'},
  {id:'warm',label:'질문 / 크림',fg:'--text-primary',bg:'--surface-warm'},
  {id:'accent',label:'주요 동작 / 옐로',fg:'--text-on-highlight',bg:'--brand-highlight'},
  {id:'report',label:'리포트 / 차콜',fg:'--text-on-feature',bg:'--surface-feature'},
  {id:'gain',label:'상승 수치 / 기본 바탕',fg:'--color-gain',bg:'--surface'},
  {id:'loss',label:'하락 수치 / 기본 바탕',fg:'--color-loss',bg:'--surface'},
] as const;
function luminance(color: string): number | null {
  const parts = color.match(/^rgba?\(([^)]+)\)$/)?.[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (!parts || parts.length < 3 || parts.some(Number.isNaN) || (parts.length > 3 && parts[3] !== 1)) return null;
  const [r,g,b] = parts.slice(0,3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
  return .2126*r + .7152*g + .0722*b;
}

export default function DesignChecks() {
  const root = useRef<HTMLDivElement>(null);
  const [ratios, setRatios] = useState<Record<string,number|null>>({});
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    const measure = () => {
      const values: Record<string,number|null> = {};
      root.current?.querySelectorAll<HTMLElement>('[data-contrast-pair]').forEach(element => {
        const computed = getComputedStyle(element);
        const foreground = luminance(computed.color), background = luminance(computed.backgroundColor);
        values[element.dataset.contrastPair!] = foreground === null || background === null ? null : (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
      });
      setRatios(values);
    };
    let frame = requestAnimationFrame(measure);
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    return () => {observer.disconnect();cancelAnimationFrame(frame);};
  }, []);
  return <div ref={root}>
    <h3 className={styles.subheading}>지금 테마의 글자 대비</h3>
    <p className={styles.support}>서비스 CSS의 실제 색 조합을 읽어 계산해요. 일반 본문의 4.5:1 기준과 비교하며, 큰 수치·장식·비활성 동작의 판정과 전체 화면 검수는 별도예요.</p>
    <div className={styles.contrasts}>{pairs.map(pair => {
      const ratio = ratios[pair.id];
      return <article key={pair.id}><div data-contrast-pair={pair.id} className={styles.colorPair} style={{color:`var(${pair.fg})`,backgroundColor:`var(${pair.bg})`}}>가나다 123</div><div><h4>{pair.label}</h4><code>{pair.fg} / {pair.bg}</code></div><span className={styles.contrastResult} data-review={typeof ratio === 'number' && ratio < 4.5}>{typeof ratio === 'number' ? `${ratio.toFixed(2)} : 1` : '확인 중'}<small>{typeof ratio === 'number' ? ratio >= 4.5 ? '본문 기준 충족' : '작은 글자 사용 재검토' : '색 확인 필요'}</small></span></article>;
    })}</div>
    <p className={styles.support}>상승·하락 색은 +·−와 문구를 함께 써요. 작은 글자에서 대비가 부족한 조합은 본문색·크기·별도 글자색을 검토해요. <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html" target="_blank" rel="noopener noreferrer">W3C 글자 대비 기준</a></p>
    <div className={styles.checkHeading}><h3 className={styles.subheading}>화면을 바꾼 뒤, 놓치지 않도록</h3><span>{checked.length} / {reviewChecklist.length} 확인</span></div>
    <p className={styles.support}>직접 확인한 항목만 체크해요. 이 탭에서만 유지되는 작업용 목록이며 서비스 전체의 검수 완료율은 아니에요.</p>
    <fieldset className={styles.checklist}><legend className={styles.srOnly}>화면 변경 점검표</legend>{reviewChecklist.map(item => <label key={item.id}><input type="checkbox" checked={checked.includes(item.id)} onChange={event => setChecked(previous => event.target.checked ? [...previous,item.id] : previous.filter(id=>id!==item.id))} /><span><small>{item.group}</small><strong>{item.title}</strong><span>{item.detail}</span></span></label>)}</fieldset>
  </div>;
}
