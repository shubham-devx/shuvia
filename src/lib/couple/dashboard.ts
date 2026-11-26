import 'server-only'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireShuviaUser } from '@/lib/auth/require-user'
import type { DashboardData } from '@/components/dashboard/couple-home'

type CoupleSpaceStatus = { state: string; partner_name?: string | null; is_owner?: boolean } | null
type ConnectedDashboard = { dashboard: DashboardData; userId: string }
type HomeDashboard = { dashboard: DashboardData | null; userId: string; name: string; space: CoupleSpaceStatus; loadError: boolean }

export function loadCoupleDashboard(): Promise<ConnectedDashboard>
export function loadCoupleDashboard(options: { allowUnconnected: true }): Promise<HomeDashboard>
export async function loadCoupleDashboard(options?: { allowUnconnected?: boolean }): Promise<ConnectedDashboard | HomeDashboard> {
  const { user, profile } = await requireShuviaUser()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_couple_dashboard')
  if (error || !data) {
    if (!options?.allowUnconnected) redirect('/space')
    if (error && error.code !== 'P0002') return { dashboard: null, userId: user.id, name: profile.full_name, space: null, loadError: true }
    const { data: spaceData, error: spaceError } = await supabase.rpc('get_my_couple_space')
    if (spaceError) return { dashboard: null, userId: user.id, name: profile.full_name, space: null, loadError: true }
    const space = Array.isArray(spaceData) ? spaceData[0] ?? null : spaceData
    if ((space as CoupleSpaceStatus)?.state === 'connected') return { dashboard: null, userId: user.id, name: profile.full_name, space: space as CoupleSpaceStatus, loadError: true }
    return { dashboard: null, userId: user.id, name: profile.full_name, space: space as CoupleSpaceStatus, loadError: false }
  }
  const dashboard = data as DashboardData
  const admin = createSupabaseAdminClient()
  const [{ data: preferences }, { data: members }] = await Promise.all([
    admin.from('user_preferences').select('show_online_status,share_activity,notifications_enabled').eq('user_id', user.id).maybeSingle(),
    admin.from('couple_members').select('user_id').eq('space_id', dashboard.space_id).eq('membership_state', 'active'),
  ])
  dashboard.your_share_online_status = preferences?.show_online_status ?? true
  dashboard.your_share_activity = preferences?.share_activity ?? true
  dashboard.your_notifications_enabled = preferences?.notifications_enabled ?? true
  const partnerId = members?.find((member) => member.user_id !== user.id)?.user_id
  if (partnerId) {
    const { data: partnerPreferences } = await admin.from('user_preferences').select('share_activity').eq('user_id', partnerId).maybeSingle()
    if (partnerPreferences?.share_activity === false) dashboard.activity = dashboard.activity.filter((event) => event.actor_name !== dashboard.partner_name)
  }
  const avatars = await Promise.all([dashboard.your_avatar_url, dashboard.partner_avatar_url].map(async (path) => {
    if (!path || path.startsWith('http')) return path
    const { data: signed } = await admin.storage.from('shuvia-avatars').createSignedUrl(path, 3600)
    return signed?.signedUrl ?? null
  }))
  dashboard.your_avatar_url = avatars[0]
  dashboard.partner_avatar_url = avatars[1]
  return { dashboard, userId: user.id }
}
