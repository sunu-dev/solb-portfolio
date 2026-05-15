import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    'Load failed',
    'AbortError',
  ],
});
