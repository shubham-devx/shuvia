import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { resetPasswordSchema } from '@/lib/auth/schemas'
import { recoveryCookieName, validRecoveryCookie } from '@/lib/auth/recovery-cookie'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  const jar = await cookies()
  if (!validRecoveryCookie(jar.get(recoveryCookieName())?.value)) return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a fresh one to continue.' }, { status: 401 })
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'Enter a valid new password.' }, { status: 400 }) }
  const parsed = resetPasswordSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your new password.' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) return NextResponse.json({ error: 'This reset link is invalid or has expired. Request a fresh one to continue.' }, { status: 401 })
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return NextResponse.json({ error: 'We could not update that password. Request a fresh reset link and try again.' }, { status: 400 })
  jar.delete(recoveryCookieName())
  return NextResponse.json({ message: 'Password updated.' })
}
