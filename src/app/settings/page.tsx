import { requireShuviaUser } from '@/lib/auth/require-user'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AccountSettings } from '@/components/settings/account-settings'
import '../home/dashboard.css'
import '../notes/letters.css'
import '../memories/memories.css'
import './settings.css'
import '../device-polish.css'

export const dynamic='force-dynamic'
export default async function SettingsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){
  const [{tab},{user,profile}]=await Promise.all([searchParams,requireShuviaUser()])
  const supabase=await createSupabaseServerClient()
  const {data}=await supabase.rpc('get_my_couple_space')
  const space=Array.isArray(data)?data[0]??null:data
  let partnerAvatarUrl:string|null=space?.partner_avatar_url??null
  if(partnerAvatarUrl&&!partnerAvatarUrl.startsWith('http')){
    const {data:avatar}=await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(partnerAvatarUrl,3600)
    partnerAvatarUrl=avatar?.signedUrl??null
  }
  return <AccountSettings initialName={profile.full_name} initialEmail={user.email??''} initialTab={tab} space={{state:space?.state??'disconnected',partnerName:space?.partner_name??'your person',partnerAvatarUrl,connectedAt:space?.created_at??null}}/>
}
