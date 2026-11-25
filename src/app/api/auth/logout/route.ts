import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.json({ error: 'Account services are not configured yet.' }, { status: 503 })
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signOut()
  const jar = await cookies()
  jar.delete('shuvia_remember')
  if (error) return NextResponse.json({ error: 'We could not securely end this session. Please try again.' }, { status: 503 })
  return NextResponse.json({ message: 'Signed out.' })
}
