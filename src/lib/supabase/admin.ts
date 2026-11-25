import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import { serviceRoleKey } from '@/lib/server-env'

export function createSupabaseAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv()
  const SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey()
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
