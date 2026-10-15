import manifest from '@/data/sector-illustrations.json';
import type { SectorId } from './sectorExploration';

export interface SectorArtwork {
  title: string; caption: string; parts: string[]; note: string; alt: string; partCount: number; geometryHash: string;
}
export const SECTOR_ARTWORK = manifest.scenes as Record<string, SectorArtwork>;
const industryScenes = manifest.industries as Record<string, { raw: string; scene: string }>;
export const sectorArtwork = (sector: SectorId) => SECTOR_ARTWORK[sector];
// No parent fallback: a new classification must receive an explicit reviewed mapping.
export const industryArtwork = (industryId: string) => {
  const id = industryScenes[industryId]?.scene;
  return id && SECTOR_ARTWORK[id] ? { id, artwork: SECTOR_ARTWORK[id] } : undefined;
};
