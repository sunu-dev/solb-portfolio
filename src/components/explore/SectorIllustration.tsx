'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { SectorId } from '@/lib/sectorExploration';
import { industryArtwork, sectorArtwork, SECTOR_ARTWORK, type SectorArtwork } from '@/lib/sectorArtwork';
import styles from './SectorIllustration.module.css';

export const SECTOR_ILLUSTRATION_CAPTIONS = Object.fromEntries(Object.entries(SECTOR_ARTWORK).map(([id, art]) => [id, art.caption])) as Record<SectorId, string>;
export const hasSectorIllustration = (sector: SectorId) => !!sectorArtwork(sector);

export function SectorArtworkView({ id, art, industryId }: { id: string; art: SectorArtwork; industryId?: string }) {
  const figure = useRef<HTMLElement>(null);
  const canAnimate = !!art.motionScene;
  const instance = useId();
  const [run, setRun] = useState(0);
  const [reduced, setReduced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [settledRun, setSettledRun] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canAnimate) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setReduced(preference.matches); if (preference.matches) setPlaying(false); };
    sync();
    preference.addEventListener('change', sync);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !preference.matches) {
        setRun(1);
        observer.disconnect();
      }
    }, { threshold: .35 });
    if (figure.current) observer.observe(figure.current);
    return () => { observer.disconnect(); preference.removeEventListener('change', sync); };
  }, [canAnimate]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => { setSettledRun(run); setPlaying(false); }, 2600);
    return () => clearTimeout(timer);
  }, [playing, run]);
  const animated = run > settledRun && !reduced && !failed;
  const assembly = !!art.motionScene && run > 0 && !reduced && !failed;
  const source = (theme: string) => `/illustrations/sectors/${id}-${theme}${animated ? `-motion.svg?play=${encodeURIComponent(instance)}-${run}` : '.svg'}`;
  return <figure ref={figure} className={styles.figure} data-sector-illustration={id} data-industry-illustration={industryId}
    data-motion={reduced || failed || !run ? 'static' : animated ? 'playing' : 'finished'}>
    <div className={`${styles.image} ${art.image && !failed ? styles.original : ''}`}>
      {art.image && !failed ? (['light', 'dark'] as const).map(theme => <Image key={`original-${theme}-${art.motionScene ? 'assembly' : animated}-${run}`} className={styles[theme]}
        src={assembly ? `${theme === 'dark' ? art.motionSceneDark ?? art.motionScene : art.motionScene}?play=${encodeURIComponent(instance)}-${run}` : theme === 'dark' ? art.imageDark ?? art.image! : art.image!} alt={art.alt} width={1536} height={1024} sizes="(max-width: 480px) 90vw, 380px" unoptimized={assembly}
        onLoad={event => { if (animated && event.currentTarget.getClientRects().length) setPlaying(true); }} onError={() => { setFailed(true); setPlaying(false); }} />) : (['light', 'dark'] as const).map(theme => <Image key={`${theme}-${animated}-${run}`} className={styles[theme]} src={source(theme)} alt={art.alt} width={600} height={400} unoptimized
        onLoad={event => { if (animated && event.currentTarget.getClientRects().length) setPlaying(true); }} onError={() => { setFailed(true); setPlaying(false); }} />)}
      {art.image && !art.motionScene && art.motionOverlay && animated && playing ? (['light', 'dark'] as const).map(theme => <Image
        key={`activity-${theme}-${run}`} className={`${styles.activity} ${styles[theme]}`}
        src={`${theme === 'dark' ? art.motionOverlayDark ?? art.motionOverlay : art.motionOverlay}?play=${encodeURIComponent(instance)}-${run}`}
        alt="" aria-hidden="true" width={1536} height={1024} unoptimized />) : null}
    </div>
    <figcaption className={styles.captionArea}>
      <p className={styles.caption}>{art.caption}</p>
      {canAnimate && <button type="button" className={styles.replay} aria-label={`${art.title} 그림 다시 재생`} disabled={reduced || failed || animated}
        onClick={() => { setPlaying(false); setRun(value => value + 1); }}>
        <RotateCcw size={13} aria-hidden="true" /> {animated ? playing ? '재생 중' : '불러오는 중' : '다시 보기'}
      </button>}
    </figcaption>
  </figure>;
}

export function IndustryIllustration({ industryId }: { industryId: string }) {
  const match = industryArtwork(industryId);
  if (!match) return <p className={styles.unavailable}>이 업종의 그림을 준비하고 있어요.</p>;
  return <SectorArtworkView key={match.id} id={match.id} art={match.artwork} industryId={industryId} />;
}

export default function SectorIllustration({ sector }: { sector: SectorId }) {
  const art = sectorArtwork(sector);
  if (!art) return <p className={styles.unavailable}>이 산업의 그림을 준비하고 있어요.</p>;
  return <SectorArtworkView key={sector} id={sector} art={art} />;
}
