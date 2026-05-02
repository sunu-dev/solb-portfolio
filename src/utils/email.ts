/**
 * 이메일 송신 wrapper (Resend)
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §4 (컴플라이언스 면책 강제) + §7 (백업 채널)
 *
 * 환경변수:
 *   RESEND_API_KEY  — Resend API 키
 *   EMAIL_FROM      — 발신자 (예: "주비 <noreply@solb.kr>")
 *
 * 사용처:
 *   - 모닝브리프 cron (push 미구독 유저 fallback)
 *   - 향후 월말 D-3 리마인더, 알림 다이제스트
 */

import { DISCLAIMER } from '@/utils/alertCompliance';
import { buildUnsubUrl, type UnsubKind } from '@/utils/unsubscribeToken';

interface SendEmailOpts {
  to: string;
  subject: string;
  /** plain text body — html은 자동 생성 */
  text: string;
  /** html 직접 지정 (text와 동시 지정 가능) */
  html?: string;
  /** 컴플라이언스 면책 자동 첨부 여부 (기본 true) */
  appendDisclaimer?: boolean;
  /** RFC 8058 1-click unsubscribe — 모든 마케팅성 메일에 강제 권장 */
  unsubscribe?: {
    userId: string;
    kind: UnsubKind;
  };
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Resend 통한 이메일 송신.
 * 환경변수 미설정 시 noop + 경고 (배포 환경 따라 RESEND_API_KEY 미설정 가능).
 */
export async function sendEmail(opts: SendEmailOpts): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || '주비 <noreply@solb.kr>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY 미설정 — 송신 skip:', opts.subject);
    return { ok: false, error: 'no_api_key' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb-portfolio.vercel.app';
  const unsubUrl = opts.unsubscribe
    ? buildUnsubUrl({ appUrl, userId: opts.unsubscribe.userId, kind: opts.unsubscribe.kind })
    : null;

  const appendDisclaimer = opts.appendDisclaimer !== false;
  const footerText = [
    appendDisclaimer ? DISCLAIMER : '',
    unsubUrl ? `이 알림 그만 받기: ${unsubUrl}` : '',
  ].filter(Boolean).join('\n');
  const textBody = footerText
    ? `${opts.text}\n\n---\n${footerText}`
    : opts.text;

  const footerHtml = [
    appendDisclaimer
      ? `<p style="font-size:11px;color:#8B95A1;line-height:1.5;margin:0 0 8px">${DISCLAIMER}</p>`
      : '',
    unsubUrl
      ? `<p style="font-size:11px;line-height:1.5;margin:0"><a href="${unsubUrl}" style="color:#8B95A1;text-decoration:underline">이 알림 그만 받기</a></p>`
      : '',
  ].filter(Boolean).join('');
  const htmlBody = opts.html
    ? (footerHtml ? `${opts.html}<hr style="margin:24px 0;border:0;border-top:1px solid #E5E8EB">${footerHtml}` : opts.html)
    : `<pre style="font-family:Pretendard,system-ui,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${textBody}</pre>`;

  // RFC 8058 — List-Unsubscribe + List-Unsubscribe-Post 헤더로 메일 클라이언트 1-click
  const headers: Record<string, string> = {};
  if (unsubUrl) {
    headers['List-Unsubscribe'] = `<${unsubUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: textBody,
        html: htmlBody,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      }),
    });
    const json = await res.json() as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: json.message || `http_${res.status}` };
    }
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
