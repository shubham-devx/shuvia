'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, ChevronRight, Clock3, Gamepad2, Heart, Home, ImagePlus, LoaderCircle, LockKeyhole, MessageCircle, Plus, Settings, Sparkles, Wifi } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/auth/logout-button'

export type DashboardData = {
  space_id: string; your_name: string; your_avatar_url: string | null; partner_name: string; partner_avatar_url: string | null; connected_at: string
  your_share_online_status?: boolean; your_share_activity?: boolean; your_notifications_enabled?: boolean
  notes: { id: string; body: string; created_at: string; author_name: string }[]
  dates: { id: string; title: string; occurs_on: string }[]
  memories: { id: string; caption: string; remembered_on: string; created_at: string; author_name: string }[]
  activity: { id: number; event_type: string; summary: string; created_at: string; actor_name: string | null }[]
}

const nav = [
  { label: 'Home', href: '/home', icon: Home }, { label: 'Play', href: '/games', icon: Gamepad2 },
  { label: 'Notes', href: '/notes', icon: MessageCircle }, { label: 'Memories', href: '/memories', icon: Heart },
  { label: 'Surprises', href: '/surprises', icon: Sparkles }, { label: 'Our Days', href: '/our-days', icon: CalendarDays }, { label: 'Settings', href: '/settings', icon: Settings },
]
const questions = [
  'What small thing did your person do that made you feel loved?',
  'If you could relive one ordinary day together, which would you choose?',
  'What is something you want to learn or try together this year?',
  'What song feels a little like the two of you?',
  'What is one thing you are looking forward to sharing next?',
  'What is a tiny detail about your person you hope you never forget?',
  'If tonight had a soundtrack, what would the first song be?',
]

function dailyQuestion() {
  const day = Math.floor(Date.now() / 86400000)
  return questions[((day % questions.length) + questions.length) % questions.length]
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() }
function avatarStyle(url: string | null) { return url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined }
function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) { return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, options) }
function daysSince(value: string) { return Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 86400000) + 1) }

export function PrivateNav({ active }: { active: string }) {
  return <><aside className="private-side"><Link href="/home" className="private-wordmark">shuvia<span>®</span></Link><p className="private-nav-label">YOUR LITTLE WORLD</p><nav>{nav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? 'page' : undefined} className={active === href ? 'private-nav-link is-current' : 'private-nav-link'}><Icon size={17}/>{label}{active === href && <span className="nav-current-dot"/>}</Link>)}</nav><div className="private-side-bottom"><div className="side-quote">“The little things<br/>are the big things.”</div><Link href="/space" className="space-settings"><LockKeyhole size={15}/> Connection settings</Link><LogoutButton/></div></aside><nav className="private-mobile-nav" aria-label="Your Shuvia navigation">{nav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? 'page' : undefined} className={active === href ? 'mobile-nav-link is-current' : 'mobile-nav-link'}><Icon size={19}/><span>{label}</span></Link>)}</nav></>
}

export function CoupleHome({ data, userId }: { data: DashboardData; userId: string }) {
  const router = useRouter()
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [partnerPlaying, setPartnerPlaying] = useState(false)
  const partnerOnlineRef = useRef(false)
  const [liveState, setLiveState] = useState<'connecting' | 'live' | 'reconnecting' | 'offline'>('connecting')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [newActivity, setNewActivity] = useState(0)
  const [partnerJoined, setPartnerJoined] = useState(false)
  const question = useMemo(() => dailyQuestion(), [])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let sawInitialPresence = false
    const channel = supabase.channel(`couple:${data.space_id}`, {
      config: { private: true, presence: { key: userId }, broadcast: { self: false } },
    })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string; full_name: string; page: string; session_id?: string | null; game_index?: number | null; share_online_status?: boolean; share_activity?: boolean }>()
        const peerEntries = Object.entries(state).filter(([key]) => key !== userId)
        const visiblePeers = peerEntries.flatMap(([, metadata]) => metadata).filter((entry) => entry.share_online_status !== false)
        const nowOnline = visiblePeers.length > 0
        setPartnerPlaying(visiblePeers.some((entry) => entry.page === 'games' && typeof entry.session_id === 'string'))
        if (sawInitialPresence && nowOnline && !partnerOnlineRef.current) setPartnerJoined(true)
        sawInitialPresence = true
        partnerOnlineRef.current = nowOnline
        setPartnerOnline(nowOnline)
      })
      .on('broadcast', { event: 'partner_joined' }, () => setPartnerJoined(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'couple_activity_events', filter: `space_id=eq.${data.space_id}` }, () => {
        setNewActivity((count) => count + 1)
        router.refresh()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setLiveState('live')
          await channel.track({ user_id: userId, full_name: data.your_name, page: 'home', online_at: new Date().toISOString(), share_online_status: data.your_share_online_status !== false, share_activity: data.your_share_activity !== false })
          await channel.send({ type: 'broadcast', event: 'partner_joined', payload: { user_id: userId, joined_at: new Date().toISOString() } })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveState('reconnecting')
        else if (status === 'CLOSED') setLiveState('offline')
      })
    return () => { void supabase.removeChannel(channel) }
  }, [data.space_id, data.your_name, router, userId])

  const together = daysSince(data.connected_at)
  const nextDate = data.dates[0]
  return <div className="private-shell"><PrivateNav active="/home"/><main className="private-main">
    <header className="private-topbar"><div className="private-breadcrumb"><span>YOUR SPACE</span><span className="crumb-slash">/</span><b>HOME</b></div><div className="private-top-actions"><span className={`live-pill live-${liveState}`}><i/>{liveState === 'live' ? partnerOnline ? `${data.partner_name} is here` : `${data.partner_name} is offline` : liveState === 'reconnecting' ? 'Finding your signal' : liveState === 'offline' ? 'Reconnecting' : 'Opening your space'}</span><button className="notification-button" aria-label="Show recent updates" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(!notificationOpen); setNewActivity(0) }}><Bell size={18}/>{newActivity > 0 && <i/>}</button><Link href="/settings" className="top-settings" aria-label={`${data.your_name} and ${data.partner_name}, connection settings`}><span style={avatarStyle(data.your_avatar_url)}>{!data.your_avatar_url && initials(data.your_name)}</span><span style={avatarStyle(data.partner_avatar_url)}>{!data.partner_avatar_url && initials(data.partner_name)}</span><span className="top-names">{data.your_name.split(' ')[0]} & {data.partner_name.split(' ')[0]}</span></Link></div>
      {notificationOpen && <section className="notification-popover"><div className="popover-heading"><strong>Little updates</strong><button aria-label="Close updates" onClick={() => setNotificationOpen(false)}>×</button></div>{data.activity.length ? data.activity.map((item) => <p key={item.id}><i/>{item.summary}<small>{new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></p>) : <div className="notification-empty"><Bell size={20}/><span>No new notes or shared moments yet.</span></div>}</section>}
    </header>
    <div className="home-content">{partnerJoined && <button className="partner-joined-toast" role="status" onClick={() => setPartnerJoined(false)}><span className="peer-presence is-online"/>{data.partner_name} just joined your little world <span>×</span></button>}
      <section className="home-welcome"><div><p className="private-eyebrow"><span/> A SMALL PLACE THAT'S YOURS</p><h1>Good to have you<br/>here, <em>{data.your_name.split(' ')[0]}.</em></h1><p className="welcome-copy">A little corner for you and {data.partner_name.split(' ')[0]} — wherever today finds you.</p><div className="welcome-links"><Link href="/notes" className="home-text-link">Leave a little note <ChevronRight size={15}/></Link><Link href="/space" className="home-text-link">Connection details <ChevronRight size={15}/></Link></div></div><div className="together-card"><div className="together-flower">âœ³</div><p>YOUR SHUVIA STORY</p><strong>{together}</strong><span>{together === 1 ? 'day' : 'days'} in your little world</span><small>Since {new Date(data.connected_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</small></div></section>

      <section className="home-question"><div className="question-copy"><p className="private-eyebrow">TODAY, BETWEEN THE TWO OF YOU <span>· {dateLabel(new Date().toISOString())}</span></p><h2>{question}</h2><Link href="/games" className="question-link">Take it to your games <ChevronRight size={15}/></Link></div><div className="question-response"><span className="question-art">“</span><p>Some questions make the miles feel a little smaller.</p><Link href="/games" className="button button-dark">Start together <ChevronRight size={15}/></Link></div></section>

      <div className="home-grid home-grid-main"><section className="home-panel play-panel"><div className="panel-top"><div><p className="private-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>{partnerPlaying ? 'Your person is playing.' : 'A little time to play?'}</h2></div><Gamepad2 size={19}/></div><p>{partnerPlaying ? `${data.partner_name.split(' ')[0]} has a question open in your shared room. Join in whenever you’re ready.` : 'No shared game is in progress yet. Pick a question, a dare, or a virtual date and make a new little ritual.'}</p><Link href="/games" className="panel-action">{partnerPlaying ? 'Join their round' : 'Find something to play'} <ChevronRight size={15}/></Link></section>
      <section className="home-panel note-panel"><div className="panel-top"><div><p className="private-eyebrow">WORDS TO KEEP CLOSE</p><h2>Recent love notes</h2></div><MessageCircle size={18}/></div>{data.notes.length ? <div className="recent-notes">{data.notes.map((note) => <article key={note.id}><p>“{note.body}”</p><small>{note.author_name} <span>·</span> {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></article>)}</div> : <div className="mini-empty"><span className="empty-illustration note-empty-art"><MessageCircle size={19}/></span><p>A blank page for something kind.</p><Link href="/notes">Write the first note <ChevronRight size={14}/></Link></div>}<Link className="panel-arrow" href="/notes" aria-label="Open all love notes"><ChevronRight size={18}/></Link></section></div>

      <div className="home-grid home-grid-lower"><section className="home-panel dates-panel"><div className="panel-top"><div><p className="private-eyebrow">SOMETHING TO LOOK FORWARD TO</p><h2>Our days</h2></div><CalendarDays size={18}/></div>{nextDate ? <div className="upcoming-date"><div className="date-tile"><b>{dateLabel(nextDate.occurs_on, { day: '2-digit' })}</b><span>{dateLabel(nextDate.occurs_on, { month: 'short' })}</span></div><div><strong>{nextDate.title}</strong><small>{dateLabel(nextDate.occurs_on, { weekday: 'long', month: 'long', day: 'numeric' })}</small></div></div> : <div className="mini-empty inline-empty"><span className="empty-illustration date-empty-art"><Clock3 size={18}/></span><p>No special dates yet.</p></div>}<Link className="panel-action" href="/our-days"><Plus size={14}/> Add a day to look forward to</Link></section>
      <section className="home-panel memory-panel"><div className="panel-top"><div><p className="private-eyebrow">THE LITTLE THINGS, KEPT</p><h2>Shared memories</h2></div><Heart size={18}/></div>{data.memories.length ? <div className="memory-list">{data.memories.map((memory) => <article key={memory.id}><span className="memory-marker"/><div><p>{memory.caption}</p><small>{memory.author_name} <span>·</span> {dateLabel(memory.remembered_on)}</small></div></article>)}</div> : <div className="mini-empty inline-empty"><span className="empty-illustration memory-empty-art"><ImagePlus size={18}/></span><p>Your first memory can be a sentence.</p></div>}<Link className="panel-action" href="/memories">{data.memories.length ? 'Visit your memory shelf' : 'Keep a first memory'} <ChevronRight size={14}/></Link></section></div>

      <section className="suggestion-strip"><div className="suggestion-mark"><Sparkles size={18}/></div><div><p className="private-eyebrow">A GENTLE NUDGE</p><h2>Ask each other the question you’ve been saving for a quiet moment.</h2><p>No perfect answer needed. Just a little time together.</p></div><Link href="/games" className="suggestion-cta">Choose a question <ChevronRight size={15}/></Link></section>
      <footer className="home-footer"><span>shuvia · two hearts, one little world</span><span><Wifi size={13}/> Your shared home is private to the two of you.</span></footer>
    </div>
  </main></div>
}

export function CoupleFeaturePage({ data, kind, title, eyebrow, description }: { data: DashboardData; kind: 'note' | 'date' | 'memory'; title: string; eyebrow: string; description: string }) {
  const router = useRouter()
  const [text, setText] = useState(''); const [date, setDate] = useState(''); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState('')
  const isDate = kind === 'date'; const isNote = kind === 'note'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback('')
    try {
      const result = await fetch('/api/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, title: isDate ? text : '', body: isDate ? '' : text, date: date || undefined }) })
      const payload = await result.json() as { error?: string }
      if (!result.ok) throw new Error(payload.error || 'Could not save that yet.')
      setText(''); setDate(''); setFeedback(isNote ? 'Your note is tucked into your shared space.' : isDate ? 'A day to look forward to is on your calendar.' : 'Your memory is saved for both of you.')
      router.refresh()
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Could not save that yet.') }
    finally { setBusy(false) }
  }
  const active = isNote ? '/notes' : isDate ? '/our-days' : '/memories'
  return <div className="private-shell"><PrivateNav active={active}/><main className="private-main"><header className="private-topbar"><div className="private-breadcrumb"><Link href="/home">HOME</Link><span className="crumb-slash">/</span><b>{title.toUpperCase()}</b></div><Link href="/space" className="feature-partners"><span>{initials(data.your_name)}</span><span>{initials(data.partner_name)}</span><span>{data.your_name.split(' ')[0]} & {data.partner_name.split(' ')[0]}</span></Link></header><div className="feature-content"><p className="private-eyebrow"><span/> {eyebrow}</p><h1>{title}</h1><p className="feature-lede">{description}</p>
    <div className="feature-columns"><section className="feature-compose"><p className="private-eyebrow">A LITTLE SOMETHING FOR YOUR PERSON</p><form onSubmit={submit}><label htmlFor="shared-entry">{isDate ? 'What day shall we remember?' : isNote ? 'Your note' : 'A moment to keep'}</label>{isDate ? <input id="shared-entry" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="Our next visit, anniversary…" required/> : <textarea id="shared-entry" value={text} onChange={(e) => setText(e.target.value)} maxLength={isNote ? 500 : 240} placeholder={isNote ? 'A small thing you want them to know…' : 'Where were you? What made you laugh?'} required/>}{isDate && <><label htmlFor="shared-date">The date</label><input id="shared-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} required/></>}{kind === 'memory' && <label htmlFor="memory-date">When did it happen?</label>}{kind === 'memory' && <input id="memory-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)}/>}<button type="submit" className="button button-dark" disabled={busy || !text.trim() || (isDate && !date)}>{busy ? <><LoaderCircle size={15}/> Saving…</> : <>{isNote ? 'Leave this note' : isDate ? 'Add to our days' : 'Keep this memory'} <ChevronRight size={15}/></>}</button>{feedback && <p className={feedback.startsWith('Your') || feedback.startsWith('A day') ? 'feature-feedback success' : 'feature-feedback'} role="status">{feedback}</p>}</form><p className="private-policy"><LockKeyhole size={14}/> Only the two active members of this space can see this.</p></section>
    <section className="feature-list-panel"><div className="panel-top"><div><p className="private-eyebrow">IN YOUR SHARED SPACE</p><h2>{isNote ? 'Recent notes' : isDate ? 'Dates ahead' : 'The memory shelf'}</h2></div>{isNote ? <MessageCircle size={18}/> : isDate ? <CalendarDays size={18}/> : <Heart size={18}/>}</div><FeatureEntries data={data} kind={kind}/></section></div>
    </div></main></div>
}

function FeatureEntries({ data, kind }: { data: DashboardData; kind: 'note' | 'date' | 'memory' }) {
  if (kind === 'date') return data.dates.length ? <div className="feature-entries">{data.dates.map((entry) => <article key={entry.id}><time>{dateLabel(entry.occurs_on, { weekday: 'short', month: 'short', day: 'numeric' })}</time><strong>{entry.title}</strong></article>)}</div> : <FeatureEmpty kind="date"/>
  if (kind === 'note') return data.notes.length ? <div className="feature-entries">{data.notes.map((entry) => <article key={entry.id}><p>“{entry.body}”</p><small>{entry.author_name} · {dateLabel(entry.created_at)}</small></article>)}</div> : <FeatureEmpty kind="note"/>
  return data.memories.length ? <div className="feature-entries">{data.memories.map((entry) => <article key={entry.id}><p>{entry.caption}</p><small>{entry.author_name} · {dateLabel(entry.remembered_on)}</small></article>)}</div> : <FeatureEmpty kind="memory"/>
}

function FeatureEmpty({ kind }: { kind: 'note' | 'date' | 'memory' }) {
  const Icon = kind === 'note' ? MessageCircle : kind === 'date' ? CalendarDays : Heart
  return <div className="feature-empty"><span className="empty-illustration"><Icon size={20}/></span><h3>Nothing here just yet.</h3><p>What you add will appear here for both of you.</p></div>
}
