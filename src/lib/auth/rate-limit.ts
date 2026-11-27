import 'server-only'

import { createHash } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type RateLimitBucket = 'recovery-email' | 'onboarding' | 'couple-create' | 'couple-regenerate' | 'couple-code' | 'game-start' | 'love-note-send' | 'surprise-send' | 'memory-write' | 'account-delete'

const limits: Record<RateLimitBucket, { requests: number; window: number }> = {
  'recovery-email': { requests: 3, window: 3600 },
  onboarding: { requests: 10, window: 600 },
  'couple-create': { requests: 10, window: 3600 },
  'couple-regenerate': { requests: 15, window: 3600 },
  'couple-code': { requests: 8, window: 3600 },
  'game-start': { requests: 20, window: 3600 },
  'love-note-send': { requests: 10, window: 3600 },
  'surprise-send': { requests: 20, window: 3600 },
  'memory-write': { requests: 20, window: 3600 },
  'account-delete': { requests: 3, window: 86400 },
}

export async function enforceRateLimit(ip: string, bucket: RateLimitBucket) {
  const limit = limits[bucket]
  const key = createHash('sha256').update(`${bucket}:${ip}`).digest('hex')
  const { data, error } = await createSupabaseAdminClient().rpc('consume_auth_rate_limit', {
    p_bucket: bucket,
    p_key: key,
    p_max_requests: limit.requests,
    p_window_seconds: limit.window,
  })
  // Preserve Supabase's diagnostic fields so route handlers can log the
  // actual RPC failure instead of masking it with a generic message.
  if (error) throw error
  return data === true
}
