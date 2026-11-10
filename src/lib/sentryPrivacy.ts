import type { BrowserOptions, ErrorEvent, EventHint, StackFrame } from '@sentry/nextjs';

const SAFE_ERROR_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'URIError', 'AggregateError', 'DOMException', 'PortfolioVaultError',
]);
const VAULT_CODES = new Set([
  'crypto_unavailable', 'invalid_context', 'invalid_key', 'invalid_record',
  'invalid_unlock_material', 'payload_too_large', 'cannot_unlock', 'cannot_encrypt', 'cannot_decrypt',
]);
const OMITTED = 'Details omitted for privacy';

/** Keep source locations, never frame variables, source context, URL queries or arbitrary paths. */
function sourceLocation(filename: string | undefined): string | undefined {
  if (typeof filename !== 'string' || filename.length > 1500) return undefined;
  const clean = filename.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const marker = clean.match(/(?:^|\/)((?:_next\/static|\.next\/(?:server|static)|src)\/[A-Za-z0-9_./()-]+\.(?:js|mjs|ts|tsx))$/);
  if (marker && !marker[1].split('/').includes('..')) return `app:///${marker[1]}`;
  if (/^node:[A-Za-z0-9_./-]+$/.test(clean)) return clean;
  return undefined;
}

function safeFrame(frame: StackFrame): StackFrame {
  return {
    filename: sourceLocation(frame.filename),
    lineno: Number.isSafeInteger(frame.lineno) && frame.lineno! > 0 ? frame.lineno : undefined,
    colno: Number.isSafeInteger(frame.colno) && frame.colno! >= 0 ? frame.colno : undefined,
    in_app: typeof frame.in_app === 'boolean' ? frame.in_app : undefined,
  };
}

/** Last outbound error boundary: allowlist instead of trying to recognize every private value.
 * This intentionally removes free-text messages and breadcrumbs, reducing diagnostic detail.
 * It does not govern Vercel/Supabase logs or any other delivery provider.
 */
export function privateSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  // Attachments are enveloped separately from the event body.
  if (hint) hint.attachments = [];
  return {
    type: undefined,
    event_id: /^[a-f0-9]{32}$/i.test(event.event_id ?? '') ? event.event_id : undefined,
    timestamp: typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? event.timestamp : undefined,
    level: event.level === 'fatal' ? 'fatal' : 'error',
    platform: 'javascript',
    environment: ['development', 'preview', 'production', 'test'].includes(event.environment ?? '') ? event.environment : undefined,
    release: /^[a-f0-9]{7,64}$/i.test(event.release ?? '') ? event.release : undefined,
    message: OMITTED,
    exception: event.exception ? {
      values: event.exception.values?.slice(0, 5).map(exception => ({
        type: SAFE_ERROR_TYPES.has(exception.type ?? '') ? exception.type : 'Error',
        value: exception.type === 'PortfolioVaultError' && VAULT_CODES.has(exception.value ?? '')
          ? exception.value : OMITTED,
        stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.slice(-50).map(safeFrame) } : undefined,
      })),
    } : undefined,
  };
}

const PRIVATE_DATA_COLLECTION: NonNullable<BrowserOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

/** Installed SDK dataCollection options; beforeSend also drops explicitly attached data. */
export const SENTRY_PRIVACY_OPTIONS = {
  dataCollection: PRIVATE_DATA_COLLECTION,
  tracesSampleRate: 0,
  enableLogs: false,
  enableMetrics: false,
  beforeBreadcrumb: () => null,
  beforeSend: privateSentryEvent,
  beforeSendTransaction: () => null,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
} as const;
