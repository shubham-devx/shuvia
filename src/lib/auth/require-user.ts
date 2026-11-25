import 'server-only'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireShuviaUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/login')
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!user.email_confirmed_at) redirect('/verify-email')
  const { data: profile } = await supabase.from('profiles').select('full_name,onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) redirect('/onboarding')
  return { user, profile }
}
