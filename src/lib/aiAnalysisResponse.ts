import { CHART_VIEWS, type ChartView } from './chartTechnicalContext';
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

export function analysisResponseSchema(mentor: boolean, questionAnswer = false, chart = false, assistant = false) {
  if (assistant) return {
    type: 'object', additionalProperties: false, required: ['currentStatus', 'keyAdvice', 'assistantInsights', 'followUps'],
    properties: {
      currentStatus: text, keyAdvice: { type: 'array', maxItems: 1, items: text },
      assistantInsights: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false,
        required: ['kind', 'text', 'evidenceIds'], properties: { kind: { type: 'string', enum: ['observation', 'interpretation'] }, text,
          evidenceIds: { type: 'array', minItems: 1, maxItems: 3, items: text } } } },
      followUps: { type: 'array', minItems: 2, maxItems: 2, items: text },
    },
  };
  if (chart) return {
    type: 'object', additionalProperties: false, required: ['currentStatus', 'chartViews', 'conclusion'],
    properties: {
      currentStatus: text,
      chartViews: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'object', additionalProperties: false,
        required: ['view', 'title', 'meaning', 'watchNext'], properties: { view: { type: 'string', enum: [...CHART_VIEWS] }, title: text, meaning: text, watchNext: text } } },
      conclusion: { type: 'object', required: ['label', 'signal', 'desc'], additionalProperties: false, properties: { label: text, signal: { type: 'string', enum: ['neutral'] }, desc: text } },
    },
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['currentStatus', 'conclusion', mentor ? 'keyAdvice' : 'indicators', ...(assistant ? ['assistantInsights', 'followUps'] : [])],
    properties: {
      currentStatus: text,
      conclusion: { type: 'object', required: ['label', 'signal', 'desc'], additionalProperties: false,
        properties: { label: text, signal, desc: text } },
      newsAnalysis: news, ...(!assistant ? { newsContext: text } : {}),
      ...(assistant ? {
        assistantInsights: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['kind', 'text', 'evidenceIds'], properties: {
          kind: { type: 'string', enum: ['observation', 'interpretation'] }, text, evidenceIds: { type: 'array', minItems: 1, maxItems: 3, items: text },
        } } }, followUps: { type: 'array', minItems: 2, maxItems: 2, items: text },
      } : {}),
      ...(mentor ? { keyAdvice: { type: 'array', minItems: assistant ? 0 : 1, maxItems: 5, items: text }, ...(!questionAnswer ? { quote: text } : {}) }
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

export function parseAnalysisResponse(raw: string, mentor: boolean, finishReason?: string, allowedChartViews?: readonly ChartView[], assistant = false): Record<string, unknown> {
  if (finishReason && finishReason !== 'STOP') throw new InvalidAnalysisResponse();
  // Accept a complete markdown wrapper, but never salvage fragments or truncated JSON.
  const source = raw.replace(/^\uFEFF/, '').trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new InvalidAnalysisResponse(); }
  if (assistant && object(value)) value.conclusion = { label: '이어서 알아보기', signal: 'neutral', desc: '표시한 출처에서 자료의 시점과 범위를 확인할 수 있어요.' };
  if (!object(value) || !readable(value.currentStatus) || !object(value.conclusion)
    || !readable(value.conclusion.label) || !readable(value.conclusion.desc) || !validSignal(value.conclusion.signal)) throw new InvalidAnalysisResponse();
  if (allowedChartViews) {
    const views = value.chartViews;
    if (value.currentStatus.length > 320 || value.conclusion.signal !== 'neutral' || !Array.isArray(views) || views.length < 2 || views.length > 3
      || !views.every(item => object(item) && allowedChartViews.includes(item.view as ChartView)
        && ['title', 'meaning', 'watchNext'].every(key => readable(item[key]) && (item[key] as string).length <= (key === 'title' ? 60 : 260)))
      || new Set(views.map(item => item.view)).size !== views.length) throw new InvalidAnalysisResponse();
    return { currentStatus: value.currentStatus, chartViews: views.map(item => Object.fromEntries(['view', 'title', 'meaning', 'watchNext'].map(key => [key, item[key]]))), conclusion: value.conclusion };
  }
  if (mentor) {
    if (!Array.isArray(value.keyAdvice) || value.keyAdvice.length < (assistant ? 0 : 1) || value.keyAdvice.length > 5 || !value.keyAdvice.every(readable)) throw new InvalidAnalysisResponse();
  } else if (!Array.isArray(value.indicators) || value.indicators.length < 1 || value.indicators.length > 8
    || !value.indicators.every(item => object(item) && readable(item.name) && readable(item.value) && validSignal(item.signal))) throw new InvalidAnalysisResponse();
  if (value.newsAnalysis !== undefined && (!Array.isArray(value.newsAnalysis) || value.newsAnalysis.length > 3
    || !value.newsAnalysis.every(item => object(item) && readable(item.headline) && readable(item.impact)))) throw new InvalidAnalysisResponse();
  for (const field of ['newsContext', 'quote', 'historicalNote']) {
    if (value[field] !== undefined && !readable(value[field])) throw new InvalidAnalysisResponse();
  }
  // Only fields rendered by the report are accepted; legacy scores/unknown payloads never escape.
  const fields = [...(assistant ? ['assistantInsights', 'followUps'] : []), 'currentStatus', 'conclusion', 'newsAnalysis', 'newsContext', ...(mentor ? ['keyAdvice', 'quote'] : ['indicators', 'historicalNote'])];
  return Object.fromEntries(fields.filter(field => value[field] !== undefined).map(field => [field, value[field]]));
}
