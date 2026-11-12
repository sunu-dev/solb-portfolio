import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

// Handler-level harness, not a substitute for browser layout or React lifecycle tests.
const h = vi.hoisted(() => ({ values: [] as unknown[], refs: [] as { current: unknown }[], cursor: 0, refCursor: 0, remaining: 3,
  session: vi.fn(), refresh: vi.fn(), accept: vi.fn(), fetch: vi.fn(), copyDraft: vi.fn(), stocks: [] as { symbol: string; name: string; demo?: boolean }[] }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useId: () => 'qa-chat', useEffect: () => {}, useCallback: (callback: unknown) => callback,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.values)) h.values[index] = typeof initial === 'function' ? initial() : initial;
      return [h.values[index], (next: unknown) => { h.values[index] = typeof next === 'function' ? next(h.values[index]) : next; }];
    },
    useRef: (initial: unknown) => h.refs[h.refCursor++] ?? (h.refs[h.refCursor - 1] = { current: initial }),
  };
});
vi.mock('@/components/learning/JoobiConversationProvider', async () => {
  const React = await import('react');
  return { useJoobiConversation: () => {
    const [question, setQuestion] = React.useState('');
    const [answers, setAnswers] = React.useState<unknown[]>([]);
    return { question, setQuestion, answers, setAnswers, copyDraftTo: h.copyDraft, clear: () => { setQuestion(''); setAnswers([]); } };
  } };
});
vi.mock('@/hooks/useAnalysisQuota', () => ({ useAnalysisQuota: () => ({ remaining: h.remaining, status: 'ready', refresh: h.refresh, acceptResponse: h.accept }) }));
vi.mock('@/components/learning/PersonalLearningProvider', () => ({ usePersonalDictionary: () => ({ owner: 'qa-owner', entries: [] }) }));
vi.mock('@/store/portfolioStore', () => ({ usePortfolioStore: (select: (s: unknown) => unknown) => select({ stocks: { investing: h.stocks, watching: [] } }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: h.session } } }));
import { GENERAL_SUBJECT } from '@/lib/assistantQuestion';
import AskJoobi from '@/components/learning/AskJoobi';

type Node = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function nodes(tree: ReactNode): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as Node;
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node && typeof node === 'object' && 'props' in node ? text((node as Node).props.children) : '';
}
function render() { h.cursor = 0; h.refCursor = 0; return nodes(AskJoobi({ symbol: 'MU', embedded: true })); }
function fill(question: string) {
  const input = render().find(node => node.type === 'textarea')!;
  (input.props.onChange as (event: unknown) => void)({ target: { value: question } });
}
function submit() { (render().find(node => node.type === 'form')!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); }
function click(label: string) {
  const button = render().find(node => node.type === 'button' && text(node.props.children) === label)!;
  expect(button).toBeDefined();
  (button.props.onClick as () => void)();
}
function openOptions() {
  const trigger = render().find(node => node.type === 'button' && node.props['aria-label'] === '대화 설정')!;
  (trigger.props.onClick as () => void)();
}
function closeOptions() {
  const panel = render().find(node => node.props.title === '대화 대상과 기간')!;
  (panel.props.onClose as () => void)();
}
function chooseStock(symbol: string) {
  openOptions();
  const select = render().find(node => node.type === 'select' && node.props.id === 'qa-chat-stock')!;
  (select.props.onChange as (event: unknown) => void)({ target: { value: symbol } });
  closeOptions();
}
beforeEach(() => {
  h.values = []; h.refs = []; h.cursor = 0; h.refCursor = 0; h.remaining = 3;
  h.session.mockReset().mockResolvedValue({ data: { session: { user: { id: 'qa-owner' }, access_token: 'test-only-token' } } });
  h.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, report: { currentStatus: '시험용 설명', keyAdvice: [], conclusion: { desc: '시험용 결론' } } }) });
  h.accept.mockClear(); h.refresh.mockClear(); h.copyDraft.mockClear(); h.stocks = [];
  vi.stubGlobal('fetch', h.fetch);
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1; });
});
afterEach(() => vi.unstubAllGlobals());

it('offers one explicit consent-and-send button, while keyboard submission alone never grants consent', async () => {
  fill('마이크론을 쉽게 설명해주세요'); submit();
  expect(h.fetch).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled();
  expect(render().some(node => text(node.props.children) === '물어보기')).toBe(true);
  expect(render().filter(node => node.type === 'button' && text(node.props.children) === '물어보기')).toHaveLength(1);
  expect(h.fetch).not.toHaveBeenCalled();
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('마이크론을 쉽게 설명해주세요');
  submit(); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(1));
  expect(h.fetch).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(h.fetch.mock.calls[0][1].body);
  expect(payload.questionConsent).toBe(true); expect(payload.symbol).toBe('MU');
  expect(payload.questionHistory).toEqual([]);
  expect(payload).not.toHaveProperty('holdings');
});

it('keeps the visible conversation and sends only three prior exchanges on follow-up', async () => {
  for (let index = 1; index <= 5; index++) {
    fill(`시험 질문 ${index}`); submit();
    if (index === 1) click('물어보기');
    await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(index));
  }
  const turns = render().filter(node => node.type === 'section' && String(node.props['aria-label']).endsWith('번째 질문과 답변'));
  expect(turns).toHaveLength(5);
  expect(turns.map(node => text(node.props.children).match(/시험 질문 \d/)?.[0])).toEqual(['시험 질문 1','시험 질문 2','시험 질문 3','시험 질문 4','시험 질문 5']);
  const payload = JSON.parse(h.fetch.mock.calls[4][1].body);
  expect(payload.questionHistory.map((item: { question: string }) => item.question)).toEqual(['시험 질문 2','시험 질문 3','시험 질문 4']);
});

it('starts with collapsed settings and requires a real send action after choosing an example', () => {
  const initial = render();
  expect(initial.filter(node => node.type === 'details').every(node => !node.props.open)).toBe(true);
  expect(initial.some(node => node.type === 'select')).toBe(false);
  openOptions();
  expect(render().find(node => node.type === 'select' && node.props.id === 'qa-chat-stock')!.props.value).toBe('MU');
  closeOptions();
  click('이 종목을 쉽게 설명해 주세요');
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('이 종목을 쉽게 설명해 주세요');
  expect(h.fetch).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled();
});

it('ignores form submission when no questions remain, including keyboard submission', () => {
  h.remaining = 0; fill('시험 질문'); submit();
  expect(h.fetch).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled();
  expect(render().find(node => node.type === 'button' && text(node.props.children) === '물어보기')!.props.disabled).toBe(true);
  click('물어보기'); expect(h.fetch).not.toHaveBeenCalled();
});

it('keeps Korean composition and Shift+Enter out of the send shortcut', () => {
  const keydown = render().find(node => node.type === 'textarea')!.props.onKeyDown as (event: unknown) => void;
  const requestSubmit = vi.fn();
  const event = (shiftKey: boolean, isComposing: boolean, keyCode = 13) => ({ key: 'Enter', shiftKey, nativeEvent: { isComposing, keyCode }, preventDefault: vi.fn(), currentTarget: { form: { requestSubmit } } });
  keydown(event(false, true)); keydown(event(false, false, 229)); keydown(event(true, false));
  expect(requestSubmit).not.toHaveBeenCalled();
  keydown(event(false, false)); expect(requestSubmit).toHaveBeenCalledOnce();
});

it('keeps the sent bubble separate from the next draft and does not erase that draft on reply', async () => {
  let finish!: (value: unknown) => void;
  h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fill('마이크론은 어떤 회사예요?'); submit(); click('물어보기');
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  fill('그러면 주요 고객은 누구예요?'); submit();
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(render().some(node => node.type === 'p' && text(node.props.children) === '보낸 질문: 마이크론은 어떤 회사예요?')).toBe(true);
  finish({ ok: true, json: async () => ({ success: true, report: { currentStatus: '시험용 답변', keyAdvice: [], conclusion: { desc: '' } } }) });
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('그러면 주요 고객은 누구예요?');
});

it('ignores a late answer after stopping and restores the question for editing', async () => {
  let finish!: (value: unknown) => void;
  h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fill('마이크론은 어떤 회사예요?'); submit(); click('물어보기');
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  click('중단');
  expect(h.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('마이크론은 어떤 회사예요?');
  finish({ ok: true, json: async () => ({ success: true, report: { currentStatus: '늦게 온 답변', keyAdvice: [], conclusion: { desc: '' } } }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(h.accept).not.toHaveBeenCalled();
  expect(render().some(node => text(node.props.children).includes('늦게 온 답변'))).toBe(false);
});

it('selects a registered ticker without typing it and sends only that ticker with the question', async () => {
  h.stocks = [{ symbol: 'MU', name: '마이크론' }, { symbol: 'SOXL', name: 'SOXL' }, { symbol: 'DEMO', name: '샘플', demo: true }];
  fill('왜 떨어졌어?');
  chooseStock('SOXL');
  expect(h.copyDraft).toHaveBeenCalledWith('SOXL:us:1d');
  expect(h.fetch).not.toHaveBeenCalled();
  expect(render().some(node => node.type === 'button' && text(node.props.children).includes('샘플'))).toBe(false);
  click('물어보기');
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  const body = JSON.parse(h.fetch.mock.calls[0][1].body);
  expect(body.symbol).toBe('SOXL'); expect(body.questionText).toBe('왜 떨어졌어?');
  expect(body).not.toHaveProperty('stocks'); expect(body).not.toHaveProperty('holdings');
});

it('shows authentication failure at the composer and preserves the draft', async () => {
  h.session.mockResolvedValueOnce({ data: { session: null } });
  fill('시험 질문'); click('물어보기');
  await vi.waitFor(() => expect(render().some(node => node.props.role === 'alert' && text(node.props.children).includes('로그인한 뒤'))).toBe(true));
  expect(h.fetch).not.toHaveBeenCalled();
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('시험 질문');
});


it('restores the draft and refreshes usage after an unreadable server response', async () => {
  h.fetch.mockResolvedValueOnce({ ok: false, status: 504, json: async () => { throw new SyntaxError('HTML gateway response'); } });
  fill('마이크론 왜떨어져?'); click('물어보기');
  await vi.waitFor(() => expect(h.refresh).toHaveBeenCalledTimes(1));
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('마이크론 왜떨어져?');
  const alert = render().find(node => node.props.role === 'alert')!;
  expect(text(alert.props.children)).toContain('답변 서버');
  expect(text(alert.props.children)).not.toContain('남은 횟수');
});

it('reports session lookup failure without implying the model rejected the question', async () => {
  h.session.mockRejectedValueOnce(new Error('session unavailable'));
  fill('마이크론 왜떨어져?'); click('물어보기');
  await vi.waitFor(() => expect(h.refresh).toHaveBeenCalledTimes(1));
  expect(h.fetch).not.toHaveBeenCalled();
  expect(text(render().find(node => node.props.role === 'alert')!.props.children)).toContain('로그인 상태');
});

it('disables new follow-ups at the daily limit while keeping the existing conversation readable', async () => {
 fill('시험 질문'); submit(); click('물어보기');
 await vi.waitFor(()=>expect(h.accept).toHaveBeenCalledOnce());
 h.remaining=0;
 const tree=render();
 for(const label of ['더 쉽게 설명해 줘','예를 들어 설명해 줘'])expect(tree.find(node=>node.type==='button'&&text(node.props.children)===label)?.props.disabled).toBe(true);
 expect(tree.some(node=>node.props.role==='region'&&String(node.props['aria-label']).includes('스크롤'))).toBe(true);
 expect(tree.some(node=>node.type==='section'&&String(node.props['aria-label']).endsWith('번째 질문과 답변'))).toBe(true);
});


it('shows the daily limit once while preserving the unanswered draft', async () => {
 h.accept.mockImplementationOnce(() => { h.remaining = 0; });
 h.fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ success: false, code: 'daily_user_limit', remaining: 0, error: '오늘 질문을 모두 사용했어요. 내일 다시 물어볼 수 있어요.' }) });
 fill('다시 물어볼 질문'); click('물어보기');
 await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
 const tree = render();
 expect(tree.find(node => node.type === 'textarea')!.props.value).toBe('다시 물어볼 질문');
 expect(tree.filter(node => node.props.role === 'alert')).toHaveLength(0);
 expect(tree.filter(node => node.type === 'p' && text(node.props.children) === '오늘 질문을 모두 사용했어요. 내일 다시 물어볼 수 있어요.')).toHaveLength(1);
});


it('refreshes uncertain usage after a structured server failure without automatically resending', async () => {
  h.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false, code: 'usage_record_failed', error: '이용 횟수 기록을 확인하지 못했어요.' }) });
  fill('마이크론 왜 떨어져?'); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('마이크론 왜 떨어져?');
});

it('keeps a failed question available for explicit retry without erasing the next draft', async () => {
  let finish!: (value: unknown) => void;
  h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fill('마이크론은 왜 떨어져?'); click('물어보기');
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledOnce());
  fill('그럼 반도체 전체는 어때?');
  finish({ ok: false, status: 502, json: async () => ({ success: false, error: '답변을 확인하지 못했어요.' }) });
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('그럼 반도체 전체는 어때?');
  expect(render().some(node => node.type === 'p' && text(node.props.children).includes('마이크론은 왜 떨어져?'))).toBe(true);
  click('이 질문 다시 보내기');
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(h.fetch.mock.calls[1][1].body).questionText).toBe('마이크론은 왜 떨어져?');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(2));
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('그럼 반도체 전체는 어때?');
});


it('does not repeat a failed retry on double click or after the daily allowance is exhausted', async () => {
  h.fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ success: false, error: '시험 실패' }) });
  fill('마이크론 왜 떨어져?'); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
  h.remaining = 0;
  click('이 질문 다시 보내기');
  expect(h.fetch).toHaveBeenCalledOnce();
  h.remaining = 2;
  let finish!: (value: unknown) => void;
  h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const retry = render().find(node => node.type === 'button' && text(node.props.children) === '이 질문 다시 보내기')!;
  (retry.props.onClick as () => void)(); (retry.props.onClick as () => void)();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  finish({ ok: true, json: async () => ({ success: true, report: { currentStatus: '시험 답변', keyAdvice: [], conclusion: { desc: '' } } }) });
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(2));
});

it('clears a failed question when switching the conversation subject', async () => {
  h.stocks = [{ symbol:'MU', name:'마이크론' }, { symbol:'SOXL', name:'SOXL' }];
  h.fetch.mockResolvedValueOnce({ ok:false, status:502, json:async()=>({ success:false,error:'시험 실패' }) });
  fill('마이크론 왜 떨어져?'); click('물어보기');
  await vi.waitFor(()=>expect(h.accept).toHaveBeenCalledOnce());
  chooseStock('SOXL');
  expect(render().some(node=>node.type==='button'&&text(node.props.children)==='이 질문 다시 보내기')).toBe(false);
});

it('switches scope and period without granting consent or sending a draft', () => {
  fill('보내지 않은 질문');
  openOptions();
  const select = render().find(node => node.type === 'select' && node.props.id === 'qa-chat-stock')!;
  (select.props.onChange as (e: unknown) => void)({ target: { value: GENERAL_SUBJECT } });
  closeOptions();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.session).not.toHaveBeenCalled();
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('보내지 않은 질문');
});

it('answers a greeting or thanks on screen without consent, a request, or a used question', async () => {
  fill('안녕!'); submit();
  expect(h.fetch).not.toHaveBeenCalled(); expect(h.session).not.toHaveBeenCalled(); expect(h.accept).not.toHaveBeenCalled();
  let turns = render().filter(node => node.type === 'section' && String(node.props['aria-label']).endsWith('번째 질문과 답변'));
  expect(turns).toHaveLength(1);
  expect(render().some(node => typeof node.props.text === 'string' && node.props.text.includes('안녕하세요, 주비예요.'))).toBe(true);
  expect(text(turns[0].props.children)).toContain('질문 횟수는 쓰지 않았어요');
  expect(text(turns[0].props.children)).not.toContain('답변에 제공한 자료');
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('');
  // The first real question still needs the explicit consent button.
  expect(render().some(node => node.type === 'button' && text(node.props.children) === '물어보기')).toBe(true);

  fill('마이크론을 쉽게 설명해주세요'); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(1));
  fill('ㅇㅇ 알겠어 고마워'); submit();
  fill('그럼 메모리는 뭐야?'); submit();
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(2));
  expect(h.fetch).toHaveBeenCalledTimes(2);
  // Local turns stay visible but are never sent as conversation history.
  const payload = JSON.parse(h.fetch.mock.calls[1][1].body);
  expect(payload.questionHistory.map((item: { question: string }) => item.question)).toEqual(['마이크론을 쉽게 설명해주세요']);
  turns = render().filter(node => node.type === 'section' && String(node.props['aria-label']).endsWith('번째 질문과 답변'));
  expect(turns).toHaveLength(4);
});

it('sends a one-word reply to the server when Joobi has just asked something, instead of a canned reply', async () => {
  h.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, report: { currentStatus: '더 사면 한 종목에 묶이는 돈이 늘어요. 이 돈을 1년 안에 써야 하나요?', keyAdvice: [], conclusion: { desc: '' } } }) });
  fill('지금 더 사도 될까요?'); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(1));
  // "네" is the answer to Joobi's question: one character is enough here, and it is a real turn with history.
  fill('네');
  expect(render().find(node => node.type === 'button' && node.props['aria-label'] === '질문 보내기')!.props.disabled).toBe(false);
  submit();
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(2));
  const payload = JSON.parse(h.fetch.mock.calls[1][1].body);
  expect(payload.questionText).toBe('네');
  expect(payload.questionHistory.map((item: { question: string }) => item.question)).toEqual(['지금 더 사도 될까요?']);
  // After an answer that asks nothing, the same word is small talk again and costs nothing.
  fill('네'); submit();
  expect(h.fetch).toHaveBeenCalledTimes(2);
  expect(render().some(node => typeof node.props.text === 'string' && node.props.text.includes('더 궁금한 점이 생기면'))).toBe(true);
  // A puzzled "네?" is not an acknowledgement.
  fill('네?'); submit();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(3));
});

it('treats a greeting followed by a real question as a question', () => {
  fill('안녕! 주식 처음인데 뭐부터 하면 돼?'); submit();
  expect(render().filter(node => node.type === 'section')).toHaveLength(0);
  expect(render().find(node => node.type === 'textarea')!.props.value).toBe('안녕! 주식 처음인데 뭐부터 하면 돼?');
});

it('keeps the price move it showed while waiting at the top of the answer, and does not repeat it on the next turn', async () => {
  const preview = { day: '2026-11-10', baselineDay: '2026-11-03', sessionState: 'closed', prices: [{ symbol: 'MU', label: '마이크론', changePercent: -3.2 }, { symbol: '^GSPC', label: '미국 대형주 시장(S&P 500)', changePercent: -0.4 }] };
  const stream = () => new Response([{ type: 'stage', stage: 'sources' }, { type: 'preview', preview }, { type: 'result', status: 200, body: { success: true, report: { currentStatus: '시험용 설명', keyAdvice: [], conclusion: { desc: '시험용 결론' } } } }]
    .map(line => JSON.stringify(line)).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
  h.fetch.mockImplementation(async () => stream());
  fill('마이크론은 왜 떨어졌어요?'); click('물어보기');
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(1));
  const strips = () => render().filter(node => (node.props.preview as { prices?: unknown[] } | undefined)?.prices?.length === 2);
  expect(strips()).toHaveLength(1);
  // The same numbers are already visible in the answer above.
  fill('그게 왜 중요해요?'); submit();
  await vi.waitFor(() => expect(h.accept).toHaveBeenCalledTimes(2));
  expect(strips()).toHaveLength(1);
});
