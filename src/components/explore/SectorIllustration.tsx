import Image from 'next/image';
import type { SectorId } from '@/lib/sectorExploration';
import { industryArtwork, sectorArtwork, SECTOR_ARTWORK, type SectorArtwork } from '@/lib/sectorArtwork';
import styles from './SectorIllustration.module.css';

export const SECTOR_ILLUSTRATION_CAPTIONS = Object.fromEntries(Object.entries(SECTOR_ARTWORK).map(([id, art]) => [id, art.caption])) as Record<SectorId, string>;
export const hasSectorIllustration = (sector: SectorId) => !!sectorArtwork(sector);

function Artwork({ id, art, industryId }: { id: string; art: SectorArtwork; industryId?: string }) {
  return <figure className={styles.figure} data-sector-illustration={id} data-industry-illustration={industryId}>
    <div className={styles.image}>
      <Image className={styles.light} src={`/illustrations/sectors/${id}-light.svg`} alt={art.alt} width={600} height={400} unoptimized />
      <Image className={styles.dark} src={`/illustrations/sectors/${id}-dark.svg`} alt={art.alt} width={600} height={400} unoptimized />
    </div>
    <figcaption>
      <p className={styles.caption}>{art.caption}</p>
      <details className={styles.explanation}>
        <summary>그림에서 무엇을 보나요?</summary>
        <ul>{art.parts.map(part => <li key={part}>{part}</li>)}</ul>
        <p>{art.note}</p>
      </details>
    </figcaption>
  </figure>;
}

export function IndustryIllustration({ industryId }: { industryId: string }) {
  const match = industryArtwork(industryId);
  if (!match) return <p className={styles.unavailable}>이 업종의 그림을 준비하고 있어요.</p>;
  return <Artwork id={match.id} art={match.artwork} industryId={industryId} />;
}

export default function SectorIllustration({ sector }: { sector: SectorId }) {
  const art = sectorArtwork(sector);
  if (!art) return <p className={styles.unavailable}>이 산업의 그림을 준비하고 있어요.</p>;
  return <Artwork id={sector} art={art} />;
}
