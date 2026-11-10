import manifest from '@/data/sector-illustrations.json';
import originals from '@/data/sector-originals.json';
import type { SectorId } from './sectorExploration';

export interface SectorArtwork {
  title: string; caption: string; parts: string[]; note: string; alt: string; partCount: number; geometryHash: string;
  image?: string;
  imageDark?: string;
  motionOverlay?: string;
  motionOverlayDark?: string;
  motionScene?: string;
  motionSceneDark?: string;
}
export const SECTOR_ARTWORK = Object.fromEntries(Object.entries(manifest.scenes).map(([id, scene]) => {
  const original = (originals as Record<string, { parts: string[]; caption: string; version?: string; motion?: string }>)[id];
  const version = original?.version ?? 'v2';
  return [id, original ? { ...scene, ...original, image: `/illustrations/sectors/originals/${id}-${version}-light.png`, imageDark: `/illustrations/sectors/originals/${id}-${version}-dark.png`,
    motionOverlay: `/illustrations/sectors/originals/${id}-${version}-light-motion.svg`, motionOverlayDark: `/illustrations/sectors/originals/${id}-${version}-dark-motion.svg`,
    ...(original.motion ? { motionScene: `/illustrations/sectors/originals/${id}-${version}-light-${original.motion}.svg`, motionSceneDark: `/illustrations/sectors/originals/${id}-${version}-dark-${original.motion}.svg` } : {}),
    alt: `${scene.title}: ${original.parts.join('·')}을 보여주는 입체 원화.`,
    note: '업종을 설명하기 위한 대표 장면이며, 특정 기업의 실제 제품이나 설비는 아니에요.' } : scene];
})) as Record<string, SectorArtwork>;
const industryScenes = manifest.industries as Record<string, { raw: string; scene: string }>;
export const sectorArtwork = (sector: SectorId) => SECTOR_ARTWORK[sector];
// No parent fallback: a new classification must receive an explicit reviewed mapping.
export const industryArtwork = (industryId: string) => {
  const id = industryScenes[industryId]?.scene;
  return id && SECTOR_ARTWORK[id] ? { id, artwork: SECTOR_ARTWORK[id] } : undefined;
};
