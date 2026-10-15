/** A usable answer must match the UI contract before it can consume daily usage. */
export class InvalidAnalysisResponse extends Error {
  constructor() { super('invalid_ai_response'); }
}

const text = { type: 'string' };
const signal = { type: 'string', enum: ['neutral', 'positive', 'negative'] };
const news = { type: 'array', maxItems: 3, items: {
  type: 'object', required: ['headline', 'impact'], additionalProperties: false,
  properties: { headline: text, impact: text },
} };

export function analysisResponseSchema(mentor: boolean) {
  return {
    type: 'object', additionalProperties: false,
    required: ['currentStatus', 'conclusion', mentor ? 'keyAdvice' : 'indicators'],
    properties: {
      currentStatus: text,
      conclusion: { type: 'object', required: ['label', 'signal', 'desc'], additionalProperties: false,
        properties: { label: text, signal, desc: text } },
      newsAnalysis: news, newsContext: text,
      ...(mentor ? { keyAdvice: { type: 'array', minItems: 1, maxItems: 5, items: text }, quote: text }
        : { indicators: { type: 'array', minItems: 1, maxItems: 8, items: {
          type: 'object', required: ['name', 'value', 'signal'], additionalProperties: false,
          properties: { name: text, value: text, signal },
        } }, historicalNote: text }),
    },
  };
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const readable = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 12000;
const validSignal = (value: unknown) => ['neutral', 'positive', 'negative'].includes(String(value));

export function parseAnalysisResponse(raw: string, mentor: boolean, finishReason?: string): Record<string, unknown> {
  if (finishReason && finishReason !== 'STOP') throw new InvalidAnalysisResponse();
  // Accept a complete markdown wrapper, but never salvage fragments or truncated JSON.
  const source = raw.replace(/^\uFEFF/, '').trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new InvalidAnalysisResponse(); }
  if (!object(value) || !readable(value.currentStatus) || !object(value.conclusion)
    || !readable(value.conclusion.label) || !readable(value.conclusion.desc) || !validSignal(value.conclusion.signal)) throw new InvalidAnalysisResponse();
  if (mentor) {
    if (!Array.isArray(value.keyAdvice) || value.keyAdvice.length < 1 || value.keyAdvice.length > 5 || !value.keyAdvice.every(readable)) throw new InvalidAnalysisResponse();
  } else if (!Array.isArray(value.indicators) || value.indicators.length < 1 || value.indicators.length > 8
    || !value.indicators.every(item => object(item) && readable(item.name) && readable(item.value) && validSignal(item.signal))) throw new InvalidAnalysisResponse();
  if (value.newsAnalysis !== undefined && (!Array.isArray(value.newsAnalysis) || value.newsAnalysis.length > 3
    || !value.newsAnalysis.every(item => object(item) && readable(item.headline) && readable(item.impact)))) throw new InvalidAnalysisResponse();
  for (const field of ['newsContext', 'quote', 'historicalNote']) {
    if (value[field] !== undefined && !readable(value[field])) throw new InvalidAnalysisResponse();
  }
  // Only fields rendered by the report are accepted; legacy scores/unknown payloads never escape.
  const fields = ['currentStatus', 'conclusion', 'newsAnalysis', 'newsContext', ...(mentor ? ['keyAdvice', 'quote'] : ['indicators', 'historicalNote'])];
  return Object.fromEntries(fields.filter(field => value[field] !== undefined).map(field => [field, value[field]]));
}
