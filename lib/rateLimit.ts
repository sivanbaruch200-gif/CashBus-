/**
 * lib/rateLimit.ts
 *
 * Simple in-memory sliding-window rate limiter for Next.js API routes.
 *
 * ⚠️  IMPORTANT – Vercel/serverless caveat:
 *   Each serverless function instance has its own memory.
 *   Under high concurrency, multiple warm instances run in parallel with
 *   separate counters. This still protects against burst abuse within a
 *   single instance (the common case) but is NOT a fully distributed limiter.
 *   For stricter enforcement at scale, replace the store with Upstash Redis:
 *   https://docs.upstash.com/redis/sdks/ratelimit-ts/overview
 *
 * Usage:
 *   const result = rateLimit(`daily-login:${userId}`, RATE_LIMITS.dailyLogin)
 *   if (!result.success) return rateLimitResponse(result)
 */

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WindowRecord {
  count: number
  windowStart: number
}

export interface RateLimitConfig {
  /** How long the window lasts in milliseconds */
  windowMs: number
  /** Maximum requests allowed within the window */
  maxRequests: number
}

export interface RateLimitResult {
  success: boolean
  /** Requests remaining in the current window */
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  resetAt: number
  /** Total allowed requests per window */
  limit: number
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const store = new Map<string, WindowRecord>()

// Prune stale entries every 10 minutes to prevent unbounded memory growth.
// The interval keeps running in the background; on Vercel, the instance may
// be recycled before it fires (which is fine – memory is freed on eviction).
const PRUNE_INTERVAL_MS = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, rec] of store.entries()) {
    // Remove any record whose window expired more than 1 hour ago
    if (now - rec.windowStart > 60 * 60 * 1000) {
      store.delete(key)
    }
  }
}, PRUNE_INTERVAL_MS)

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  // Start a new window if none exists or the previous window has expired
  if (!existing || now - existing.windowStart >= config.windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
    }
  }

  // Increment counter within the current window
  existing.count += 1
  const remaining = Math.max(0, config.maxRequests - existing.count)

  return {
    success: existing.count <= config.maxRequests,
    remaining,
    resetAt: existing.windowStart + config.windowMs,
    limit: config.maxRequests,
  }
}

// ---------------------------------------------------------------------------
// Preset configs per endpoint
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  /**
   * Daily-login: users call this once per page load to claim their daily reward.
   * Allow a few retries per minute per user, but block hammering.
   */
  dailyLogin: { windowMs: 60_000, maxRequests: 10 } satisfies RateLimitConfig,

  /**
   * Create-subscription: Stripe Checkout sessions cost money and expose billing.
   * Very strict per-user limit.
   */
  createSubscription: { windowMs: 5 * 60_000, maxRequests: 5 } satisfies RateLimitConfig,

  /**
   * Send-legal-email: each email costs Resend quota and has real-world effect.
   * Allow a small burst to handle legitimate retries, then block hard.
   */
  sendLegalEmail: { windowMs: 5 * 60_000, maxRequests: 5 } satisfies RateLimitConfig,

  /**
   * Submit-web-form: external form automation; stub for now but protect anyway.
   */
  submitWebForm: { windowMs: 10 * 60_000, maxRequests: 5 } satisfies RateLimitConfig,

  /**
   * IP-level guard applied before user auth is resolved.
   * Looser than per-user limits to avoid false positives on shared IPs
   * (offices, schools, NAT).
   */
  ipBurst: { windowMs: 60_000, maxRequests: 30 } satisfies RateLimitConfig,
} as const

// ---------------------------------------------------------------------------
// Helper: extract client IP from Next.js request
// ---------------------------------------------------------------------------

export function getClientIP(request: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to x-real-ip
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

// ---------------------------------------------------------------------------
// Helper: build a standard 429 Too Many Requests response
// ---------------------------------------------------------------------------

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil((result.resetAt - Date.now()) / 1000)

  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(retryAfterSec),
      },
    }
  )
}
