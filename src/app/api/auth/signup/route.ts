import { NextResponse, type NextRequest } from 'next/server'
import { sendVerificationEmail } from '@/lib/auth/brevo'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { safeInternalPath } from '@/lib/auth/redirect'
import { signupSchema } from '@/lib/auth/schemas'
import { siteUrl } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'Check your details and try again.' }, { status: 400 }) }
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' }, { status: 400 })

  const nextRoute = safeInternalPath(typeof (raw as { next?: unknown })?.next === 'string' ? (raw as { next: string }).next : null)

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!await enforceRateLimit(ip, 'onboarding')) {
      return NextResponse.json({ error: 'Too many signup attempts. Please wait a little before trying again.' }, { status: 429 })
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          legal_accepted: true,
          legal_version: '2026-11-25',
        },
      },
    })

    if (error) {
      if (error.code === 'email_exists' || /already|exists|registered/i.test(error.message)) {
        return NextResponse.json({ error: 'An account with this email already exists. Try logging in instead.' }, { status: 409 })
      }
      console.error('Signup generateLink failed:', error.message)
      return NextResponse.json({ error: 'We could not create your account right now. Please try again.' }, { status: 400 })
    }

    const tokenHash = data.properties?.hashed_token
    if (!tokenHash) {
      return NextResponse.json({ error: 'We could not prepare your verification link. Please try again.' }, { status: 503 })
    }

    const verifyLink = new URL('/auth/callback', siteUrl())
    verifyLink.searchParams.set('token_hash', tokenHash)
    verifyLink.searchParams.set('type', 'signup')
    verifyLink.searchParams.set('next', nextRoute)

    const delivered = await sendVerificationEmail(parsed.data.email, verifyLink.toString())
    if (!delivered) {
      return NextResponse.json({ error: 'Your account was created, but we could not send the verification email via Brevo. Check your Brevo sender settings or try resending.' }, { status: 503 })
    }

    return NextResponse.json({ sent: true, next: nextRoute }, { status: 201 })
  } catch (error) {
    console.error('Signup email service unavailable:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Account setup is not configured yet. Please try again later.' }, { status: 503 })
  }
}
