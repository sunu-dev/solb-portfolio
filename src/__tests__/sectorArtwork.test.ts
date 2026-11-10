import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { SECTORS } from '@/lib/sectorExploration';
import { INDUSTRY_GROUPS } from '@/lib/industryRegistry';
import { industryArtwork, sectorArtwork, SECTOR_ARTWORK } from '@/lib/sectorArtwork';
import manifest from '@/data/sector-illustrations.json';
import originals from '@/data/sector-originals.json';

describe('complete sector artwork coverage', () => {
  it('routes selected industries to distinct saved PNG originals with matching descriptions', () => {
    const images = new Set<string>();
    for (const [id, original] of Object.entries(originals)) {
      expect(manifest.scenes).toHaveProperty(id);
      const art = SECTOR_ARTWORK[id];
      expect(art.parts).toEqual(original.parts);
      expect(art.caption).toBe(original.caption);
      const bytes = readFileSync(`${process.cwd()}/public${art.image}`);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const dark = readFileSync(`${process.cwd()}/public${art.imageDark}`);
      expect(dark.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(dark.equals(bytes)).toBe(false);
      images.add(art.image!);
    }
    expect(images.size).toBe(Object.keys(originals).length);
  });
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
  it('does not reuse complete geometry across any of the 97 scenes', () => {
    const scenes = Object.values(SECTOR_ARTWORK);
    expect(scenes).toHaveLength(97);
    expect(new Set(scenes.map(scene => scene.geometryHash)).size).toBe(scenes.length);
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
  it('ships every selected original image and animation with meaningful alternative text', () => {
    for (const [id, art] of Object.entries(SECTOR_ARTWORK)) {
      expect(art.alt.trim().length, id).toBeGreaterThan(10);
      for (const asset of [art.image, art.imageDark, art.motionScene, art.motionSceneDark].filter(Boolean) as string[]) {
        const file = `${process.cwd()}/public${asset}`;
        expect(existsSync(file), file).toBe(true);
        const contents = readFileSync(file);
        if (asset.endsWith('.png')) {
          expect(contents.subarray(0, 8).toString('hex'), file).toBe('89504e470d0a1a0a');
        } else {
          expect(contents.toString(), file).toContain('<svg');
          expect(contents.toString(), file).not.toMatch(/<script|<foreignObject|(?:href|src)=["']https?:/i);
        }
      }
    }
  });
  it('ships accessible self contained SVGs in both themes with no runtime scripts or remote resources', () => {
    for (const [id, scene] of Object.entries(SECTOR_ARTWORK)) {
      // Part count is not a quality target: do not add decorative filler to pass a test.
      expect(scene.partCount, id).toBeGreaterThan(1);
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
