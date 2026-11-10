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
/** Stream real server stages, then one validated result. No unvalidated model text. */
export function joobiProgressResponse(run: (progress: JoobiProgress) => Promise<Response>) {
  const encoder = new TextEncoder(); let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')); };
      const started = performance.now(), stages: { stage: JoobiStage; atMs: number }[] = [];
      try {
        const response = await run(stage => { stages.push({ stage, atMs: Math.round(performance.now() - started) }); send({ type: 'stage', stage }); });
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
