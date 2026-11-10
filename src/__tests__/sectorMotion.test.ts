import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SECTOR_ARTWORK, industryArtwork } from '@/lib/sectorArtwork';
import { INDUSTRY_GROUPS } from '@/lib/industryRegistry';

describe('short illustration motion for the complete catalog', () => {
  it('uses an embedded assembly scene with separate arm and door motion for automotive', () => {
    const art = SECTOR_ARTWORK.automotive;
    for (const path of [art.motionScene, art.motionSceneDark]) {
      expect(path).toBeTruthy();
      const svg = readFileSync(`${process.cwd()}/public${path}`, 'utf8');
      expect(svg).toContain('class="upper"');
      expect(svg).toContain('class="door"');
      expect(svg).toContain('animation-duration:2.6s');
      expect(svg).toContain('animation-iteration-count:1');
      expect(svg).toContain('animation-fill-mode:both');
      expect(svg).toContain('@media(prefers-reduced-motion:reduce)');
      expect(svg).toContain('data:image/webp;base64,');
      expect(svg).not.toMatch(/infinite|<script|<foreignObject|href="https?:/);
    }
  });
  it('connects all four process illustrations to self-contained motion scenes', () => {
    for (const id of ['food', 'materials', 'cables', 'tobacco']) {
      const art = SECTOR_ARTWORK[id];
      expect(art.image).toContain(`${id}-v3-light.png`);
      for (const path of [art.motionScene, art.motionSceneDark]) {
        expect(path).toContain('-process.svg');
        const svg = readFileSync(`${process.cwd()}/public${path}`, 'utf8');
        expect(svg).toContain('class="moving"');
        expect(svg).toContain('data:image/webp;base64,');
        expect(svg).toContain('animation-fill-mode:both');
        expect(svg).not.toMatch(/href="https?:|<script|<foreignObject/);
      }
    }
  });
  it('gives every raster original a finite, reduced-motion-safe motion asset in both themes', () => {
    const originals = Object.values(SECTOR_ARTWORK).filter(art => art.image);
    expect(originals).toHaveLength(10);
    for (const art of originals) for (const path of [art.motionScene ?? art.motionOverlay, art.motionSceneDark ?? art.motionOverlayDark]) {
      expect(path).toBeTruthy();
      const motion = readFileSync(`${process.cwd()}/public${path}`, 'utf8');
      expect(motion).toContain('viewBox="0 0 1536 1024"');
      expect(motion).toContain('animation-duration:2.6s');
      expect(motion).toContain('animation-iteration-count:1');
      expect(motion).toContain('@media(prefers-reduced-motion:reduce)');
      expect(motion).not.toMatch(/infinite|<script|<foreignObject|\bNaN\b/);
    }
  });
  it('ships both animated themes for all 97 scenes, preserving every geometric path', () => {
    expect(Object.keys(SECTOR_ARTWORK)).toHaveLength(97);
    for (const id of Object.keys(SECTOR_ARTWORK)) for (const theme of ['light', 'dark']) {
      const prefix = `${process.cwd()}/public/illustrations/sectors/${id}-${theme}`;
      const still = readFileSync(`${prefix}.svg`, 'utf8');
      const motion = readFileSync(`${prefix}-motion.svg`, 'utf8');
      expect(motion.match(/<path\b[^>]*>/g), `${id}-${theme}`).toEqual(still.match(/<path\b[^>]*>/g));
      expect(motion).toContain('class="art-part"');
      expect(motion).not.toContain('class="art-part" data-art-part="base.');
      expect(motion).toContain('@media(prefers-reduced-motion:reduce)');
      expect(motion).toContain('animation:none!important');
      expect(motion).not.toMatch(/infinite|<script|<foreignObject|(?:href|src)=["']https?:|\bNaN\b/);
      const delays = [...motion.matchAll(/--part-delay:([\d.]+)s/g)].map(match => Number(match[1]));
      expect(Math.max(...delays) + .8 + 1.2).toBeLessThanOrEqual(2.60001);
      expect(Math.max(...delays) + .8 + 1.2).toBeGreaterThanOrEqual(2);
    }
  });
  it('resolves all 303 industry classifications to an animated scene', () => {
    expect(INDUSTRY_GROUPS).toHaveLength(303);
    for (const industry of INDUSTRY_GROUPS) {
      const art = industryArtwork(industry.id)!;
      expect(readFileSync(`${process.cwd()}/public/illustrations/sectors/${art.id}-light-motion.svg`, 'utf8')).toContain('class="art-part"');
    }
  });
});
