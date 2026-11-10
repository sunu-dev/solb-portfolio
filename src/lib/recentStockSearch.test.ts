import { describe, expect, it } from 'vitest';
import { getRecent, saveRecent, removeRecent } from './recentStockSearch';
function store(initial = '[]') {
  let value = initial;
  return { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
}
describe('recent stock search', () => {
  it('keeps the latest five unique stocks, normalized and most recent first', () => {
    const storage = store();
    for (const symbol of ['A', 'B', 'C', 'D', 'E', 'F', ' c ']) saveRecent({ symbol, description: symbol }, storage);
    expect(getRecent(storage).map(row => row.symbol)).toEqual(['C', 'F', 'E', 'D', 'B']);
    removeRecent('C', storage);
    expect(getRecent(storage).map(row => row.symbol)).toEqual(['F', 'E', 'D', 'B']);
  });
  it('ignores corrupt and malformed persisted data', () => {
    for (const value of ['{', '{}', 'null', '[null,{},1]']) expect(getRecent(store(value))).toEqual([]);
  });
  it('never blocks stock navigation when storage is denied or full', () => {
    const storage = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('full'); } };
    expect(getRecent(storage)).toEqual([]);
    expect(() => saveRecent({ symbol: 'MU', description: '마이크론' }, storage)).not.toThrow();
    expect(() => removeRecent('MU', storage)).not.toThrow();
  });
});
