import { redirect } from 'next/navigation'
import { Header, Footer } from '@/App'
import { InvitationAcceptance, type InvitationPreview } from '@/components/couple/invitation-acceptance'
import { hashInvitationToken } from '@/lib/couple/tokens'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const nextPath = `/invite/${token}`
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <><Header/><InvitationAcceptance token={token} preview={null}/><Footer/></>
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  if (!user.email_confirmed_at) redirect(`/verify-email?next=${encodeURIComponent(nextPath)}`)
  const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`)
  let preview: InvitationPreview | null = null
  try {
    const { data } = await supabase.rpc('preview_couple_invitation', { p_token_hash: hashInvitationToken(token), p_code_hash: null })
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      let inviterAvatarUrl = row.inviter_avatar_path ?? null
      if (inviterAvatarUrl && !inviterAvatarUrl.startsWith('http')) {
        const { data: avatar } = await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(inviterAvatarUrl, 900)
        inviterAvatarUrl = avatar?.signedUrl ?? null
      }
      preview = { status: row.invitation_status, spaceStatus: row.space_status, inviterFirstName: row.inviter_first_name, inviterAvatarUrl, expiresAt: row.expires_at }
    }
  } catch { preview = null }
  return <><Header/><InvitationAcceptance token={token} preview={preview}/><Footer/></>
}
