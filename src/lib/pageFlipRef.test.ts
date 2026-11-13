import { describe, expect, it } from 'vitest';
import { uniquePageFlipRef } from './pageFlipRef';

describe('react-pageflip page registration', () => {
  it('keeps one entry per DOM page during React 19 StrictMode ref replay', () => {
    const registered: object[] = [];
    const node = {};
    const ref = uniquePageFlipRef<object>(value => { if (value) registered.push(value); });
    ref(node);
    ref(null);
    ref(node);
    expect(registered).toEqual([node]);
  });

  it('registers replacement DOM nodes and allows a fresh library collection', () => {
    const registered: object[] = [];
    const append = (value: object | null) => { if (value) registered.push(value); };
    const first = {};
    const replacement = {};
    const ref = uniquePageFlipRef(append);
    ref(first);
    ref(null);
    ref(replacement);
    expect(registered).toEqual([first, replacement]);
    registered.length = 0;
    uniquePageFlipRef(append)(replacement);
    expect(registered).toEqual([replacement]);
  });
});
