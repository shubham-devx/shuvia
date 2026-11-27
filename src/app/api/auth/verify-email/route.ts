import { NextResponse, type NextRequest } from 'next/server'
import { sendVerificationEmail } from '@/lib/auth/brevo'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { safeInternalPath } from '@/lib/auth/redirect'
import { forgotPasswordSchema } from '@/lib/auth/schemas'
import { siteUrl } from '@/lib/server-env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
const genericMessage = 'If that address has an account awaiting verification, we’ve sent a fresh link.'

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 }) }
  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' }, { status: 400 })

  const nextRoute = safeInternalPath(typeof (raw as { next?: unknown })?.next === 'string' ? (raw as { next: string }).next : null)

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!await enforceRateLimit(ip, 'onboarding')) {
      return NextResponse.json({ error: 'Too many verification requests. Please wait a little before trying again.' }, { status: 429 })
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: parsed.data.email })
    if (error || !data.user || data.user.email_confirmed_at || !data.properties?.hashed_token) {
      return NextResponse.json({ message: genericMessage }, { status: 202 })
    }

    const verifyLink = new URL('/auth/callback', siteUrl())
    verifyLink.searchParams.set('token_hash', data.properties.hashed_token)
    verifyLink.searchParams.set('type', 'magiclink')
    verifyLink.searchParams.set('next', nextRoute)

    const delivered = await sendVerificationEmail(parsed.data.email, verifyLink.toString())
    if (!delivered) {
      return NextResponse.json({ error: 'We could not send the verification email via Brevo just now. Please try again shortly.' }, { status: 503 })
    }

    return NextResponse.json({ message: genericMessage }, { status: 202 })
  } catch (error) {
    console.error('Verification email service unavailable:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Verification email is not configured yet. Please try again later.' }, { status: 503 })
  }
}
