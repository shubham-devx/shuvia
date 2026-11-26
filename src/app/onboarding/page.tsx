import { redirect } from 'next/navigation'
import { Footer } from '@/App'
import { OnboardingForm } from '@/components/auth/onboarding-form'
import type { OnboardingData } from '@/lib/auth/schemas'
import { safeInternalPath } from '@/lib/auth/redirect'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams
  const nextRoute = safeInternalPath(query.next ?? null, '/home')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect('/login')
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fonboarding')
  if (!user.email_confirmed_at) redirect('/verify-email')
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (profile?.onboarding_completed) redirect(nextRoute)
  const { data: saved } = await supabase.from('user_preferences').select('expectations,relationship_type,interested_activities,discovery_source').eq('user_id', user.id).maybeSingle()
  const initial: OnboardingData = {
    expectations: (saved?.expectations ?? []) as OnboardingData['expectations'],
    relationshipType: (saved?.relationship_type ?? null) as OnboardingData['relationshipType'],
    interestedActivities: (saved?.interested_activities ?? []) as OnboardingData['interestedActivities'],
    discoverySource: (saved?.discovery_source ?? null) as OnboardingData['discoverySource'],
  }
  return <><main><OnboardingForm initial={initial} nextRoute={nextRoute}/></main><Footer/></>
}
