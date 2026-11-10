import * as Sentry from '@sentry/nextjs';
import { SENTRY_PRIVACY_OPTIONS } from './src/lib/sentryPrivacy';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  ...SENTRY_PRIVACY_OPTIONS,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    'Load failed',
    'AbortError',
  ],
});
