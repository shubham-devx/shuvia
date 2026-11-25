import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  kind: z.enum(['note', 'date', 'memory', 'game_activity']),
  title: z.string().trim().max(100).optional().default(''),
  body: z.string().trim().max(500).optional().default(''),
  date: z.string().date().optional(),
})

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return Boolean(origin && new URL(origin).origin === new URL(request.url).origin)
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email_confirmed_at) return NextResponse.json({ error: 'Sign in with a verified account to open your home.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 })
  const { data, error } = await supabase.rpc('get_couple_dashboard')
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  const dashboard = data as { your_avatar_url?: string | null; partner_avatar_url?: string | null }
  const admin = createSupabaseAdminClient()
  const signed = await Promise.all([dashboard.your_avatar_url, dashboard.partner_avatar_url].map(async (path) => {
    if (!path || path.startsWith('http')) return path
    const { data: avatar } = await admin.storage.from('shuvia-avatars').createSignedUrl(path, 3600)
    return avatar?.signedUrl ?? null
  }))
  dashboard.your_avatar_url = signed[0]
  dashboard.partner_avatar_url = signed[1]
  return NextResponse.json({ dashboard }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'This request could not be verified.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Please check the details and try again.' }, { status: 400 })
  const input = parsed.data
  if (input.kind === 'note' && (input.body.length < 1 || input.body.length > 500)) return NextResponse.json({ error: 'A love note can be up to 500 characters.' }, { status: 400 })
  if (input.kind === 'memory' && (input.body.length < 1 || input.body.length > 240)) return NextResponse.json({ error: 'Add a memory in 240 characters or fewer.' }, { status: 400 })
  if (input.kind === 'date' && (input.title.length < 1 || !input.date)) return NextResponse.json({ error: 'Add a name and date for your occasion.' }, { status: 400 })
  if (input.kind === 'game_activity' && input.title.length < 1) return NextResponse.json({ error: 'Choose an activity first.' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email_confirmed_at) return NextResponse.json({ error: 'Sign in with a verified account to share here.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 })
  const { data, error } = await supabase.rpc('add_couple_dashboard_item', {
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body,
    p_date: input.date ?? new Date().toISOString().slice(0, 10),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data }, { status: 201 })
}
