import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as k from './vendor/anatomy/iso-kit.mjs';
import * as A from './vendor/anatomy/audit.mjs';
import * as G from './vendor/anatomy/lathe.mjs';
import { Scene } from './sector-art/objects.mjs';
import { SCENES, CORE_SCENE_IDS } from './sector-art/scenes.mjs';

const ROOT = new URL('../', import.meta.url);
const rootFile = path => new URL(path, ROOT);
const out = rootFile('public/illustrations/sectors/');
const evidence = rootFile('artifacts/anatomy-sectors-20261015/');
mkdirSync(out, { recursive: true }); mkdirSync(evidence, { recursive: true });
const only = process.argv.find(x => x.startsWith('--only='))?.slice(7).split(',');
const registry = JSON.parse(readFileSync(rootFile('src/data/industry-registry.json')));
const mapping = JSON.parse(readFileSync(rootFile('scripts/sector-art/catalog.json')));
const ids = new Set(SCENES.map(scene => scene.id));
if (ids.size !== SCENES.length) throw new Error('Duplicate scene ID');
if (only?.some(id => !ids.has(id))) throw new Error('Unknown --only scene');
for (const group of registry.industries) if (!ids.has(mapping[group.id]?.scene) || mapping[group.id].raw !== group.raw) throw new Error(`Missing or stale industry illustration: ${group.id} ${group.raw}`);
for (const id of Object.keys(mapping)) if (!registry.industries.some(group => group.id === id)) throw new Error(`Removed industry: ${id}`);

const palette = {
  light: { paper: '#fafaf9', top: '#ffffff', 'shade-0': '#c9cbd2', 'shade-1': '#d8dae1', 'shade-2': '#e3e5ea', 'shade-3': '#eef0f4', face: '#e5dff9', 'lit-top': '#f2edff', 'lit-shade': '#cfc4ee', hi: '#45434f', mid: '#74717f', lo: '#97939f', faint: '#bcb8c6', lit: '#756098', dot: '#55515e', halo: '#888398', 'halo-opacity': '.12', 'art-rubber': '#45434b', 'art-glass': '#6c7184', 'art-solar': '#686480', weight: '.85px' },
  dark: { paper: '#19191d', top: '#35343e', 'shade-0': '#1d1d24', 'shade-1': '#23232b', 'shade-2': '#2b2a33', 'shade-3': '#302f39', face: '#5b4b78', 'lit-top': '#776393', 'lit-shade': '#514364', hi: '#c4bfce', mid: '#8b8499', lo: '#625b72', faint: '#39343f', lit: '#cfb9f0', dot: '#d0c7dd', halo: '#060609', 'halo-opacity': '.3', 'art-rubber': '#17171e', 'art-glass': '#555c74', 'art-solar': '#494560', weight: '.65px' },
};
const css = readFileSync(rootFile('scripts/vendor/anatomy/iso.css'), 'utf8').split('@keyframes')[0];
const manifest = { version: 1, generator: 'Anatomy', sectors: CORE_SCENE_IDS, scenes: {}, industries: mapping };
const audits = [];
for (const definition of SCENES) {
  const s = new Scene(); s.base(); s.subject = definition.id; definition.draw(s);
  if (s.parts.length < 40) throw new Error(`${definition.id}: fewer than 40 purposeful parts`);
  const shapeOf = p => {
    const meta = { name: p.name };
    if (p.kind === 'box') return A.slab(p.plan, p.z, p.h, meta, 5);
    if (p.kind === 'round') return A.cylinder(p.x, p.y, p.r, p.z, p.h, meta);
    if (p.kind === 'cone') return A.solid(G.frameAlong([p.x, p.y, p.z], [0, 0, 1]), [[0, p.r], [p.h, 0]], meta);
    if (p.kind === 'turned') return (p.hollow ? A.lathe : A.solid)(G.frameAlong(p.origin, p.axis), p.profile, meta);
    if (p.kind === 'prism') return A.prism(p.frame, p.ring, p.from, p.to, meta);
    return A.extruded(p.ring, p.z, p.h, meta);
  };
  const shapes = s.parts.map(shapeOf);
  const extrema = shapes.flatMap(shape => { const b = A.boundsOf(shape); return k.boxCorners({ x: b.min[0], y: b.min[1], w: b.max[0] - b.min[0], d: b.max[1] - b.min[1] }, b.min[2], b.max[2]); });
  const P = k.fitProjection(extrema, 600, 400, { pad: 36, azimuth: 42, elevation: 32 });
  const R = A.recorder(P, { ground: shape => shape.name.startsWith('base.round.') && A.boundsOf(shape).min[2] === -11 });
  for (const [index, p] of s.parts.entries()) {
    const shape = shapes[index];
    const paths = p.kind === 'box' ? k.slabOf(p.plan, p.z, p.h, P, 5, Math.min(.6, p.h / 3))
      : p.kind === 'round' ? k.cylinder(p.x, p.y, p.r, p.z, p.h, P, 36, Math.min(.5, p.h / 3))
      : p.kind === 'cone' ? G.solidOf([[0, p.r], [p.h, 0]], G.frameAlong([p.x, p.y, p.z], [0, 0, 1]), P)
      : p.kind === 'turned' ? (p.hollow ? G.lathe : G.solidOf)(p.profile, G.frameAlong(p.origin, p.axis), P)
      : p.kind === 'prism' ? G.prismOf(p.frame, p.ring, p.from, p.to, P)
      : k.extrude(p.ring, p.z, p.h, P, { convex: false, bevel: .4 });
    const b = A.boundsOf(shape);
    const at = b.min.map((n, i) => (n + b.max[i]) / 2);
    const svg = k.solidSvg(paths, { tone: p.tone, lit: p.lit, crease: 'faint' });
    const material = p.material ? `--anatomy-top:var(--art-${p.material});--anatomy-paper:var(--art-${p.material});${[0,1,2,3].map(i => `--anatomy-shade-${i}:var(--art-${p.material})`).join(';')}` : '';
    R.solid(shape);
    R.put({ name: p.name, at, svg: material ? `<g style="${material}">${svg}</g>` : svg, shapes: [shape] });
  }
  const geometryHash = createHash('sha256').update(JSON.stringify(s.parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== 'name'))))).digest('hex');
  const metadata = { title: definition.title, caption: definition.caption, parts: definition.parts, note: definition.note, alt: `${definition.title}: ${definition.parts.join('·')}을 보여주는 입체 그림. ${definition.caption}`, partCount: s.parts.length, geometryHash };
  manifest.scenes[definition.id] = metadata;
  if (only && !only.includes(definition.id)) continue;
  console.log(`${new Date().toISOString()} ${definition.id} · ${s.parts.length} parts`);
  A.settle(R, P);
  const body = R.items.toSorted((a, b) => a.key - b.key).map(item => item.svg).join('');
  for (const theme of ['light', 'dark']) {
    const colors = Object.entries(palette[theme]).map(([key, value]) => `${key.startsWith('art-') ? '--' : '--anatomy-'}${key}:${value}`).join(';');
    const svg = k.figureSvg({ width: 600, height: 400, label: metadata.alt, body: [`<style>${css}\n.iso{${colors}}</style>`, `<rect width="600" height="400" fill="${palette[theme].paper}"/>`, body] });
    const selfContained = svg.replace('class="iso-svg', 'class="iso iso-svg');
    const path = `${definition.id}-${theme}.svg`;
    writeFileSync(new URL(path, out), selfContained);
  }
  writeFileSync(new URL(`${definition.id}-parts.json`, evidence), JSON.stringify({ concept: definition.caption, assemblies: definition.parts, parts: s.parts }, null, 2));
  if (process.argv.includes('--audit')) {
    const result = A.audit(R, P);
    const count = A.failures(result);
    audits.push({ scene: definition.id, failures: count, report: A.report(result), count: s.parts.length });
    if (count) { console.log(A.report(result)); process.exitCode = 1; }
    else console.log('audit passed');
  }
}
if (!only) {
  const fingerprints = SCENES.map(scene => ({ id: scene.id, hash: createHash('sha256').update(readFileSync(new URL(`${scene.id}-light.svg`, out))).digest('hex') }));
  if (new Set(fingerprints.map(x => x.hash)).size !== SCENES.length) throw new Error('Duplicate image contents');
  writeFileSync(rootFile('src/data/sector-illustrations.json'), JSON.stringify(manifest));
  writeFileSync(new URL('coverage.json', evidence), JSON.stringify({ sectors: CORE_SCENE_IDS.length, sourceIndustries: registry.industries.length, sceneCount: SCENES.length, uniqueGeometryCount: new Set(Object.values(manifest.scenes).map(s => s.geometryHash)).size, missing: [], industries: registry.industries.map(group => ({ id: group.id, name: group.name, scene: mapping[group.id].scene })), fingerprints }, null, 2));
}
if (process.argv.includes('--audit')) writeFileSync(new URL(only ? 'audit-selection.json' : 'geometry-audit.json', evidence), JSON.stringify(audits, null, 2));
