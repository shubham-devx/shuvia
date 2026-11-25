'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

export function createSupabaseBrowserClient(rememberMe = true) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv()
  return createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    isSingleton: false,
    cookieOptions: { maxAge: rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
  })
}

export function setRememberMePreference(rememberMe: boolean) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8
  document.cookie = `shuvia_remember=${rememberMe ? '1' : '0'}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}
