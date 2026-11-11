export const JOOBI_STAGES = {
  checking: '질문을 보낼 준비를 하고 있어요',
  sources: '종목과 시장 자료를 확인하고 있어요',
  articles: '관련 보도를 읽고 있어요',
  supplement: '빠진 배경을 더 찾아보고 있어요',
  writing: '자료를 연결해 설명을 정리하고 있어요',
  validating: '답변과 근거를 확인하고 있어요',
} as const;
export type JoobiStage = keyof typeof JOOBI_STAGES;
export type JoobiProgress = (stage: JoobiStage) => void;

/** 설명을 쓰는 동안 먼저 보여주는 가격 비교. 서버가 받은 가격 자료만 싣고, 모델이 쓴 글은 싣지 않는다. */
export interface JoobiPricePreview {
  day: string; baselineDay: string; sessionState?: 'intraday' | 'closed' | 'unknown';
  prices: { symbol: string; label: string; changePercent: number }[];
}
export type JoobiPreview = (preview: JoobiPricePreview) => void;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 화면에 그리기 전에 모양을 다시 확인한다. 어긋난 자료는 보여주지 않는다. */
export function parseJoobiPricePreview(value: unknown): JoobiPricePreview | null {
  const preview = value as Partial<JoobiPricePreview> | null;
  if (!preview || typeof preview !== 'object' || typeof preview.day !== 'string' || !DAY.test(preview.day) || typeof preview.baselineDay !== 'string' || !DAY.test(preview.baselineDay)
    || !Array.isArray(preview.prices) || preview.prices.length < 1 || preview.prices.length > 4) return null;
  if (preview.sessionState !== undefined && !['intraday', 'closed', 'unknown'].includes(preview.sessionState)) return null;
  const prices = preview.prices.map(price => price && typeof price.symbol === 'string' && price.symbol.length <= 32 && typeof price.label === 'string' && price.label.trim().length > 0 && price.label.length <= 60
    && typeof price.changePercent === 'number' && Number.isFinite(price.changePercent) && Math.abs(price.changePercent) <= 1000
    ? { symbol: price.symbol, label: price.label, changePercent: price.changePercent } : null);
  if (prices.some(price => !price) || new Set(prices.map(price => price!.symbol)).size !== prices.length) return null;
  return { day: preview.day, baselineDay: preview.baselineDay, ...(preview.sessionState ? { sessionState: preview.sessionState } : {}), prices: prices as JoobiPricePreview['prices'] };
}
/** Stream real server stages, then one validated result. No unvalidated model text. */
export function joobiProgressResponse(run: (progress: JoobiProgress, preview: JoobiPreview) => Promise<Response>) {
  const encoder = new TextEncoder(); let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')); };
      const started = performance.now(), stages: { stage: JoobiStage; atMs: number }[] = [];
      try {
        const response = await run(stage => { stages.push({ stage, atMs: Math.round(performance.now() - started) }); send({ type: 'stage', stage }); },
          preview => send({ type: 'preview', preview }));
        const body = await response.json();
        send({ type: 'result', status: response.status, body });
        console.info('[joobi-timing]', JSON.stringify({ status: response.status, code: typeof body.code === 'string' ? body.code : undefined, totalMs: Math.round(performance.now() - started), stages }));
      } catch {
        send({ type: 'result', status: 500, body: { success: false, error: '답변 연결에 문제가 생겼어요. 질문은 그대로 남겨뒀어요.' } });
      } finally { if (!closed) { closed = true; controller.close(); } }
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
