import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { recoveryCookieMaxAge, recoveryCookieName, recoveryCookieValue } from '@/lib/auth/recovery-cookie'
import { safeInternalPath } from '@/lib/auth/redirect'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const allowedTypes = new Set(['signup', 'email_change', 'recovery', 'magiclink', 'invite'])

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const code = url.searchParams.get('code')
  const type = url.searchParams.get('type')
  const safeNext = safeInternalPath(url.searchParams.get('next'))
  const failure = new URL(type === 'recovery' ? '/forgot-password?error=invalid-link' : '/verify-email?error=invalid-link', url.origin)
  if ((!tokenHash && !code) || (tokenHash && (!type || !allowedTypes.has(type)))) return redirectNoStore(failure)

  try {
    const supabase = await createSupabaseServerClient()
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as 'signup' | 'email_change' | 'recovery' | 'magiclink' | 'invite' })
    if (error) return redirectNoStore(failure)
    if (type === 'recovery') {
      const jar = await cookies()
      jar.set(recoveryCookieName(), recoveryCookieValue(), {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: recoveryCookieMaxAge,
      })
    }
    return redirectNoStore(new URL(safeNext, url.origin))
  } catch {
    return redirectNoStore(failure)
  }
}

function redirectNoStore(destination: URL) {
  const response = NextResponse.redirect(destination)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
