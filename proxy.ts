import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const privatePaths = ['/onboarding', '/settings', '/space', '/home', '/dashboard', '/notes', '/our-days', '/surprises', '/games', '/memories', '/couple', '/app', '/invite', '/join']
const noIndexPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/connect', '/auth/callback']

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPrivate = privatePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const shouldNoIndex = isPrivate || noIndexPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    const response = isPrivate ? NextResponse.redirect(new URL('/login', request.url)) : NextResponse.next()
    if (shouldNoIndex) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return response
  }

  let response = NextResponse.next({ request })
  const maxAge = request.cookies.get('shuvia_remember')?.value === '0' ? 60 * 60 * 8 : 60 * 60 * 24 * 30
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookieOptions: { maxAge, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (isPrivate) {
    let redirectPath: string | null = null
    if (!user) redirectPath = '/login'
    else if (!user.email_confirmed_at) redirectPath = '/login'
    else if (pathname !== '/onboarding') {
      const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
      if (!profile?.onboarding_completed) redirectPath = '/onboarding'
    }
    if (redirectPath) {
      const target = new URL(redirectPath, request.url)
      const returnPath = `${pathname}${request.nextUrl.search}`
      if (!user || redirectPath === '/login' || redirectPath === '/onboarding') target.searchParams.set('next', returnPath)
      if (user && !user.email_confirmed_at) target.searchParams.set('error', 'email-unverified')
      const redirectResponse = NextResponse.redirect(target)
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      if (shouldNoIndex) redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
      return redirectResponse
    }
  }
  if (shouldNoIndex) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
