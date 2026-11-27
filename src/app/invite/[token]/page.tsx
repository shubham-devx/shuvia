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
  const tokenHash = hashInvitationToken(token)
  let preview: InvitationPreview | null = null
  let shouldRedirectHome = false
  try {
    const { data } = await supabase.rpc('preview_couple_invitation', { p_token_hash: tokenHash, p_code_hash: null })
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      if (row.invitation_status === 'pending' || (row.invitation_status === 'accepted' && row.space_status === 'connected')) {
        const { data: accepted, error: acceptError } = await supabase.rpc('accept_couple_invitation', {
          p_token_hash: tokenHash,
          p_code_hash: null,
          p_partner_consents: true,
        })
        const result = Array.isArray(accepted) ? accepted[0] : accepted
        if (!acceptError && result?.space_status === 'connected') {
          shouldRedirectHome = true
        } else if (result?.space_status === 'invitation_expired') {
          preview = { status: 'expired', spaceStatus: 'invitation_expired', expiresAt: row.expires_at }
        } else {
          preview = { status: 'unavailable', spaceStatus: row.space_status }
        }
      } else {
        let inviterAvatarUrl = row.inviter_avatar_path ?? null
        if (inviterAvatarUrl && !inviterAvatarUrl.startsWith('http')) {
          const { data: avatar } = await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(inviterAvatarUrl, 900)
          inviterAvatarUrl = avatar?.signedUrl ?? null
        }
        preview = { status: row.invitation_status, spaceStatus: row.space_status, inviterFirstName: row.inviter_first_name, inviterAvatarUrl, expiresAt: row.expires_at, viewerEmail: user.email ?? null }
      }
    }
  } catch { preview = null }
  if (shouldRedirectHome) redirect('/home')
  return <><Header/><InvitationAcceptance token={token} preview={preview}/><Footer/></>
}
