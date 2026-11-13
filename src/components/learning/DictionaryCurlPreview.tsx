'use client';

import { useEffect, useRef, useState } from 'react';
import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FINANCIAL_TERMS } from '@/lib/financialTerms';
import { createPageCurl } from '@/lib/pageCurlRenderer';
import { DictionaryBookLeaf } from './DictionaryBookPreview';
import PersonalLearningProvider from './PersonalLearningProvider';
import theme from './DictionaryTheme.module.css';
import styles from './DictionaryCurlPreview.module.css';

function Reader() {
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState(1);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [slow, setSlow] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const operation = useRef(0);
  const locked = useRef(false);
  const frame = useRef(0);
  const renderer = useRef<ReturnType<typeof createPageCurl>>(null);
  const fontCSS = useRef<Promise<string> | null>(null);
  useEffect(() => () => { operation.current++; cancelAnimationFrame(frame.current); renderer.current?.dispose(); }, []);

  const turn = async (direction: number) => {
    const destination = current + direction;
    if (locked.current || destination < 0 || destination >= FINANCIAL_TERMS.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCurrent(destination); return; }
    locked.current = true; setBusy(true); setTarget(destination); setFallback(false);
    const token = ++operation.current;
    const finish = () => {
      if (token !== operation.current) return;
      setCurrent(destination); setDrawing(false); setBusy(false); locked.current = false;
      renderer.current?.dispose(); renderer.current = null;
    };
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (token !== operation.current || !page.current || !next.current || !canvas.current) return;
      fontCSS.current ??= getFontEmbedCSS(page.current);
      const options = { pixelRatio: Math.min(devicePixelRatio || 1, 2), fontEmbedCSS: await fontCSS.current };
      const [fromImage, toImage] = await Promise.all([toCanvas(page.current, options), toCanvas(next.current, options)]);
      if (token !== operation.current || !canvas.current) return;
      canvas.current.width = fromImage.width; canvas.current.height = fromImage.height;
      renderer.current = createPageCurl(canvas.current, fromImage, toImage, direction < 0);
      if (!renderer.current) { setFallback(true); finish(); return; }
      renderer.current.draw(0); setDrawing(true);
      const started = performance.now();
      const animate = (now: number) => {
        if (token !== operation.current) return;
        const elapsed = Math.min(1, (now - started) / (slow ? 3600 : 1050));
        renderer.current?.draw(elapsed * elapsed * (3 - 2 * elapsed));
        if (elapsed < 1) frame.current = requestAnimationFrame(animate);
        else finish();
      };
      frame.current = requestAnimationFrame(animate);
    } catch { if (token === operation.current) { setFallback(true); finish(); } }
  };

  return <main className={`${theme.theme} ${styles.screen}`}>
    <header className={styles.header}><h1>내 주식사전</h1><span>곡면 넘김 시안</span></header>
    <div className={styles.reader} aria-busy={busy}>
      <div className={styles.staging} ref={next} aria-hidden="true" inert><DictionaryBookLeaf term={FINANCIAL_TERMS[target]} number={target + 1} /></div>
      <div className={styles.paper} ref={page}><DictionaryBookLeaf term={FINANCIAL_TERMS[current]} number={current + 1} /></div>
      <canvas ref={canvas} className={styles.curl} style={{ opacity: drawing ? 1 : 0 }} aria-hidden="true" />
    </div>
    <nav className={styles.navigation} aria-label="책장 넘기기">
      <button className={theme.linkButton} disabled={busy || current === 0} onClick={() => void turn(-1)}><ChevronLeft size={18} />이전 장</button>
      <span aria-live="polite">{current + 1} / {FINANCIAL_TERMS.length}</span>
      <button className={theme.linkButton} disabled={busy || current === FINANCIAL_TERMS.length - 1} onClick={() => void turn(1)}>다음 장<ChevronRight size={18} /></button>
    </nav>
    <label className={styles.note}><input type="checkbox" checked={slow} disabled={busy} onChange={event => setSlow(event.target.checked)} /> 천천히 보기</label>
    <p className={styles.note}>{fallback ? '이 브라우저에서는 애니메이션 없이 페이지를 넘겼어요.' : '다음 장을 눌러 종이가 휘어지는 모습을 확인해 보세요.'}</p>
    <p className={styles.note}>동작 비교용 시안 · 손으로 끌어 넘기기는 아직 지원하지 않아요.</p>
  </main>;
}

export default function DictionaryCurlPreview() {
  return <PersonalLearningProvider owner="guest"><Reader /></PersonalLearningProvider>;
}
