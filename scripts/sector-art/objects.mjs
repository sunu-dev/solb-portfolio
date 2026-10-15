// Joobi's original scenes, constructed with Anatomy primitives. World units are illustrative.
// This is a static editorial model, not a dimensionally accurate engineering simulation.
export class Scene {
  parts = [];
  add(kind, geometry, tone = 'mid', lit = false) {
    this.parts.push({ kind, ...geometry, tone, lit, name: `${this.subject ?? 'structure'}.${kind}.${this.parts.length}` });
  }
  box(x, y, w, d, z, h, lit = false, tone = 'mid', r = 1) {
    this.add('box', { plan: { x, y, w, d, r: Math.min(r, w / 2, d / 2) }, z, h }, tone, lit);
  }
  round(x, y, r, z, h, lit = false, tone = 'mid') { this.add('round', { x, y, r, z, h }, tone, lit); }
  cone(x, y, r, z, h, lit = false) { this.add('cone', { x, y, r, z, h }, 'hi', lit); }
  poly(ring, z, h, lit = false) { this.add('poly', { ring, z, h }, 'hi', lit); }
  turned(origin, axis, profile, lit = false, tone = 'hi', hollow = false) {
    this.add('turned', { origin, axis, profile, hollow }, tone, lit);
  }
  prism(frame, ring, from, to, lit = false, tone = 'hi') {
    this.add('prism', { frame, ring, from, to }, tone, lit);
  }
  material(value) { this.parts.at(-1).material = value; }
  screws(x, y, w, d, z) { for (const a of [x + 3, x + w - 3]) for (const b of [y + 3, y + d - 3]) this.round(a, b, .85, z, .6, false, 'lo'); }
  base() {
    this.subject = 'base';
    this.box(-116, -65, 232, 130, -5, 5, false, 'lo', 5);
    for (const x of [-102, 102]) for (const y of [-51, 51]) {
      this.round(x, y, 5, -11, 2, false, 'lo'); this.round(x, y, 4, -9, 4, false, 'lo');
      this.round(x, y, 2.2, 0, .5, false, 'lo'); this.round(x, y, 1.2, .5, .6, false, 'mid');
    }
  }
  cabinet(x, y, w = 38, d = 35, h = 64, bays = 5, lit = false) {
    this.box(x, y, w, d, 0, h, false, 'mid', 2);
    this.screws(x, y, w, d, h);
    for (let i = 0; i < bays; i++) {
      const z = 7 + i * (h - 14) / bays;
      this.box(x + 3, y + d, w - 6, .8, z, (h - 18) / bays, lit && i === 2, 'hi', .5);
      this.box(x + 6, y + d + .8, w - 16, .35, z + 3, 1.3, false, 'lo', .3);
      this.box(x + w - 7, y + d + .8, 1.8, .35, z + 2.8, 1.8, lit && i === 2, 'hi', .2);
    }
  }
  building(x, y, w = 58, d = 42, h = 72, style = 'office', lit = false) {
    this.box(x, y, w, d, 0, 3, false, 'lo');
    this.box(x + 2, y + 2, w - 4, d - 4, 3, h, false, 'mid', 1);
    this.box(x, y, w, d, h + 3, 3, false, 'hi');
    const cols = style === 'home' ? 2 : 4;
    const rows = style === 'home' ? 2 : 4;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) this.box(x + 6 + c * (w - 12) / cols, y + d - 2, (w - 16) / cols, .7, 13 + r * (h - 16) / rows, (h - 28) / rows, lit && c === 1 && r === 1, 'hi', .2);
    this.box(x + w / 2 - 5, y + d - 2, 10, 1, 3, 10, false, 'lo');
    this.box(x + 6, y + 6, 13, 10, h + 6, 5, false, 'lo');
    for (let i = 0; i < 4; i++) this.box(x + 8 + i * 2.5, y + 7, 1, 8, h + 11, .5, false, 'mid', .1);
  }
  bench(x = -88, y = -40, w = 176, d = 80, z = 25) {
    for (const a of [x + 3, x + w - 9]) for (const b of [y + 3, y + d - 9]) this.box(a, b, 6, 6, 0, z);
    this.box(x, y, w, d, z, 4, false, 'mid', 2);
    this.screws(x, y, w, d, z + 4);
  }
  monitor(x, y, z = 0, lit = false, w = 43) {
    this.box(x, y, w, 22, z, 2, false, 'lo');
    this.box(x + w / 2 - 2, y + 7, 4, 4, z + 2, 13);
    this.box(x, y + 5, w, 5, z + 15, 31, false, 'hi', 2);
    this.box(x + 3, y + 10, w - 6, .6, z + 18, 25, lit, 'lo', 1);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) this.box(x + 6 + c * (w - 12) / 3, y + 10.6, (w - 18) / 3, .2, z + 21 + r * 5, 2, false, 'mid', .2);
  }
  board(x, y, z = 0, w = 60, d = 48, lit = false, chip = true) {
    this.box(x, y, w, d, z, 2, false, 'hi'); this.screws(x, y, w, d, z + 2);
    const cw = Math.min(24, w * .35), cd = Math.min(20, d * .32), pd = Math.min(6, d * .15);
    if (chip) this.box(x + w / 2 - cw / 2, y + d / 2 - cd / 2, cw, cd, z + 2, 4, lit, 'hi');
    for (let c = 0; c < 6; c++) {
      this.box(x + 7 + c * (w - 14) / 6, y + 2, 2, pd, z + 2, 1, false, 'lo', .2);
      this.box(x + 7 + c * (w - 14) / 6, y + d - 2 - pd, 2, pd, z + 2, 1, false, 'lo', .2);
    }
  }
  tank(x, y, r = 17, h = 62, lit = false) {
    this.round(x, y, r + 2, 0, 3, false, 'lo');
    this.round(x, y, r, 3, h, lit, 'hi');
    this.round(x, y, r + .8, h + 3, 2, false, 'mid');
    this.round(x, y, 3, h + 5, 4, false, 'hi');
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; this.round(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2), .65, h + 5, .5, false, 'lo'); }
  }
  bottle(x, y, z = 0, r = 5, h = 21, lit = false) {
    this.round(x, y, r, z, h, lit, 'hi'); this.round(x, y, r * .7, z + h, 3, false, 'lo');
  }
  conveyor(x = -85, y = -18, length = 170, z = 21) {
    for (const a of [x + 6, x + length - 12]) for (const b of [y, y + 28]) this.box(a, b, 6, 6, 0, z);
    this.box(x, y, length, 34, z, 5, false, 'mid');
    for (let i = 0; i < 20; i++) this.box(x + 2 + i * (length - 4) / 20, y + 2, 1.5, 30, z + 5, .7, false, 'lo', .3);
  }
  wafer(x, y, z = 0, r = 31, lit = true) {
    this.round(x, y, r, z, 2, lit, 'hi');
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.hypot(a, b) < 2.6) this.box(x + a * 10 - 4, y + b * 10 - 4, 8, 8, z + 2, .3, false, 'mid', .3);
  }
  vehicle(x = -77, y = -29, type = 'car', lit = true) {
    if (type === 'car') {
      const F = { o: [x, y + 7, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };
      for (const a of [29, 124]) for (const side of [-1, 1]) {
        const b = y + 28 + side * 21;
        this.turned([x + a, b, 11], [0, side, 0], [[0, 9], [1.2, 11], [7, 11], [8.2, 9]]);
        this.material('rubber');
        this.turned([x + a, b + side * 8.2, 11], [0, side, 0], [[0, 6.6], [.7, 6.6]]);
        this.turned([x + a, b + side * 8.9, 11], [0, side, 0], [[0, 2.5], [.6, 2.5]], false, 'mid');
      }
      this.box(x, y + 7, 156, 42, 13, 9, false, 'hi', 6);
      this.prism(F, [[28,22],[48,43],[95,43],[119,22]], 3, 39);
      for (const side of [2.5,39]) {
        this.prism(F, [[33,24],[50,40],[68,40],[68,24]], side, side + .5); this.material('glass');
        this.prism(F, [[72,24],[72,40],[93,40],[113,24]], side, side + .5); this.material('glass');
      }
      const slope = Math.hypot(24, 21);
      this.prism({ o: [x + 95, y + 10, 43], a: [21 / slope, 0, 24 / slope], u: [0, 1, 0], v: [24 / slope, 0, -21 / slope] }, [[3,3],[33,3],[33,slope-3],[3,slope-3]], 0, .35);
      this.material('glass');
      this.box(x + 5, y + 10, 23, 36, 22, 3, false, 'hi', 3);
      this.box(x + 119, y + 10, 31, 36, 22, 3, lit, 'hi', 3);
      for (const side of [y + 9.5, y + 46]) {
        for (const a of [53, 86]) this.box(x + a, side, 7, .6, 25, 1.4, false, 'mid', .4);
        this.box(x + 98, side === y + 9.5 ? y + 6.5 : y + 49, 5, .5, 14, 3, false, 'mid', .4);
      }
      for (const end of [x, x + 153]) for (const b of [y + 11, y + 39]) this.box(end, b, 3, 6, 22, 2, false, 'hi', .8);
      this.box(x + 156, y + 19, .5, 18, 15, 4, false, 'lo'); this.material('glass');
      return;
    }
    const length = type === 'truck' ? 148 : 134;
    for (const a of [x + 20, x + length - 27]) for (const b of [y + 2, y + 43]) { this.box(a, b, 16, 10, 0, 17, false, 'lo', 5); this.box(a + 4, b + 10, 8, .5, 5, 7, false, 'mid', 3); }
    this.box(x, y + 7, length, 42, 17, 7, false, 'hi', 5);
    if (type === 'truck') {
      this.box(x + 6, y + 10, 93, 36, 24, 45, false, 'hi', 1);
      for (let i = 0; i < 13; i++) this.box(x + 9 + i * 6.5, y + 46, 1, .5, 26, 40, false, 'lo', .1);
      this.box(x + 101, y + 11, 42, 34, 24, 29, lit, 'hi', 3);
      this.box(x + 107, y + 45, 27, .5, 37, 13, false, 'lo');
    } else {
      this.box(x + 25, y + 10, 69, 36, 24, 22, false, 'hi', 7);
      for (let i = 0; i < 3; i++) this.box(x + 30 + i * 20, y + 46, 16, .5, 31, 11, false, 'lo', 2);
      this.box(x + 96, y + 11, 30, 34, 24, 7, lit, 'hi', 3);
      for (let i = 0; i < 5; i++) this.box(x + 5 + i * 6, y + 49, 3, .5, 19, 2, false, 'mid');
    }
    for (const a of [x, x + length - 4]) for (const b of [y + 12, y + 36]) this.box(a, b, 4, 8, 24, 3, false, 'hi');
  }
  shelves(kind = 'boxes', lit = true) {
    for (const x of [-82, 78]) for (const y of [-28, 28]) for (const [z, h] of [[0, 5], [8, 24], [35, 24], [62, 17]]) this.box(x, y, 4, 4, z, h, false, 'hi');
    for (const z of [5, 32, 59]) {
      this.box(-84, -30, 168, 64, z, 3, false, 'mid');
      for (let i = 0; i < 7; i++) {
        const x = -70 + i * 22;
        if (kind === 'bottles') this.bottle(x, 7, z + 3, 6, 19, lit && i === 3 && z === 32);
        else this.box(x - 8, -17, 16, 36, z + 3, 19, lit && i === 3 && z === 32, 'hi', kind === 'books' ? .3 : 2);
      }
    }
  }
  desk(kind = 'office', lit = true) {
    this.bench(-82, -40, 164, 80, 31);
    if (kind === 'lab') { for (let i = 0; i < 6; i++) this.bottle(-65 + i * 13, -5, 35, 4, 18, lit && i === 2); this.monitor(28, -27, 35, false); }
    else {
      this.monitor(-57, -24, 35, lit);
      this.box(6, -20, 56, 44, 35, 2, false, 'hi');
      for (let i = 0; i < 6; i++) this.box(11, -14 + i * 5, 44 - i * 3, 1, 37, .2, false, 'lo', .2);
      this.box(-54, 19, 42, 12, 35, 1, false, 'lo');
      for (let i = 0; i < 10; i++) this.box(-52 + i * 3.9, 21, 2.7, 7, 36, .4, false, 'mid', .2);
    }
  }
  solar(x = -63, y = -35, z = 11, lit = true) {
    for (const a of [x + 5, x + 105]) for (const b of [y + 5, y + 57]) this.box(a, b, 4, 4, 0, z);
    this.box(x, y, 115, 68, z, 3, false, 'hi');
    for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) this.box(x + 3 + a * 18.5, y + 3 + b * 15.5, 16.5, 13.5, z + 3, .6, lit && a === 2 && b === 2, 'lo', .2);
  }
}
