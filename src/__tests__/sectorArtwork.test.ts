import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { SECTORS } from '@/lib/sectorExploration';
import { INDUSTRY_GROUPS } from '@/lib/industryRegistry';
import { industryArtwork, sectorArtwork, SECTOR_ARTWORK } from '@/lib/sectorArtwork';
import manifest from '@/data/sector-illustrations.json';

describe('complete sector artwork coverage', () => {
  it('covers every registered sector and every source industry explicitly', () => {
    expect(manifest.sectors.toSorted()).toEqual(SECTORS.map(s => s.id).toSorted());
    expect(new Set(SECTORS.map(s => sectorArtwork(s.id)?.geometryHash)).size).toBe(SECTORS.length);
    expect(Object.keys(manifest.industries).toSorted()).toEqual(INDUSTRY_GROUPS.map(g => g.id).toSorted());
    for (const sector of SECTORS) expect(sectorArtwork(sector.id)?.caption, sector.id).toBeTruthy();
    const mappings = manifest.industries as Record<string, { raw: string; scene: string }>;
    for (const industry of INDUSTRY_GROUPS) {
      expect(mappings[industry.id].raw, industry.id).toBe(industry.raw);
      expect(industryArtwork(industry.id)?.artwork.alt, industry.name).toBeTruthy();
    }
    expect(industryArtwork('unknown-industry')).toBeUndefined();
  });
  it('keeps different business roles and misleading legacy mappings separate', () => {
    for (const ids of [['quantum', 'post-quantum-security'], ['advanced-nuclear', 'nuclear-fuel', 'nuclear-generation'], ['fuel-cells', 'batteries'], ['semiconductors', 'equipment']]) {
      expect(new Set(ids.map(id => SECTOR_ARTWORK[id].alt)).size).toBe(ids.length);
    }
    for (const [raw, scene] of [['Marine Shipping', 'shipping'], ['REIT - Industrial', 'reit-industrial'], ['REIT - Mortgage', 'mortgage-finance'], ['Security & Protection Services', 'physical-security'], ['무기 및 총포탄 제조업', 'defense']]) {
      const group = INDUSTRY_GROUPS.find(g => g.raw === raw)!;
      expect(industryArtwork(group.id)?.id, raw).toBe(scene);
    }
  });
  it('ships accessible self contained SVGs in both themes with no runtime scripts or remote resources', () => {
    for (const [id, scene] of Object.entries(SECTOR_ARTWORK)) {
      expect(scene.partCount, id).toBeGreaterThanOrEqual(40);
      expect(scene.parts.length).toBeGreaterThanOrEqual(3);
      expect(scene.note.length).toBeGreaterThan(10);
      for (const theme of ['light', 'dark']) {
        const file = `${process.cwd()}/public/illustrations/sectors/${id}-${theme}.svg`;
        expect(existsSync(file), file).toBe(true);
        const svg = readFileSync(file, 'utf8');
        expect(svg.match(/xmlns=/g)?.length, file).toBe(1);
        expect(svg).toContain('viewBox="0 0 600 400"');
        expect(svg).toContain('role="img"');
        expect(svg).not.toMatch(/<script|<foreignObject|(?:href|src)=["']https?:|\bNaN\b|\bInfinity\b/i);
      }
    }
  });
});
