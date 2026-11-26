import { PrivateNav } from '@/components/dashboard/couple-home'
import { requireShuviaUser } from '@/lib/auth/require-user'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { SpaceDashboard } from '@/components/couple/space-dashboard'
import '../home/dashboard.css'

export const dynamic = 'force-dynamic'

export default async function SpacePage() {
  const { profile } = await requireShuviaUser()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_my_couple_space')
  const space = Array.isArray(data) ? data[0] ?? null : data
  if (space?.partner_avatar_url && !space.partner_avatar_url.startsWith('http')) {
    const { data: avatar } = await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(space.partner_avatar_url, 3600)
    space.partner_avatar_url = avatar?.signedUrl ?? null
  }
  return <div className="private-shell"><PrivateNav active="/space" initialState={space?.state ?? 'disconnected'} initialName={profile.full_name}/><main className="private-main"><SpaceDashboard initial={space} loadError={Boolean(error)}/></main></div>
}
