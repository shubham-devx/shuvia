import { Header, Footer } from '@/App'
import { LogoutButton } from '@/components/auth/logout-button'
import { requireShuviaUser } from '@/lib/auth/require-user'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { SpaceDashboard } from '@/components/couple/space-dashboard'

export const dynamic = 'force-dynamic'

export default async function SpacePage() {
  await requireShuviaUser()
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_my_couple_space')
  const space = Array.isArray(data) ? data[0] ?? null : data
  if (space?.partner_avatar_url && !space.partner_avatar_url.startsWith('http')) {
    const { data: avatar } = await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(space.partner_avatar_url, 3600)
    space.partner_avatar_url = avatar?.signedUrl ?? null
  }
  return <><Header/><main><SpaceDashboard initial={space} loadError={Boolean(error)}/><div className="couple-logout"><LogoutButton/></div></main><Footer/></>
}
