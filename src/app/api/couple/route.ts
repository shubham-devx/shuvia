import { NextResponse, type NextRequest } from 'next/server'
import { enforceRateLimit, type RateLimitBucket } from '@/lib/auth/rate-limit'
import { createInvitationCode, createInvitationToken, hashInvitationCode, hashInvitationToken } from '@/lib/couple/tokens'
import { coupleActionSchema, type CoupleAction } from '@/lib/couple/schemas'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}

function getRateLimit(action: CoupleAction): RateLimitBucket | null {
  if (action.action === 'create') return 'couple-create'
  if (action.action === 'regenerate') return 'couple-regenerate'
  if (action.action === 'preview-code' || action.action === 'accept-code' || action.action === 'decline-code' || action.action === 'decline-token') return 'couple-code'
  return null
}

function knownError(message: string, code?: string) {
  if (code === 'PGRST202' || code === '42883' || code === '42P01' || code === '42703' || code === '42702' || code === 'PGRST204') {
    return { status: 503, error: 'The invitation service needs a database update. Ask the app owner to apply the couple-space migrations, then try again.' }
  }
  if (code === '40001' || code === '40P01') return { status: 503, error: 'The connection is being updated right now. Please wait a moment and try again.' }
  if (code === '22023') return { status: 400, error: 'The invitation could not be processed. Check the code and accept the connection policy to continue.' }
  if (message.includes('already been used') || message.includes('cancelled')) return { status: 409, error: 'This invitation is no longer active. Ask your person to share their latest invitation code.' }
  if (message.includes('active couple space') || message.includes('current couple connection')) {
    return { status: 409, error: 'You already have an active couple connection. End it before creating or joining another.' }
  }
  if (code === '23505') return { status: 409, error: 'This invitation can no longer be used. Ask your person to share their latest code.' }
  if (code === 'P0002') return { status: 404, error: 'That invitation or connection is no longer available.' }
  if (code === '42501') return { status: 403, error: message }
  if (message.includes('expired')) return { status: 410, error: 'This invitation has expired. Ask your person to send a fresh one.' }
  return { status: 400, error: 'We could not complete that connection step. Please refresh and try again.' }
}

async function takeLimit(request: NextRequest, bucket: RateLimitBucket) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip') ?? 'unknown'
  return enforceRateLimit(ip, bucket)
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request could not be validated.' }, { status: 403 })
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: 'Please check that invitation and try again.' }, { status: 400 }) }
  const parsed = coupleActionSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Please check that invitation and try again.' }, { status: 400 })

  let stage = 'session-validation'
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Log in to continue.' }, { status: 401 })
    if (!user.email_confirmed_at) return NextResponse.json({ error: 'Verify your email before using couple spaces.' }, { status: 403 })
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
    if (!profile?.onboarding_completed) return NextResponse.json({ error: 'Finish onboarding before using couple spaces.' }, { status: 403 })

    const action = parsed.data
    const bucket = getRateLimit(action)
    stage = 'rate-limit'
    if (bucket && !await takeLimit(request, bucket)) {
      return NextResponse.json({ error: bucket === 'couple-code' ? 'Too many code attempts. Wait a while, or ask your person for a new link.' : 'Please wait a little before trying again.' }, { status: 429 })
    }

    if (action.action === 'create' || action.action === 'regenerate') {
      stage = 'create-invitation'
      const token = createInvitationToken()
      const code = createInvitationCode()
      const rpcName = action.action === 'create' ? 'create_couple_space' : 'regenerate_couple_invitation'
      const { data, error } = await supabase.rpc(rpcName, {
        p_token_hash: hashInvitationToken(token),
        p_code_hash: hashInvitationCode(code),
        ...(action.action === 'create' ? { p_owner_consents: action.consentPolicy } : {}),
      })
      if (error) {
        console.error('Couple invitation RPC failed:', { action: action.action, code: error.code })
        const safe = knownError(error.message, error.code)
        return NextResponse.json(safe, { status: safe.status })
      }
      const record = Array.isArray(data) ? data[0] : data
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
      return NextResponse.json({ token, code: `${code.slice(0, 5)}-${code.slice(5)}`, expiresAt: record?.invitation_expires_at, inviteUrl: new URL(`/invite/${token}`, siteUrl).toString() }, { status: 201 })
    }

    if (action.action === 'preview-token' || action.action === 'preview-code') {
      stage = 'preview-invitation'
      const tokenHash = action.action === 'preview-token' ? hashInvitationToken(action.token) : null
      const codeHash = action.action === 'preview-code' ? hashInvitationCode(action.code) : null
      const { data, error } = await supabase.rpc('preview_couple_invitation', { p_token_hash: tokenHash, p_code_hash: codeHash })
      if (error) {
        console.error('Couple invitation RPC failed:', { action: action.action, code: error.code })
        const safe = knownError(error.message, error.code)
        return NextResponse.json(safe, { status: safe.status })
      }
      const invitation = Array.isArray(data) ? data[0] : data
      if (!invitation) return NextResponse.json({ invitation: { status: 'unavailable' } })
      let inviterAvatarUrl: string | null = invitation.inviter_avatar_path ?? null
      if (inviterAvatarUrl && !inviterAvatarUrl.startsWith('http')) {
        const { data: avatar } = await createSupabaseAdminClient().storage.from('shuvia-avatars').createSignedUrl(inviterAvatarUrl, 900)
        inviterAvatarUrl = avatar?.signedUrl ?? null
      }
      return NextResponse.json({ invitation: {
        status: invitation.invitation_status,
        spaceStatus: invitation.space_status,
        inviterFirstName: invitation.inviter_first_name,
        inviterAvatarUrl,
        expiresAt: invitation.expires_at,
      } })
    }

    if (action.action === 'accept-token' || action.action === 'accept-code') {
      stage = 'accept-invitation'
      const tokenHash = action.action === 'accept-token' ? hashInvitationToken(action.token) : null
      const codeHash = action.action === 'accept-code' ? hashInvitationCode(action.code) : null
      const { data, error } = await supabase.rpc('accept_couple_invitation', { p_token_hash: tokenHash, p_code_hash: codeHash, p_partner_consents: action.consentPolicy })
      if (error) {
        console.error('Couple invitation RPC failed:', { action: action.action, code: error.code })
        const safe = knownError(error.message, error.code)
        return NextResponse.json(safe, { status: safe.status })
      }
      const result = Array.isArray(data) ? data[0] : data
      if (result?.space_status === 'invitation_expired') return NextResponse.json({ error: 'This invitation has expired. Ask your person to send a fresh one.' }, { status: 410 })
      return NextResponse.json({ status: result?.space_status ?? 'invitation_accepted' })
    }

    if (action.action === 'decline-token' || action.action === 'decline-code') {
      stage = 'decline-invitation'
      const tokenHash = action.action === 'decline-token' ? hashInvitationToken(action.token) : null
      const codeHash = action.action === 'decline-code' ? hashInvitationCode(action.code) : null
      const { data, error } = await supabase.rpc('decline_couple_invitation', { p_token_hash: tokenHash, p_code_hash: codeHash })
      if (error) {
        console.error('Couple invitation RPC failed:', { action: action.action, code: error.code })
        const safe = knownError(error.message, error.code)
        return NextResponse.json(safe, { status: safe.status })
      }
      return NextResponse.json({ status: data ?? 'declined' })
    }

    const rpcName = action.action === 'confirm' ? 'confirm_couple_connection'
      : action.action === 'cancel' ? 'cancel_couple_connection'
        : action.action === 'withdraw' ? 'withdraw_couple_acceptance' : 'disconnect_couple_space'
    stage = action.action === 'disconnect' ? 'disconnect-cleanup' : 'update-connection'
    const { error } = await supabase.rpc(rpcName)
    if (error) {
      console.error('Couple connection RPC failed:', { action: action.action, code: error.code })
      const safe = knownError(error.message, error.code)
      return NextResponse.json(safe, { status: safe.status })
    }
    return NextResponse.json({ status: action.action === 'confirm' ? 'connected' : action.action === 'disconnect' ? 'disconnected' : 'connection_cancelled' })
  } catch (cause) {
    const failure = cause as { code?: unknown }
    console.error('Couple API operation failed:', { action: parsed.data.action, stage, code: typeof failure.code === 'string' ? failure.code : 'unknown' })
    return NextResponse.json({ error: 'Couple spaces are not configured yet. Please try again later.' }, { status: 503 })
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to view your connection.' }, { status: 401 })
    const { data, error } = await supabase.rpc('get_my_couple_space')
    if (error) return NextResponse.json({ error: 'Your connection details are unavailable.' }, { status: 503 })
    const space = Array.isArray(data) ? data[0] ?? null : data
    const { data: relationshipCode } = await supabase.rpc('get_my_relationship_code')
    return NextResponse.json({ space: space ? {
      state: space.state,
      is_owner: space.is_owner,
      invitation_expires_at: space.invitation_expires_at,
      partner_name: space.partner_name,
    } : { state: 'disconnected' }, relationshipCode: relationshipCode ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Your connection details are unavailable.' }, { status: 503 })
  }
}
