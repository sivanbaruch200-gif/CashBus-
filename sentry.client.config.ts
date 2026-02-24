import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of sessions for performance monitoring (keeps quota low)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Replay 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production to avoid noise in dev
  enabled: process.env.NODE_ENV === 'production',

  integrations: [
    Sentry.replayIntegration(),
  ],
})
