import { requireShuviaUser } from '@/lib/auth/require-user'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AccountSettings } from '@/components/settings/account-settings'
import '../home/dashboard.css'
import '../notes/letters.css'
import '../memories/memories.css'
import './settings.css'
import '../device-polish.css'

export const dynamic='force-dynamic'
export default async function SettingsPage(){const {user,profile}=await requireShuviaUser(),supabase=await createSupabaseServerClient(),{data}=await supabase.rpc('get_my_couple_space'),space=Array.isArray(data)?data[0]??null:data;return <AccountSettings initialName={profile.full_name} initialEmail={user.email??''} space={{state:space?.state??'disconnected',partnerName:space?.partner_name??'your person'}}/>}
