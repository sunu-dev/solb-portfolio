import { describe, it, expect } from 'vitest';
import { dictionaryLeafCurve } from './dictionaryLeafGeometry';

describe('dictionary leaf geometry', () => {
  it('keeps the binding fixed throughout a turn', () => {
    for (const p of [0,.1,.25,.5,.75,.9,1]) expect(dictionaryLeafCurve(p)[0]).toMatchObject({u:0,x:0,z:0});
  });
  it('starts on the right and settles flat on the left without stretching', () => {
    const first = dictionaryLeafCurve(0).at(-1)!, last = dictionaryLeafCurve(1).at(-1)!;
    expect(first.x).toBeCloseTo(1); expect(first.z).toBeCloseTo(0);
    expect(last.x).toBeCloseTo(-1); expect(last.z).toBeCloseTo(0);
  });
  it('bends above the book while preserving the length of every paper segment', () => {
    for (const p of [.2,.5,.8]) {
      const curve = dictionaryLeafCurve(p);
      expect(curve.at(-1)!.z).toBeGreaterThan(.5);
      for (let i=1;i<curve.length;i++) {
        expect(Math.hypot(curve[i].x-curve[i-1].x,curve[i].z-curve[i-1].z)).toBeCloseTo(1/64);
        expect(curve[i].z).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
