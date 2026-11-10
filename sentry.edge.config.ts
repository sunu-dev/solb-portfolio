import * as Sentry from '@sentry/nextjs';
import { SENTRY_PRIVACY_OPTIONS } from './src/lib/sentryPrivacy';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  ...SENTRY_PRIVACY_OPTIONS,
  environment: process.env.VERCEL_ENV || 'development',
});
