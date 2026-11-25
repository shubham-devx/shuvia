import { NextResponse, type NextRequest } from 'next/server'
import { onboardingSchema } from '@/lib/auth/schemas'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.json({ error: 'Account services are not configured yet.' }, { status: 503 })
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'Please check your answers and try again.' }, { status: 400 }) }
  const parsed = onboardingSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Please check your answers and try again.' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in to save your onboarding.' }, { status: 401 })
  if (!user.email_confirmed_at) return NextResponse.json({ error: 'Please verify your email before continuing.' }, { status: 403 })
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!await enforceRateLimit(ip, 'onboarding')) return NextResponse.json({ error: 'Please wait a little before saving again.' }, { status: 429 })
    const { error } = await supabase.rpc('complete_onboarding', { p_preferences: parsed.data })
    if (error) throw error
    return NextResponse.json({ message: 'Your little world is ready.' })
  } catch (error) {
    const failure = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    console.error('Onboarding save failed:', {
      message: typeof failure?.message === 'string' ? failure.message : 'unknown error',
      code: typeof failure?.code === 'string' ? failure.code : undefined,
      details: typeof failure?.details === 'string' ? failure.details : undefined,
      hint: typeof failure?.hint === 'string' ? failure.hint : undefined,
    })
    return NextResponse.json({ error: 'We could not save that just now. Please try again.' }, { status: 503 })
  }
}
