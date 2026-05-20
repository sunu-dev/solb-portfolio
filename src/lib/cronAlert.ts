/**
 * Cron 실패 알림 SSOT.
 *
 * Vercel Cron이 실패하면 invocation log에만 남고 운영자에게 푸시 안 됨 → 새벽 cron 죽으면
 * 다음날 정오까지 모를 위험. 이 모듈로 모든 cron의 catch 블록·실패 경로에서 Slack 알림.
 *
 * 환경변수:
 * - SLACK_WEBHOOK_CRON (권장): cron 전용 채널
 * - SLACK_WEBHOOK_URL (fallback): 단일 webhook
 *
 * 미설정 환경(베타 초기)에선 console.error만 — Sentry로 자동 캡쳐됨.
 */

const WEBHOOK = process.env.SLACK_WEBHOOK_CRON || process.env.SLACK_WEBHOOK_URL || '';

export interface CronAlertOptions {
  /** cron job 이름 (e.g. 'check-alerts', 'morning-brief') */
  jobName: string;
  /** 실패 단계 (e.g. 'fetch-prices', 'push-send', 'db-write') */
  stage?: string;
  /** 에러 객체 또는 메시지 */
  error: unknown;
  /** 추가 컨텍스트 (jsonb) */
  context?: Record<string, unknown>;
  /** 알림 심각도 */
  level?: 'info' | 'warn' | 'error';
}

/**
 * Cron 실패/이상 상황 알림.
 * Slack webhook 미설정 시 console.error로만 (Sentry 자동 캡쳐).
 */
export async function sendCronAlert(opts: CronAlertOptions): Promise<void> {
  const { jobName, stage, error, context, level = 'error' } = opts;
  const errMsg = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined;

  const emoji = level === 'error' ? '🚨' : level === 'warn' ? '⚠️' : 'ℹ️';
  const title = `${emoji} cron ${jobName}${stage ? ` (${stage})` : ''} ${level === 'error' ? '실패' : level === 'warn' ? '경고' : '안내'}`;

  // 항상 console에 기록 (Sentry 자동 캡쳐 channel)
  console.error(`[cron/${jobName}]${stage ? `[${stage}]` : ''}`, errMsg, context || '');

  if (!WEBHOOK) return;

  try {
    const lines: string[] = [`*${title}*`, '```' + errMsg + '```'];
    if (errStack) lines.push('```' + errStack + '```');
    if (context && Object.keys(context).length > 0) {
      lines.push('컨텍스트:');
      lines.push('```' + JSON.stringify(context, null, 2).slice(0, 800) + '```');
    }
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* webhook 실패 자체는 silent — 다른 채널(Sentry)에 이미 기록됨 */
  }
}

/**
 * 정보성 알림 (cron 성공 후 결과 요약 등). 기본 level=info.
 */
export async function sendCronInfo(jobName: string, message: string, context?: Record<string, unknown>): Promise<void> {
  console.info(`[cron/${jobName}] ${message}`, context || '');
  if (!WEBHOOK) return;
  try {
    const lines: string[] = [`*ℹ️ cron ${jobName}*`, message];
    if (context && Object.keys(context).length > 0) {
      lines.push('```' + JSON.stringify(context, null, 2).slice(0, 600) + '```');
    }
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* silent */
  }
}
