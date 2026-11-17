import {describe,it,expect} from 'vitest';
import {FINANCIAL_TERMS} from '@/lib/financialTerms';
import {dictionaryScene,DICTIONARY_SCENES} from '@/lib/dictionaryScenes';
describe('dictionary interactive explanations',()=>{
 it('covers every published term with an interactive explanation',()=>{
 const native=new Set(['stock','return','chart-volume','etf','fund']);
 expect(FINANCIAL_TERMS.filter(term=>!native.has(term.id)&&!dictionaryScene(term)).map(term=>term.id)).toEqual([]);
 for(const term of FINANCIAL_TERMS){const scene=dictionaryScene(term);if(!scene)continue;expect(scene.frames.length).toBeGreaterThan(1);for(const frame of scene.frames){expect(frame.labels.length).toBe(frame.values.length);expect(frame.values.every(Number.isFinite)).toBe(true);expect(frame.note.length).toBeGreaterThan(0);}}
 });
 it('preserves value through split and reverse split',()=>{
 for(const id of ['stock-split','reverse-split'])for(const frame of DICTIONARY_SCENES[id].frames){expect(frame.values[0]*frame.values[1]).toBe(10);expect(frame.values[2]).toBe(10);}
 });
 it('does not present distribution cash as extra total wealth',()=>{
 for(const frame of DICTIONARY_SCENES.distribution.frames)expect(frame.values[0]+frame.values[1]).toBe(frame.values[2]);
 expect(DICTIONARY_SCENES.distribution.frames[1].values[2]).toBe(DICTIONARY_SCENES.distribution.frames[0].values[2]);
 });
});
