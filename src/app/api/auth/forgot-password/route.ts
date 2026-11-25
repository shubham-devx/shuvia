import { NextResponse, type NextRequest } from 'next/server'
import { forgotPasswordSchema } from '@/lib/auth/schemas'
import { authFlowSecret, brevoEnv, siteUrl } from '@/lib/server-env'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
const genericMessage = 'If an account exists for that address, a reset link is on its way.'

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

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!await enforceRateLimit(ip, 'recovery-email')) return NextResponse.json({ error: 'Too many reset requests. Please try again in an hour.' }, { status: 429 })
    authFlowSecret()
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: parsed.data.email })
    if (error || !data.properties?.hashed_token) return NextResponse.json({ message: genericMessage }, { status: 202 })
    const env = brevoEnv()
    const resetLink = new URL('/auth/callback', siteUrl())
    resetLink.searchParams.set('token_hash', data.properties.hashed_token)
    resetLink.searchParams.set('type', 'recovery')
    resetLink.searchParams.set('next', '/reset-password')
    const htmlResetLink = resetLink.toString().replaceAll('&', '&amp;')
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to: [{ email: parsed.data.email }],
        subject: 'A fresh password for your Shuvia space',
        htmlContent: `<!doctype html><html><body style="margin:0;background:#fff9f5;font-family:Arial,sans-serif;color:#29212a"><div style="max-width:560px;margin:36px auto;padding:40px 32px;background:#fffdfb;border:1px solid #efe3de"><p style="font-family:Georgia,serif;font-size:28px;color:#6b2948;margin:0 0 28px">shuvia</p><p style="font-size:16px;line-height:1.7">Someone asked to reset the password for this Shuvia account. Use the private link below to choose a new one.</p><p style="margin:28px 0"><a href="${htmlResetLink}" style="display:inline-block;padding:15px 21px;background:#6b2948;color:#fff9f5;text-decoration:none">Choose a new password</a></p><p style="font-size:13px;line-height:1.7;color:#796c72">This link can only be used once. The password reset step stays open for 10 minutes after you open it. If you didn’t ask for it, you can ignore this email.</p><p style="margin-top:32px;font-family:Georgia,serif;font-style:italic;color:#8c777e">Two hearts. One little world.</p></div></body></html>`,
        textContent: `Someone asked to reset the password for this Shuvia account. Open this private link: ${resetLink.toString()} The password reset step stays open for 10 minutes after you open it. If you did not request it, ignore this email.`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      console.error('Brevo reset email delivery failed with status', response.status)
      return NextResponse.json({ error: 'We could not send the reset email just now. Please try again shortly.' }, { status: 503 })
    }
    return NextResponse.json({ message: genericMessage }, { status: 202 })
  } catch (error) {
    console.error('Password recovery service unavailable:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Password recovery is not configured yet. Please try again later.' }, { status: 503 })
  }
}
