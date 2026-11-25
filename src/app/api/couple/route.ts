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
  if (action.action === 'preview-code' || action.action === 'accept-code') return 'couple-code'
  return null
}

function knownError(message: string, code?: string) {
  if (code === '23505' || message.includes('active couple space') || message.includes('current couple connection')) {
    return { status: 409, error: 'You already have an active couple connection. End it before creating or joining another.' }
  }
  if (code === 'P0002') return { status: 404, error: 'That invitation or connection is no longer available.' }
  if (code === '42501') return { status: 403, error: message }
  if (message.includes('expired')) return { status: 410, error: 'This invitation has expired. Ask your person to send a fresh one.' }
  if (message.includes('already been used') || message.includes('cancelled')) return { status: 409, error: 'This invitation has already been used or cancelled.' }
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

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Log in to continue.' }, { status: 401 })
    if (!user.email_confirmed_at) return NextResponse.json({ error: 'Verify your email before using couple spaces.' }, { status: 403 })
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
    if (!profile?.onboarding_completed) return NextResponse.json({ error: 'Finish onboarding before using couple spaces.' }, { status: 403 })

    const action = parsed.data
    const bucket = getRateLimit(action)
    if (bucket && !await takeLimit(request, bucket)) {
      return NextResponse.json({ error: bucket === 'couple-code' ? 'Too many code attempts. Wait a while, or ask your person for a new link.' : 'Please wait a little before trying again.' }, { status: 429 })
    }

    if (action.action === 'create' || action.action === 'regenerate') {
      const token = createInvitationToken()
      const code = createInvitationCode()
      const rpcName = action.action === 'create' ? 'create_couple_space' : 'regenerate_couple_invitation'
      const { data, error } = await supabase.rpc(rpcName, {
        p_token_hash: hashInvitationToken(token),
        p_code_hash: hashInvitationCode(code),
        ...(action.action === 'create' ? { p_owner_consents: action.consentPolicy } : {}),
      })
      if (error) return NextResponse.json(knownError(error.message, error.code), { status: error.code === '23505' ? 409 : 400 })
      const record = Array.isArray(data) ? data[0] : data
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
      return NextResponse.json({ token, code: `${code.slice(0, 5)}-${code.slice(5)}`, expiresAt: record?.invitation_expires_at, inviteUrl: new URL(`/invite/${token}`, siteUrl).toString() }, { status: 201 })
    }

    if (action.action === 'preview-token' || action.action === 'preview-code') {
      const tokenHash = action.action === 'preview-token' ? hashInvitationToken(action.token) : null
      const codeHash = action.action === 'preview-code' ? hashInvitationCode(action.code) : null
      const { data, error } = await supabase.rpc('preview_couple_invitation', { p_token_hash: tokenHash, p_code_hash: codeHash })
      if (error) return NextResponse.json(knownError(error.message, error.code), { status: error.code === '42501' ? 403 : 400 })
      const invitation = Array.isArray(data) ? data[0] : data
      if (!invitation) return NextResponse.json({ invitation: { status: 'unavailable' } })
      return NextResponse.json({ invitation: {
        status: invitation.invitation_status,
        spaceStatus: invitation.space_status,
        inviterFirstName: invitation.inviter_first_name,
        expiresAt: invitation.expires_at,
      } })
    }

    if (action.action === 'accept-token' || action.action === 'accept-code') {
      const tokenHash = action.action === 'accept-token' ? hashInvitationToken(action.token) : null
      const codeHash = action.action === 'accept-code' ? hashInvitationCode(action.code) : null
      const { data, error } = await supabase.rpc('accept_couple_invitation', { p_token_hash: tokenHash, p_code_hash: codeHash, p_partner_consents: action.consentPolicy })
      if (error) {
        const safe = knownError(error.message, error.code)
        return NextResponse.json(safe, { status: safe.status })
      }
      const result = Array.isArray(data) ? data[0] : data
      if (result?.space_status === 'invitation_expired') return NextResponse.json({ error: 'This invitation has expired. Ask your person to send a fresh one.' }, { status: 410 })
      return NextResponse.json({ status: result?.space_status ?? 'invitation_accepted' })
    }

    const rpcName = action.action === 'confirm' ? 'confirm_couple_connection'
      : action.action === 'cancel' ? 'cancel_couple_connection'
        : action.action === 'withdraw' ? 'withdraw_couple_acceptance' : 'disconnect_couple_space'
    let memoryPhotoPaths: string[] = []
    if (action.action === 'disconnect') {
      const { data: dashboard } = await supabase.rpc('get_couple_dashboard')
      if (dashboard?.space_id) {
        const { data: memories } = await createSupabaseAdminClient().from('shared_memories').select('photo_path').eq('space_id', dashboard.space_id).not('photo_path', 'is', null)
        memoryPhotoPaths = (memories ?? []).flatMap((memory) => memory.photo_path ? [memory.photo_path] : [])
      }
    }
    const { error } = await supabase.rpc(rpcName)
    if (error) {
      const safe = knownError(error.message, error.code)
      return NextResponse.json(safe, { status: safe.status })
    }
    if (memoryPhotoPaths.length) {
      await createSupabaseAdminClient().storage.from('shuvia-memories').remove(memoryPhotoPaths)
    }
    return NextResponse.json({ status: action.action === 'confirm' ? 'connected' : action.action === 'disconnect' ? 'disconnected' : 'connection_cancelled' })
  } catch {
    return NextResponse.json({ error: 'Couple spaces are not configured yet. Please try again later.' }, { status: 503 })
  }
}
