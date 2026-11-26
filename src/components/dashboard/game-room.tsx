'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronRight, CircleHelp, Clock3, Heart, LoaderCircle, Pause, Play, Radio, RotateCcw, SkipForward, Sparkles, Volume2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { categories, gameCatalog, type GameCategory, type GameType } from '@/lib/games/bank'
import { PrivateNav } from './couple-home'

type Round = {
  round_no: number; prompt_id: string; prompt_text: string; prompt_kind: string; option_a: string | null; option_b: string | null
  result_status: 'active' | 'revealed' | 'skipped'; is_my_turn: boolean; is_my_answerer: boolean; my_answer_role: string
  my_answer: string | null; partner_answer: string | null; my_submitted: boolean; partner_submitted: boolean; answer_count: number
}
type ActiveSession = { id: string; game_type: GameType; category: GameCategory; answer_mode: 'turn' | 'both' | 'guess'; status: 'active' | 'paused'; current_round: number; created_at: string; round: Round; round_count: number; used_prompt_ids: string[] }
type HistoryRound = { round_no: number; prompt_text: string; prompt_kind: string; result_status: string; answers: { role: string; answer: string; author_name: string }[] }
type HistorySession = { id: string; game_type: GameType; category: GameCategory; status: string; created_at: string; completed_at: string | null; round_count: number; prompt_ids: string[]; rounds: HistoryRound[] }
type GameRoomData = { space_id: string; user_id: string; your_name: string; partner_name: string; partner_avatar_url: string | null; active_session: ActiveSession | null; history: HistorySession[] }
type GameCard = (typeof gameCatalog)[number]

const gameIcon: Record<GameType, typeof Heart> = {
  'truth-or-dare': Sparkles, 'would-you-rather': CircleHelp, 'how-well-do-you-know-me': Heart, 'guess-my-answer': Radio,
  'complete-the-sentence': Volume2, 'this-or-that': ChevronRight, 'emoji-love-challenge': Sparkles, 'deep-love-questions': Heart,
}

export function GameRoom({ userId, spaceId }: { userId: string; spaceId: string }) {
  const [room, setRoom] = useState<GameRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Finding your shared room…')
  const [connected, setConnected] = useState(false)
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameCard | null>(null)
  const [category, setCategory] = useState<GameCategory>('sweet')
  const [truthDareKind, setTruthDareKind] = useState<'truth' | 'dare'>('truth')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [completedGame, setCompletedGame] = useState<ActiveSession | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null)
  const syncRoom = useCallback(async () => {
    try {
      const response = await fetch('/api/games', { cache: 'no-store' })
      const payload = await response.json() as { room?: GameRoomData; error?: string }
      if (!response.ok || !payload.room) throw new Error(payload.error ?? 'Could not reconnect to your game.')
      setRoom(payload.room); setError(''); setLoading(false)
      const active = payload.room.active_session
      await channelRef.current?.track({ user_id: userId, page: 'games', session_id: active?.id ?? null, online_at: new Date().toISOString() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reconnect to your game.')
      setRoom(null)
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase.channel(`couple:${spaceId}`, { config: { private: true, presence: { key: userId }, broadcast: { self: false } } })
      .on('presence', { event: 'sync' }, () => setPartnerOnline(Object.keys(channel.presenceState()).some((key) => key !== userId)))
      .on('broadcast', { event: 'game_changed' }, () => { void syncRoom() })
      .subscribe(async (state) => {
        if (state === 'SUBSCRIBED') {
          channelRef.current = channel; setConnected(true); setStatus('Your private game room is live.')
          await channel.track({ user_id: userId, page: 'games', session_id: null, online_at: new Date().toISOString() })
          await syncRoom()
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') { setConnected(false); setStatus('Reconnecting to your shared room…') }
        else if (state === 'CLOSED') { setConnected(false); setStatus('Connection paused. Reopen to rejoin your game.') }
      })
    channelRef.current = channel
    return () => { channelRef.current = null; void supabase.removeChannel(channel) }
  }, [spaceId, syncRoom, userId])

  useEffect(() => {
    const firstLoad = window.setTimeout(() => { void syncRoom() }, 0)
    const timer = window.setInterval(() => { void syncRoom() }, 15000)
    return () => { window.clearTimeout(firstLoad); window.clearInterval(timer) }
  }, [syncRoom])

  async function mutate(body: Record<string, unknown>) {
    setBusy(true); setError('')
    const before = room?.active_session ?? null
    try {
      const response = await fetch('/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json() as { room?: GameRoomData; error?: string; transition?: { status?: string } }
      if (!response.ok || !payload.room) throw new Error(payload.error ?? 'That game move did not go through.')
      setRoom(payload.room); setAnswer('')
      if (body.action === 'complete' || (body.action === 'next' && payload.transition?.status === 'completed')) setCompletedGame(before)
      else if (body.action === 'start' || body.action === 'replay') setCompletedGame(null)
      await channelRef.current?.send({ type: 'broadcast', event: 'game_changed', payload: { session_id: payload.room.active_session?.id ?? before?.id ?? null } })
      await channelRef.current?.track({ user_id: userId, page: 'games', session_id: payload.room.active_session?.id ?? null, online_at: new Date().toISOString() })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That game move did not go through.')
      return false
    } finally { setBusy(false) }
  }

  async function startGame(game: GameCard, selectedCategory: GameCategory) {
    const started = await mutate({ action: 'start', gameType: game.id, category: selectedCategory, ...(game.id === 'truth-or-dare' ? { truthDareKind } : {}) })
    if (started) setSelectedGame(null)
  }

  if (loading || !room) return <div className="private-shell"><PrivateNav active="/games"/><main className="private-main"><header className="private-topbar"><Link href="/home" className="private-breadcrumb">HOME <span className="crumb-slash">/</span> PLAY</Link></header><div className="game-content game-loading"><LoaderCircle size={22}/><p>{error || 'Opening your shared game room…'}</p><button onClick={() => { setLoading(true); void syncRoom() }}>Try again</button></div></main></div>

  const active = room.active_session
  const currentGame = active ? gameCatalog.find((game) => game.id === active.game_type) ?? null : null
  const completeGame = completedGame ? gameCatalog.find((game) => game.id === completedGame.game_type) : null

  return <div className="private-shell"><PrivateNav active="/games"/><main className="private-main"><header className="private-topbar"><div className="private-breadcrumb"><Link href="/home">HOME</Link><span className="crumb-slash">/</span><b>PLAY</b></div><span className="live-pill"><i className={connected ? 'game-live-dot' : ''}/>{partnerOnline ? `${room.partner_name} is here` : connected ? `${room.partner_name} is offline` : status}</span></header><div className="game-content game-engine">
    <p className="private-eyebrow"><span/> GOOD THINGS HAPPEN HERE</p><h1>Make a little<br/><em>time for two.</em></h1><p className="feature-lede">Eight ways to get curious, laugh a little, and hear something new from your person.</p>{error && <p className="game-error" role="alert">{error}</p>}
    {active && currentGame ? <ActiveGame session={active} game={currentGame} room={room} busy={busy} answer={answer} setAnswer={setAnswer} onAction={(action, details) => void mutate({ action, sessionId: active.id, ...details })} onSubmit={() => void mutate({ action: 'submit', sessionId: active.id, answer })} connected={connected}/> : completedGame && completeGame ? <Completion game={completeGame} session={completedGame} room={room} busy={busy} onReplay={() => void mutate({ action: 'replay', gameType: completedGame.game_type, category: completedGame.category })} onBrowse={() => setCompletedGame(null)}/> : selectedGame ? <GameSetup game={selectedGame} category={category} setCategory={setCategory} truthDareKind={truthDareKind} setTruthDareKind={setTruthDareKind} onBack={() => setSelectedGame(null)} onStart={() => void startGame(selectedGame, category)} busy={busy} connected={connected}/> : <GameShelf room={room} onSelect={(game) => { setCategory('sweet'); setTruthDareKind('truth'); setSelectedGame(game) }} onHistory={() => setHistoryOpen(true)}/>}
    <div className="game-room-foot"><span><Radio size={13}/> {connected ? 'Changes save as you play' : status}</span><button onClick={() => setHistoryOpen(true)}>Game history <Clock3 size={13}/></button></div>
    {historyOpen && <HistoryModal history={room.history} onClose={() => setHistoryOpen(false)}/>}
  </div></main></div>
}

function GameShelf({ room, onSelect, onHistory }: { room: GameRoomData; onSelect: (game: GameCard) => void; onHistory: () => void }) {
  return <><div className="game-shelf-head"><p className="private-eyebrow">CHOOSE A CARD DECK</p><p>Best played with curiosity. Every round can be skipped, and either of you can pause.</p></div><div className="game-card-grid">{gameCatalog.map((game, index) => { const Icon = gameIcon[game.id]; return <button key={game.id} className={`game-deck-card deck-${game.id}`} onClick={() => onSelect(game)}><span className="deck-index">0{index + 1}</span><span className="deck-icon"><Icon size={20}/></span><span className="deck-personality">{game.personality}</span><strong>{game.name}</strong><small>{game.description}</small><span className="deck-open">Open the deck <ChevronRight size={14}/></span></button> })}</div><div className="game-history-teaser"><div><p className="private-eyebrow">MADE TO COME BACK TO</p><h2>{room.history.length ? `${room.history.length} little ${room.history.length === 1 ? 'game' : 'games'} you’ve played.` : 'Your story starts with one round.'}</h2></div><button onClick={onHistory}>See game history <ChevronRight size={15}/></button></div></>
}

function GameSetup({ game, category, setCategory, truthDareKind, setTruthDareKind, onBack, onStart, busy, connected }: { game: GameCard; category: GameCategory; setCategory: (category: GameCategory) => void; truthDareKind: 'truth' | 'dare'; setTruthDareKind: (kind: 'truth' | 'dare') => void; onBack: () => void; onStart: () => void; busy: boolean; connected: boolean }) {
  const Icon = gameIcon[game.id]
  return <section className={`game-setup setup-${game.id}`}><button className="game-back" onClick={onBack}><ArrowLeft size={14}/> All games</button><div className="setup-cover"><span className="setup-illustration"><Icon size={25}/></span><div><p className="private-eyebrow">{game.personality}</p><h2>{game.name}</h2><p>{game.instructions}</p></div><span className="setup-stamp">JUST<br/>YOU TWO</span></div>{game.id === 'truth-or-dare' && <div className="truth-picker"><p className="private-eyebrow">WHAT’S YOUR FIRST TURN?</p><div><button className={truthDareKind === 'truth' ? 'selected' : ''} onClick={() => setTruthDareKind('truth')}>Truth <small>A little honesty</small></button><button className={truthDareKind === 'dare' ? 'selected' : ''} onClick={() => setTruthDareKind('dare')}>Dare <small>A gentle challenge</small></button></div></div>}<div className="category-section"><p className="private-eyebrow">SET THE MOOD</p><div className="category-list">{categories.map((item) => <button key={item.id} className={category === item.id ? 'category-chip selected' : 'category-chip'} onClick={() => setCategory(item.id)} aria-pressed={category === item.id}><span>{item.label}</span><small>{item.note}</small>{category === item.id && <Check size={15}/>}</button>)}</div></div><div className="setup-action-row"><p><Heart size={14}/> {game.answerMode === 'turn' ? 'Take turns answering. Your turn changes each round.' : game.answerMode === 'guess' ? 'One answers for real; one makes a guess. Roles trade next round.' : 'You each answer privately. You’ll see both when you are ready.'}</p><button className="button button-dark" disabled={busy || !connected} onClick={onStart}>{busy ? <><LoaderCircle size={15}/> Shuffling the cards…</> : <>Start a round <ChevronRight size={15}/></>}</button></div>{!connected && <p className="game-need-connection">Reconnect to the private room to start.</p>}</section>
}

function ActiveGame({ session, game, room, busy, answer, setAnswer, onAction, onSubmit, connected }: { session: ActiveSession; game: GameCard; room: GameRoomData; busy: boolean; answer: string; setAnswer: (answer: string) => void; onAction: (action: string, details?: Record<string, unknown>) => void; onSubmit: () => void; connected: boolean }) {
  const round = session.round
  const revealed = round.result_status === 'revealed'
  const resolved = round.result_status !== 'active'
  const waiting = session.status === 'paused'
  const inputDisabled = busy || waiting || !connected || round.my_submitted || (session.answer_mode === 'turn' && !round.is_my_turn)
  const answerRole = round.my_answer_role === 'answer' ? 'Write your real answer' : round.my_answer_role === 'guess' ? `Guess ${room.partner_name.split(' ')[0]}’s answer` : 'Your answer'
  const optionText = (value: string | null) => value === 'A' ? round.option_a : value === 'B' ? round.option_b : value
  return <section className={`active-card active-${game.id}`}><div className="active-card-top"><div><button className="game-back" onClick={() => onAction('pause')} disabled={busy || waiting}><Pause size={14}/> Pause</button><p className="private-eyebrow">{categories.find((item) => item.id === session.category)?.label.toUpperCase()} <span>· ROUND {String(round.round_no).padStart(2,'0')}</span></p><h2>{game.name}</h2></div><span className="active-status"><i className={waiting ? 'paused-dot' : ''}/>{waiting ? 'PAUSED' : connected ? 'IN YOUR SHARED ROOM' : 'RECONNECTING'}</span></div>
    {waiting && <div className="paused-banner"><Pause size={15}/> This game is paused for both of you. <button onClick={() => onAction('resume')} disabled={busy || !connected}>Resume <Play size={13}/></button></div>}
    <div className="physical-card" key={round.prompt_id}><div className="card-corner"><span>SHUVIA</span><span>{round.prompt_kind.toUpperCase()}</span></div><p>{round.prompt_text}</p>{round.option_a && round.option_b && <div className="card-options"><span>A <b>{round.option_a}</b></span><i>OR</i><span>B <b>{round.option_b}</b></span></div>}<span className="card-seal">{round.prompt_kind === 'truth' ? 'T' : round.prompt_kind === 'dare' ? 'D' : 'S'}</span></div>
    {!resolved && <div className="answer-zone">{session.answer_mode === 'turn' && !round.is_my_turn ? <div className="waiting-answer"><Clock3 size={19}/><div><strong>It’s {room.partner_name.split(' ')[0]}’s turn.</strong><p>Their answer will appear here when they’re ready.</p></div></div> : round.my_submitted ? <div className="waiting-answer"><Check size={19}/><div><strong>Your answer is tucked away.</strong><p>{round.partner_submitted ? 'Revealing your round…' : `Waiting for ${room.partner_name.split(' ')[0]} to answer. Neither response is visible yet.`}</p></div></div> : <><label htmlFor="game-answer">{session.answer_mode === 'turn' ? 'Your turn' : answerRole}<span>{session.answer_mode === 'turn' ? 'Only the person whose turn it is answers this round.' : 'Your answer is private until the round is ready to reveal.'}</span></label>{round.prompt_kind === 'choice' ? <div className="game-choice-options"><button className={answer === 'A' ? 'game-choice selected' : 'game-choice'} disabled={inputDisabled} onClick={() => setAnswer('A')}><span>A</span>{round.option_a}</button><button className={answer === 'B' ? 'game-choice selected' : 'game-choice'} disabled={inputDisabled} onClick={() => setAnswer('B')}><span>B</span>{round.option_b}</button></div> : <textarea id="game-answer" value={answer} maxLength={round.prompt_kind === 'emoji' ? 60 : 1000} disabled={inputDisabled} onChange={(event) => setAnswer(event.target.value)} placeholder={round.prompt_kind === 'emoji' ? 'Use up to five emoji…' : 'Take your time…'}/>}<button className="button button-dark answer-submit" disabled={inputDisabled || !answer.trim()} onClick={onSubmit}>{busy ? <><LoaderCircle size={15}/> Tucking that away…</> : <>Submit privately <ChevronRight size={15}/></>}</button></>}</div>}
    {resolved && <div className={revealed ? 'answer-reveal' : 'answer-reveal is-skipped'}>{revealed ? <><p className="private-eyebrow">A LITTLE MORE OF EACH OTHER</p>{session.answer_mode === 'turn' ? <article><span>{round.is_my_turn ? 'YOUR ANSWER' : room.partner_name.toUpperCase()}</span><p>{round.is_my_turn ? round.my_answer : round.partner_answer}</p></article> : <div className="reveal-grid"><article><span>YOU · {round.my_answer_role.toUpperCase()}</span><p>{optionText(round.my_answer)}</p></article><article><span>{room.partner_name.toUpperCase()} · {round.my_answer_role === 'answer' ? 'GUESS' : round.my_answer_role === 'guess' ? 'ANSWER' : 'THEIR ANSWER'}</span><p>{optionText(round.partner_answer)}</p></article></div>}</> : <><p className="private-eyebrow">ROUND SKIPPED</p><p>Skipped answers stay private. Choose another card whenever you’re both ready.</p></>}</div>}
    <div className="game-round-controls"><button disabled={busy || waiting || !connected || resolved} onClick={() => onAction('skip')}><SkipForward size={14}/> Skip this card</button><span>{round.my_submitted && !resolved ? 'Your answer is in' : round.partner_submitted && !resolved ? `${room.partner_name.split(' ')[0]} has answered` : 'Take the time you need'}</span>{resolved && <>{game.id === 'truth-or-dare' && <div className="next-truth-picker"><button onClick={() => onAction('next', { truthDareKind: 'truth' })} disabled={busy || waiting || !connected}>Next: Truth</button><button onClick={() => onAction('next', { truthDareKind: 'dare' })} disabled={busy || waiting || !connected}>Next: Dare</button></div>}{game.id !== 'truth-or-dare' && <button disabled={busy || waiting || !connected} onClick={() => onAction('next')}>Next round <ChevronRight size={14}/></button>}<button disabled={busy || waiting || !connected} onClick={() => onAction('complete')}>Finish game</button></>}</div>
  </section>
}

function Completion({ game, session, room, busy, onReplay, onBrowse }: { game: GameCard; session: ActiveSession; room: GameRoomData; busy: boolean; onReplay: () => void; onBrowse: () => void }) {
  return <section className="game-completion"><span className="completion-spark">✳</span><p className="private-eyebrow">A LITTLE TIME WELL SPENT</p><h2>You made a moment<br/>of <em>it.</em></h2><p>You and {room.partner_name.split(' ')[0]} shared {session.round_count} {session.round_count === 1 ? 'round' : 'rounds'} of {game.name}.</p><div className="completion-actions"><button className="button button-dark" disabled={busy} onClick={onReplay}>{busy ? 'Shuffling a fresh set…' : <>Play again <RotateCcw size={14}/></>}</button><button className="game-secondary" onClick={onBrowse}>Choose another game <ChevronRight size={14}/></button></div></section>
}

function HistoryModal({ history, onClose }: { history: HistorySession[]; onClose: () => void }) {
  return <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title"><header><div><p className="private-eyebrow">THE TWO OF YOU, OVER TIME</p><h2 id="history-title">Game history</h2></div><button onClick={onClose} aria-label="Close game history">×</button></header>{history.length ? <div className="history-list">{history.map((session) => { const game = gameCatalog.find((item) => item.id === session.game_type); return <article key={session.id}><div className="history-meta"><strong>{game?.name ?? session.game_type}</strong><span>{categories.find((item) => item.id === session.category)?.label}</span><time>{new Date(session.completed_at ?? session.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</time></div><p>{session.round_count} {session.round_count === 1 ? 'round' : 'rounds'}</p>{session.rounds.map((round) => <details key={round.round_no} className="history-round"><summary>Round {round.round_no} · {round.prompt_text}</summary>{round.result_status === 'skipped' ? <small>This card was skipped.</small> : round.answers.map((item, i) => <p key={i}><b>{item.author_name} · {item.role}</b><span>{item.answer}</span></p>)}</details>)}</article> })}</div> : <div className="history-empty"><Clock3 size={21}/><p>No finished games yet.</p><span>Your completed rounds will live here.</span></div>}<button className="history-close" onClick={onClose}>Back to the games <ChevronRight size={14}/></button></section></div>
}
