/**
 * 통합 AI 프로바이더 추상화 — Gemini(primary) → Claude Haiku(fallback)
 *
 * 동작:
 *   1. Gemini 키로 시도 (여러 키 로테이션)
 *   2. Gemini 할당량 소진·503 감지 시 Claude Haiku fallback
 *   3. 두 프로바이더 모두 실패하면 throw
 *
 * 환경변수:
 *   GEMINI_API_KEY, GEMINI_API_KEY_2 — Gemini 키
 *   ANTHROPIC_API_KEY — Claude 키 (없으면 fallback 비활성)
 */

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

// ─── 설정 ────────────────────────────────────────────────────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter(Boolean) as string[];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const claudeClient = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// ─── 타입 ────────────────────────────────────────────────────────────────────
export interface AiJsonOptions {
  /** 사용자 프롬프트 */
  prompt: string;
  /** (옵션) 시스템 프롬프트 — Claude에서 prompt caching 대상 */
  systemPrompt?: string;
  /** 0~1, 기본 0.7 */
  temperature?: number;
  /** 기본 4096 */
  maxTokens?: number;
  /** Gemini 모델 (기본 gemini-2.5-flash-lite) */
  geminiModel?: string;
}

export interface AiJsonResult {
  /** 응답 JSON 텍스트 (파싱 전) */
  text: string;
  /** 실제로 응답한 프로바이더 */
  provider: 'gemini' | 'claude';
  /** 사용된 모델 식별자 */
  model: string;
  /** 응답 시간 (ms) */
  latencyMs: number;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public code: 'no_provider' | 'all_failed' | 'quota' | 'parse',
    public causes: Array<{ provider: string; message: string }>,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

// ─── 헬퍼: Gemini 에러 분류 ──────────────────────────────────────────────────
function isGeminiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
}

function stripMarkdownCodeBlock(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

// ─── Gemini 호출 ─────────────────────────────────────────────────────────────
async function callGemini(opts: AiJsonOptions): Promise<AiJsonResult> {
  const started = Date.now();
  if (!GEMINI_KEYS.length) {
    throw new Error('no gemini keys configured');
  }

  const model = opts.geminiModel || 'gemini-2.5-flash-lite';
  const prompt = opts.systemPrompt
    ? `${opts.systemPrompt}\n\n${opts.prompt}`
    : opts.prompt;

  const keys = [...GEMINI_KEYS].sort(() => Math.random() - 0.5);
  let lastError: unknown;

  for (const apiKey of keys) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 4096,
        },
      });

      const raw = response.text || '';
      const text = stripMarkdownCodeBlock(raw);
      if (!text) throw new Error('empty response from Gemini');

      return { text, provider: 'gemini', model, latencyMs: Date.now() - started };
    } catch (e) {
      lastError = e;
      // 할당량 에러는 즉시 Claude로 넘어감 (다음 키도 같은 결과일 확률 높음)
      if (isGeminiQuotaError(e)) break;
      // 다른 에러는 다음 키 시도
      continue;
    }
  }

  throw lastError ?? new Error('gemini unknown error');
}

// ─── Claude 호출 ─────────────────────────────────────────────────────────────
async function callClaude(opts: AiJsonOptions): Promise<AiJsonResult> {
  const started = Date.now();
  if (!claudeClient) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Haiku 4.5: 저비용 fallback에 적합 (빠름, 저렴, JSON 출력 안정)
  const model = 'claude-haiku-4-5';

  // Claude는 JSON 모드를 명시적으로 시스템 프롬프트에서 요구
  const jsonDirective = '\n\nCRITICAL: Your entire response MUST be valid JSON only. No markdown code blocks, no prose, no explanation. Start directly with { or [ and end with } or ].';
  const systemContent: Anthropic.TextBlockParam[] = opts.systemPrompt
    ? [
        // 시스템 프롬프트가 크면 prompt caching (5분 TTL) — 재호출 시 ~90% 비용 절감
        { type: 'text', text: opts.systemPrompt + jsonDirective, cache_control: { type: 'ephemeral' } },
      ]
    : [{ type: 'text', text: 'You are a helpful assistant. Respond with valid JSON only.' + jsonDirective }];

  const response = await claudeClient.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: systemContent,
    messages: [{ role: 'user', content: opts.prompt }],
  });

  // 첫 text 블록 추출
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  if (!textBlock) {
    throw new Error('no text block in Claude response');
  }

  const text = stripMarkdownCodeBlock(textBlock.text);
  if (!text) throw new Error('empty response from Claude');

  return { text, provider: 'claude', model, latencyMs: Date.now() - started };
}

// ─── 공개 API: JSON 응답 AI 호출 ──────────────────────────────────────────────
/**
 * AI에 프롬프트를 보내 JSON 텍스트를 반환합니다.
 * Gemini가 실패(쿼터/네트워크)하면 자동으로 Claude Haiku로 fallback.
 *
 * @throws AiProviderError 모든 프로바이더 실패 시
 */
export async function callAiJson(opts: AiJsonOptions): Promise<AiJsonResult> {
  const causes: Array<{ provider: string; message: string }> = [];

  // 1. Gemini 시도
  if (GEMINI_KEYS.length) {
    try {
      return await callGemini(opts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      causes.push({ provider: 'gemini', message: msg.slice(0, 200) });
      console.warn('[AI] gemini failed, trying fallback:', msg.slice(0, 120));
    }
  } else {
    causes.push({ provider: 'gemini', message: 'no keys configured' });
  }

  // 2. Claude fallback 시도
  if (claudeClient) {
    try {
      return await callClaude(opts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      causes.push({ provider: 'claude', message: msg.slice(0, 200) });
      console.error('[AI] claude fallback also failed:', msg.slice(0, 120));
    }
  } else {
    causes.push({ provider: 'claude', message: 'ANTHROPIC_API_KEY not set' });
  }

  // 둘 다 실패
  const activeProviders = [
    GEMINI_KEYS.length ? 'gemini' : null,
    claudeClient ? 'claude' : null,
  ].filter(Boolean);

  if (activeProviders.length === 0) {
    throw new AiProviderError('No AI provider configured', 'no_provider', causes);
  }

  throw new AiProviderError('All AI providers failed', 'all_failed', causes);
}

/**
 * 현재 사용 가능한 프로바이더 상태 (관측용)
 */
export function getProviderStatus() {
  return {
    geminiKeys: GEMINI_KEYS.length,
    claudeAvailable: !!claudeClient,
  };
}