import { expect, it } from 'vitest';
import { mentionedAssistantStocks, resolveAssistantSubject } from '@/lib/assistantSubject';
const base = { unclearTerms: [], market: 'kr' as const, period: '1d' as const };
it.each([
 ['마이크론은 왜이렇게 떨어지는거야?', 'MU'], ['Micron shares fell?', 'MU'], ['MU는 왜 떨어져?', 'MU'], ['MUU 왜 내려?', 'MUU'],
 ['삼성전자는 왜 내려요?', '005930.KS'], ['시선AI가 뭐하는 회사야?', '340810.KQ'],
 ['엔비디아 왜 떨어져?', 'NVDA'], ['SOXL은 왜 떨어져?', 'SOXL'], ['하나마이크론은 왜 내려요?', '067310.KQ'],
 ['테슬라는 왜 내려요?', 'TSLA'],
])('resolves %s to its own issuer', (text, symbol) => {
 const result = resolveAssistantSubject({ ...base, text });
 expect(result.candidates).toEqual([]); expect(result.question.symbol).toBe(symbol);
 expect(result.question.market).toBe(symbol.includes('.') ? 'kr' : 'us');
});
it('does not turn an ordinary term or a partial ticker into a different issuer', () => {
 for (const text of ['ETF는 주식과 뭐가 달라요?', 'AI가 뭐야?', '투자는 언제 해요?']) expect(mentionedAssistantStocks(text)).toEqual([]);
});
it('asks instead of silently choosing one share class or company', () => {
 expect(resolveAssistantSubject({ ...base, text: '구글은 왜 내려요?' }).candidates.map(c => c.symbol).sort()).toEqual(['GOOG', 'GOOGL']);
 expect(resolveAssistantSubject({ ...base, text: '마이크론과 삼성전자는 왜 내려요?' }).candidates.map(c => c.symbol)).toContain('MU');
 expect(resolveAssistantSubject({ ...base, text: '마이크론과 삼성전자는 왜 내려요?' }).candidates).toHaveLength(2);
});
it('explicit text takes priority over stale selection and follow-up retains that subject', () => {
 expect(resolveAssistantSubject({ ...base, symbol: '005930.KS', text: '마이크론은 왜 떨어져?' }).question.symbol).toBe('MU');
 expect(resolveAssistantSubject({ ...base, text: '그럼 시장 전체도 그래?', history: [{ question: '마이크론 왜 떨어져?', answer: 'untrusted answer' }] }).question.symbol).toBe('MU');
 expect(resolveAssistantSubject({ ...base, symbol: 'MU', text: '이번엔 테슬라는?', history: [{ question: '마이크론 왜 떨어져?', answer: '' }] }).question.symbol).toBe('TSLA');
 expect(resolveAssistantSubject({ ...base, symbol: 'MU', text: '그게 뭐야?', history: [{ question: '이 회사는?', answer: '삼성전자' }] }).question.symbol).toBe('MU');
});
it('switches explicit market without retaining the previous issuer', () => {
 const result = resolveAssistantSubject({ ...base, symbol:'MU', text:'이번에는 국장이 왜 떨어져?', history:[{question:'마이크론은 왜 떨어져?',answer:''}] });
 expect(result.question.symbol).toBeUndefined(); expect(result.question.market).toBe('kr');
 expect(resolveAssistantSubject({...base,text:'최근 5거래일 마이크론은 왜 내려요?'}).question.period).toBe('5d');
});
it('uses an explicitly confirmed candidate, without accepting an unrelated confirmation', () => {
 expect(resolveAssistantSubject({...base,text:'구글은 왜 내려요?',confirmedSymbol:'GOOG'}).question.symbol).toBe('GOOG');
 expect(resolveAssistantSubject({...base,text:'마이크론 왜 내려?',confirmedSymbol:'TSLA'}).question.symbol).toBe('MU');
});
it('keeps the confirmed subject, market and period on a pronoun follow-up',()=>{
 expect(resolveAssistantSubject({...base,text:'그럼 앞으로는?',history:[{question:'구글은 왜 내려요?',answer:'예전 답',symbol:'GOOG',market:'us',period:'5d'}]}).question).toMatchObject({symbol:'GOOG',market:'us',period:'5d'});
 expect(resolveAssistantSubject({...base,text:'왜 그런거야?',history:[{question:'미장은?',answer:'예전 답',symbol:'GENERAL',market:'us',period:'1d'}]}).question).toMatchObject({symbol:undefined,market:'us'});
});

it('derives the market from a selected US stock when the UI still has its Korean-market default', () => {
 const resolved=resolveAssistantSubject({text:'왜 이렇게 떨어지는 거야?',symbol:'MUU',market:'kr',period:'1d',unclearTerms:[]});
 expect(resolved.question.symbol).toBe('MUU');expect(resolved.question.market).toBe('us');
});

it('recognizes a US sector question even when the UI market defaults to Korea', () => {
 const result=resolveAssistantSubject({...base,symbol:'MUU',market:'kr',text:'어제 미국 기술주랑 반도체주는 왜 같이 떨어졌어?'});
 expect(result.question).toMatchObject({symbol:undefined,market:'us',period:'1d'});
 expect(result.candidates).toEqual([]);
});

it('keeps yesterday on follow-ups, including a bounded history, but explicit today resets it', () => {
 const yesterday = resolveAssistantSubject({...base,text:'어제 마이크론은 왜 떨어졌어요?'}).question;
 expect(yesterday).toMatchObject({symbol:'MU',period:'1d',sessionReference:'previous'});
 const history=[{question:'어제 마이크론은 왜 떨어졌어요?',answer:'이전 설명',symbol:'MU',period:'1d' as const,sessionReference:'previous' as const}];
 expect(resolveAssistantSubject({...base,text:'시장도 같이 내려갔나요?',history}).question.sessionReference).toBe('previous');
 expect(resolveAssistantSubject({...base,text:'오늘은 어때요?',history}).question.sessionReference).toBe('latest');
 expect(resolveAssistantSubject({...base,text:'최근 5거래일은요?',history}).question).toMatchObject({period:'5d',sessionReference:'latest'});
 expect(resolveAssistantSubject({...base,text:'그게 어떤 영향이에요?',history:[{...history[0],question:'그럼 반도체에는?'}]}).question.sessionReference).toBe('previous');
 expect(resolveAssistantSubject({...base,text:'왜 떨어졌어요?',history:[{question:'시장 분위기는요?',answer:'어제 마이크론'}]}).question.sessionReference).toBe('latest');
});

it('selects only explicitly identified US semiconductor and technology groups', () => {
 expect(resolveAssistantSubject({...base,text:'미국 반도체주 전체는 왜 많이 떨어졌어?'}).question).toMatchObject({symbol:undefined,market:'us',industryFocus:['semiconductors']});
 expect(resolveAssistantSubject({...base,text:'어제 미국 기술주랑 반도체주는 왜 같이 떨어졌어?'}).question).toMatchObject({symbol:undefined,market:'us',industryFocus:['semiconductors','technology'],sessionReference:'previous'});
 expect(resolveAssistantSubject({...base,symbol:'MU',text:'그럼 기술주는 어때?'}).question).toMatchObject({symbol:undefined,market:'us',industryFocus:['technology']});
 expect(resolveAssistantSubject({...base,text:'한국 반도체주 전체는 왜 내려요?'}).question.industryFocus).toEqual([]);
 expect(resolveAssistantSubject({...base,text:'반도체가 뭐예요?'}).question.industryFocus).toEqual([]);
 expect(resolveAssistantSubject({...base,text:'미국 은행주는 왜 내려요?'}).question.industryFocus).toEqual([]);
});

it('carries the industry topic through bounded or older history and clears it for an explicit new subject', () => {
 const history=[{question:'그 영향이 뭐야?',answer:'지난 설명',symbol:'GENERAL',market:'us' as const,industryFocus:['semiconductors' as const]}];
 expect(resolveAssistantSubject({...base,text:'그럼 왜 그렇게 된 거야?',history}).question).toMatchObject({symbol:undefined,market:'us',industryFocus:['semiconductors']});
 expect(resolveAssistantSubject({...base,text:'오늘 시장 전체는 어때?',history}).question.industryFocus).toEqual([]);
 expect(resolveAssistantSubject({...base,text:'미장은 왜 움직여?',history}).question.industryFocus).toEqual([]);
 expect(resolveAssistantSubject({...base,text:'이번엔 테슬라는?',history}).question).toMatchObject({symbol:'TSLA',industryFocus:[]});
 expect(resolveAssistantSubject({...base,text:'한국 반도체주는 어때?',history}).question).toMatchObject({market:'kr',industryFocus:[]});
 expect(resolveAssistantSubject({...base,text:'그럼 다음에는?',history:[{question:'미국 반도체주 전체는 왜 내려요?',answer:'이전 설명'}]}).question).toMatchObject({market:'us',industryFocus:['semiconductors']});
 expect(resolveAssistantSubject({...base,text:'그럼 다음에는?',history:[...history,{question:'시장 전체는?',answer:'이전 설명',symbol:'GENERAL',market:'us' as const,industryFocus:[]}]}).question.industryFocus).toEqual([]);
});

it('recognizes the spoken Korean company name without falling back to the market', () => {
 for (const name of ['시선에이아이','시선 에이아이','시선AI']) {
  const result = resolveAssistantSubject({text:`어제 ${name}는 왜 많이 오른거야?`,unclearTerms:[],market:'kr'});
  expect(result.question.symbol, JSON.stringify({name,candidates:result.candidates})).toBe('340810.KQ');
 }
});
