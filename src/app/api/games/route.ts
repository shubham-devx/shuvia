import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getGame, getPrompt, getPrompts, isCategory, isGameType } from '@/lib/games/bank'
import { enforceRateLimit } from '@/lib/auth/rate-limit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const startSchema = z.object({ action: z.literal('start'), gameType: z.string().refine(isGameType), category: z.string().refine(isCategory), truthDareKind: z.enum(['truth','dare']).optional() })
const replaySchema = z.object({ action: z.literal('replay'), gameType: z.string().refine(isGameType), category: z.string().refine(isCategory) })
const submitSchema = z.object({ action: z.literal('submit'), sessionId: z.string().uuid(), answer: z.string().trim().min(1).max(1000) })
const nextSchema = z.object({ action: z.literal('next'), sessionId: z.string().uuid(), truthDareKind: z.enum(['truth','dare']).optional() })
const transitionSchema = z.object({ action: z.enum(['pause','resume','skip','complete']), sessionId: z.string().uuid() })
const actionSchema = z.discriminatedUnion('action', [startSchema, replaySchema, submitSchema, nextSchema, transitionSchema])
type GameRoom = { space_id: string; active_session: { id: string; game_type: string; category: string; used_prompt_ids: string[]; round?: { prompt_id: string; prompt_kind: string } } | null; history: { game_type: string; category: string; prompt_ids: string[] }[] }

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}

async function actorFor() {
  const session = await createSupabaseServerClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Log in to play together.' }, { status: 401 }) } as const
  if (!user.email_confirmed_at) return { error: NextResponse.json({ error: 'Verify your email before playing.' }, { status: 403 }) } as const
  const { data: profile } = await session.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
  if (!profile?.onboarding_completed) return { error: NextResponse.json({ error: 'Finish onboarding before playing.' }, { status: 403 }) } as const
  return { user } as const
}

async function readRoom(actorId: string) {
  return createSupabaseAdminClient().rpc('get_couple_game_room', { p_actor_id: actorId })
}

function choosePrompt(gameType: string, category: string, excluded: Set<string>, repeatWhenExhausted = true, kind?: 'truth' | 'dare') {
  if (!isGameType(gameType) || !isCategory(category)) return null
  const prompts = getPrompts(gameType, category).filter((prompt) => !kind || prompt.kind === kind)
  const fresh = prompts.filter((prompt) => !excluded.has(prompt.id))
  const pool = fresh.length ? fresh : repeatWhenExhausted ? prompts : []
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

function promptParams(prompt: NonNullable<ReturnType<typeof getPrompt>>) {
  return { p_prompt_id: prompt.id, p_prompt_text: prompt.text, p_prompt_kind: prompt.kind, p_option_a: prompt.optionA ?? null, p_option_b: prompt.optionB ?? null }
}

function responseError(message?: string, code?: string) {
  if (code === '23505') return NextResponse.json({ error: 'That answer was already sent, or another game is in progress.' }, { status: 409 })
  if (code === '42501') return NextResponse.json({ error: message ?? 'This action is not available to your account.' }, { status: 403 })
  if (code === 'P0002') return NextResponse.json({ error: 'This game is no longer available. Refresh to reconnect.' }, { status: 404 })
  if (message?.includes('not been submitted') || message?.includes('before continuing')) return NextResponse.json({ error: message }, { status: 409 })
  return NextResponse.json({ error: message ?? 'We could not update the game. Please try again.' }, { status: 400 })
}

export async function GET() {
  try {
    const auth = await actorFor()
    if ('error' in auth) return auth.error
    const { data, error } = await readRoom(auth.user.id)
    if (error) return responseError(error.message, error.code)
    return NextResponse.json({ room: data })
  } catch {
    return NextResponse.json({ error: 'The game service is unavailable right now.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'This request could not be verified.' }, { status: 403 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid Shuvia game action.' }, { status: 400 })
  try {
    const auth = await actorFor()
    if ('error' in auth) return auth.error
    if (parsed.data.action === 'start' || parsed.data.action === 'replay') {
      if (!await enforceRateLimit(auth.user.id, 'game-start')) return NextResponse.json({ error: 'You have started several games recently. Take a little breather and try again soon.' }, { status: 429 })
    }
    const admin = createSupabaseAdminClient()
    let mutation
    if (parsed.data.action === 'start' || parsed.data.action === 'replay') {
      const { gameType, category } = parsed.data
      const game = getGame(gameType)
      if (!game) return NextResponse.json({ error: 'That game is not in the Shuvia collection.' }, { status: 400 })
      const { data: before, error: readError } = await readRoom(auth.user.id)
      if (readError) return responseError(readError.message, readError.code)
      const room = before as GameRoom
      const recent = room.history.filter((entry) => entry.game_type === gameType).flatMap((entry) => entry.prompt_ids ?? [])
      const truthDareKind = gameType === 'truth-or-dare' ? (parsed.data.action === 'start' ? parsed.data.truthDareKind : undefined) ?? 'truth' : undefined
      const prompt = choosePrompt(gameType, category, new Set(recent), true, truthDareKind)
      if (!prompt) return NextResponse.json({ error: 'There are no cards in that category yet.' }, { status: 409 })
      mutation = await admin.rpc('start_couple_game', { p_actor_id: auth.user.id, p_game_type: gameType, p_category: category, ...promptParams(prompt) })
    } else if (parsed.data.action === 'next') {
      const { data: before, error: readError } = await readRoom(auth.user.id)
      if (readError) return responseError(readError.message, readError.code)
      const session = (before as GameRoom).active_session
      if (!session || session.id !== parsed.data.sessionId || !isGameType(session.game_type) || !isCategory(session.category)) return responseError('This round is no longer active.', 'P0002')
      const truthDareKind = session.game_type === 'truth-or-dare' ? parsed.data.truthDareKind : undefined
      if (session.game_type === 'truth-or-dare' && !truthDareKind) return NextResponse.json({ error: 'Choose truth or dare for the next turn.' }, { status: 400 })
      const prompt = choosePrompt(session.game_type, session.category, new Set(session.used_prompt_ids ?? []), false, truthDareKind)
      if (!prompt && truthDareKind) return NextResponse.json({ error: `No fresh ${truthDareKind} cards remain in this mood. Choose the other kind or finish the game.` }, { status: 409 })
      if (!prompt) mutation = await admin.rpc('transition_couple_game', { p_actor_id: auth.user.id, p_session_id: session.id, p_action: 'complete' })
      else mutation = await admin.rpc('transition_couple_game', { p_actor_id: auth.user.id, p_session_id: session.id, p_action: 'next', ...promptParams(prompt) })
    } else if (parsed.data.action === 'submit') {
      const { data: before, error: readError } = await readRoom(auth.user.id)
      if (readError) return responseError(readError.message, readError.code)
      const session = (before as GameRoom).active_session
      if (!session || session.id !== parsed.data.sessionId) return responseError('This round is no longer active.', 'P0002')
      const round = session.round
      if (!round || !isGameType(session.game_type)) return responseError('This round is no longer active.', 'P0002')
      const prompt = getPrompt(session.game_type, round.prompt_id)
      if (!prompt) return responseError('This card is no longer available.', 'P0002')
      const answer = parsed.data.answer.trim()
      if (prompt.kind === 'choice' && answer !== 'A' && answer !== 'B') return NextResponse.json({ error: 'Choose one of the two cards before you submit.' }, { status: 400 })
      if (prompt.kind === 'emoji') {
        const count = [...answer].filter((char) => /\p{Extended_Pictographic}/u.test(char)).length
        if (!count || count > 5 || answer.length > 60) return NextResponse.json({ error: 'Use up to five emoji for this card.' }, { status: 400 })
      }
      mutation = await admin.rpc('transition_couple_game', { p_actor_id: auth.user.id, p_session_id: session.id, p_action: 'submit', p_answer_text: answer })
    } else {
      mutation = await admin.rpc('transition_couple_game', { p_actor_id: auth.user.id, p_session_id: parsed.data.sessionId, p_action: parsed.data.action })
    }
    if (mutation.error?.code === '23505' && (parsed.data.action === 'start' || parsed.data.action === 'replay')) {
      return NextResponse.json({ error: 'A shared game is already in progress. Continue it or finish it before starting another.' }, { status: 409 })
    }
    if (mutation.error?.code === '23505' && parsed.data.action === 'submit') {
      return NextResponse.json({ error: 'Your answer is already saved for this round.' }, { status: 409 })
    }
    if (mutation.error) return responseError(mutation.error.message, mutation.error.code)
    const { data: room, error } = await readRoom(auth.user.id)
    if (error) return responseError(error.message, error.code)
    return NextResponse.json({ room, transition: mutation.data ?? null })
  } catch {
    return NextResponse.json({ error: 'The game service is unavailable right now.' }, { status: 503 })
  }
}
