import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { privateSentryEvent, SENTRY_PRIVACY_OPTIONS } from '@/lib/sentryPrivacy';

const sensitive = 'private-fixture@example.test';
function event(): ErrorEvent {
  return {
    type: undefined, event_id: 'a'.repeat(32), timestamp: 100,
    release: 'c'.repeat(40), environment: 'production',
    user: { id: 'private-fixture-user', email: sensitive, ip_address: '192.0.2.1' },
    request: { url: `https://example.invalid/?token=${sensitive}`, headers: { authorization: sensitive },
      cookies: { session: sensitive }, data: { stocks: [{ shares: 123, note: sensitive }] } },
    message: sensitive, logentry: { message: sensitive, params: [sensitive] },
    breadcrumbs: [{ category: 'console', message: sensitive, data: { value: sensitive } }],
    contexts: { privateData: { note: sensitive } }, extra: { privateData: sensitive },
    tags: { privateData: sensitive }, fingerprint: [sensitive], transaction: sensitive,
    exception: { values: [{ type: 'TypeError', value: sensitive, mechanism: { type: sensitive, handled: true },
      stacktrace: { frames: [{ filename: `https://joobi.kr/_next/static/chunks/fixture.js?token=${sensitive}`,
        lineno: 12, colno: 3, in_app: true, function: sensitive, vars: { value: sensitive },
        pre_context: [sensitive], context_line: sensitive, post_context: [sensitive], module_metadata: { value: sensitive } }] } }] },
  };
}

describe('Sentry outgoing privacy boundary', () => {
  it('retains safe source location while excluding identity, payloads and free text', () => {
    const source = event();
    const hint: EventHint = { attachments: [{ filename: 'private.txt', data: sensitive }] };
    const filtered = privateSentryEvent(source, hint);
    expect(JSON.stringify(filtered)).not.toContain(sensitive);
    expect(JSON.stringify(filtered)).not.toContain('private-fixture-user');
    expect(JSON.stringify(filtered)).not.toContain('192.0.2.1');
    expect(filtered.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
      filename: 'app:///_next/static/chunks/fixture.js', lineno: 12, colno: 3, in_app: true,
    });
    expect(filtered.release).toBe('c'.repeat(40));
    expect(hint.attachments).toEqual([]);
    expect(source.user?.email).toBe(sensitive);
  });

  it('does not forward unknown metadata and unsafe source paths', () => {
    const source = event();
    source.exception!.values![0].type = sensitive;
    source.exception!.values![0].stacktrace!.frames![0].filename = `https://example.invalid/users/${sensitive}.js`;
    source.environment = sensitive;
    source.release = sensitive;
    source.event_id = sensitive;
    const filtered = privateSentryEvent({ ...source, arbitrary: sensitive } as ErrorEvent);
    expect(JSON.stringify(filtered)).not.toContain(sensitive);
    expect(filtered.exception?.values?.[0].type).toBe('Error');
    expect(filtered.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBeUndefined();
  });

  it('preserves only enumerated vault error codes', () => {
    const source = event();
    source.exception!.values![0].type = 'PortfolioVaultError';
    source.exception!.values![0].value = 'cannot_decrypt';
    expect(privateSentryEvent(source).exception?.values?.[0].value).toBe('cannot_decrypt');
    source.exception!.values![0].value = sensitive;
    expect(JSON.stringify(privateSentryEvent(source))).not.toContain(sensitive);
  });

  it('drops breadcrumbs, transaction, SDK logs and metrics', () => {
    expect(SENTRY_PRIVACY_OPTIONS.beforeBreadcrumb()).toBeNull();
    expect(SENTRY_PRIVACY_OPTIONS.beforeSendTransaction()).toBeNull();
    expect(SENTRY_PRIVACY_OPTIONS.beforeSendLog()).toBeNull();
    expect(SENTRY_PRIVACY_OPTIONS.beforeSendMetric()).toBeNull();
  });

  it('filters a real SDK envelope, including separately attached files, without network delivery', async () => {
    const deliveries: unknown[] = [];
    Sentry.init({
      ...SENTRY_PRIVACY_OPTIONS, dsn: 'https://public@example.invalid/1', defaultIntegrations: false,
      transport: () => ({
        send: async (envelope: unknown) => { deliveries.push(envelope); return {}; },
        flush: async () => true,
      }),
    });
    try {
      Sentry.withScope(scope => {
        scope.setUser({ id: 'private-fixture-user', email: sensitive });
        scope.setExtra('private-fixture', sensitive);
        scope.addAttachment({ filename: 'scope-private.txt', data: sensitive });
        Sentry.captureEvent(event(), { attachments: [{ filename: 'private.txt', data: sensitive }] });
      });
      await Sentry.flush(1000);
      expect(deliveries).toHaveLength(1);
      const wire = JSON.stringify(deliveries);
      expect(wire).not.toContain(sensitive);
      expect(wire).not.toContain('private.txt');
      expect(wire).not.toContain('scope-private.txt');
      expect(wire).not.toContain('private-fixture-user');
      expect(wire).toContain('fixture.js');
    } finally { await Sentry.close(1000); }
  });
});
