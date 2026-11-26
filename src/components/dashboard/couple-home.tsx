'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, Check, ChevronRight, Clock3, Copy, Gamepad2, Heart, Home, ImagePlus, Link2, LoaderCircle, LockKeyhole, Menu, MessageCircle, Plus, Share2, Sparkles, UserRound, Wifi, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { LocalizedTime } from '@/components/app/localized-time'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'

export type DashboardData = {
  space_id: string; your_name: string; your_avatar_url: string | null; partner_name: string; partner_avatar_url: string | null; connected_at: string
  your_share_online_status?: boolean; your_share_activity?: boolean; your_notifications_enabled?: boolean
  notes: { id: string; body: string; created_at: string; author_name: string }[]
  dates: { id: string; title: string; occurs_on: string }[]
  memories: { id: string; caption: string; remembered_on: string; created_at: string; author_name: string }[]
  activity: { id: number; event_type: string; summary: string; created_at: string; actor_name: string | null }[]
}

const nav = [
  { label: 'Home', href: '/home', icon: Home }, { label: 'Games', href: '/games', icon: Gamepad2 },
  { label: 'Love Notes', href: '/notes', icon: MessageCircle }, { label: 'Surprises', href: '/surprises', icon: Sparkles },
  { label: 'Memories', href: '/memories', icon: Heart }, { label: 'Our Days', href: '/our-days', icon: CalendarDays },
]
const mobileNav = nav
let clientNow = 0
function subscribeToClock(callback: () => void) {
  const timer = window.setTimeout(() => { clientNow = Date.now(); callback() }, 0)
  return () => window.clearTimeout(timer)
}
function getClockSnapshot() { return clientNow }
function getServerClockSnapshot() { return 0 }
const questions = [
  'What small thing did your person do that made you feel loved?',
  'If you could relive one ordinary day together, which would you choose?',
  'What is something you want to learn or try together this year?',
  'What song feels a little like the two of you?',
  'What is one thing you are looking forward to sharing next?',
  'What is a tiny detail about your person you hope you never forget?',
  'If tonight had a soundtrack, what would the first song be?',
]

function dailyQuestion(now: number) {
  const day = Math.floor(now / 86400000)
  return questions[((day % questions.length) + questions.length) % questions.length]
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() }
function avatarStyle(url: string | null) { return url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined }
function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) { return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }) }
function daysSince(value: string, now: number) { return Math.max(1, Math.floor((now - new Date(value).getTime()) / 86400000) + 1) }

type ConnectionSummary = { state: string; is_owner?: boolean; invitation_expires_at?: string | null; partner_name?: string | null }
type AccountSummary = { fullName: string; email: string; avatarUrl: string | null }
type GeneratedInvite = { code: string; inviteUrl: string; expiresAt: string }

export function PrivateNav({ active, initialState, initialName }: { active: string; initialState?: string; initialName?: string }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [connection, setConnection] = useState<ConnectionSummary>({ state: initialState ?? 'loading' })
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [invite, setInvite] = useState<GeneratedInvite | null>(null)
  const [busy, setBusy] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [consented, setConsented] = useState(false)
  const router = useRouter()
  const name = account?.fullName || initialName || 'My profile'
  const initialsText = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'S'

  useEffect(() => {
    let live = true
    const loadAccount = () => { void fetch('/api/settings', { cache: 'no-store' }).then(async (response) => response.ok ? response.json() : null).then((settings) => { if (live && settings?.account) setAccount(settings.account as AccountSummary) }).catch(() => undefined) }
    const loadConnection = () => { void fetch('/api/couple', { cache: 'no-store' }).then(async (response) => response.ok ? response.json() : null).then((couple) => { if (live && couple?.space) setConnection(couple.space as ConnectionSummary) }).catch(() => undefined) }
    loadAccount(); loadConnection()
    window.addEventListener('shuvia:profile-updated', loadAccount)
    window.addEventListener('shuvia:connection-updated', loadConnection)
    return () => { live = false; window.removeEventListener('shuvia:profile-updated', loadAccount); window.removeEventListener('shuvia:connection-updated', loadConnection) }
  }, [])

  useEffect(() => {
    if (!inviteOpen) return
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') setInviteOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inviteOpen])

  async function generateInvitation() {
    setBusy(true); setError(''); setNotice(''); setCopied(null)
    try {
      const action = connection.state === 'invitation_expired' || connection.state === 'invitation_sent' || connection.state === 'waiting_for_partner' ? 'regenerate' : 'create'
      const response = await fetch('/api/couple', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(action === 'create' ? { consentPolicy: true } : {}) }) })
      const result = await response.json() as GeneratedInvite & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'We could not create the invitation yet.')
      setInvite(result)
      setConnection((current) => ({ ...current, state: 'invitation_sent', is_owner: true, invitation_expires_at: result.expiresAt }))
      setConsented(false)
      setNotice('Your invitation is ready. Save the code now; it will not be shown again.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not create the invitation yet.') }
    finally { setBusy(false) }
  }

  async function copyInvite(kind: 'code' | 'link') {
    if (!invite) return
    try { await navigator.clipboard.writeText(kind === 'code' ? invite.code : invite.inviteUrl); setCopied(kind); setNotice(kind === 'code' ? 'Invitation code copied.' : 'Invitation link copied.') }
    catch { setError('Clipboard access is unavailable. Select and copy the invitation manually.') }
  }

  async function shareInvite() {
    if (!invite) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Shuvia space', text: `Use invitation code ${invite.code} to join my Shuvia space.`, url: invite.inviteUrl }); setNotice('Invitation shared.') }
      catch (cause) { if (cause instanceof Error && cause.name !== 'AbortError') setError('Sharing is unavailable on this device.') }
    } else await copyInvite('link')
  }

  async function logout() {
    setLogoutBusy(true); setMenuError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (!response.ok) throw new Error('Please try logging out again.')
      router.replace('/login'); router.refresh()
    } catch (cause) { setMenuError(cause instanceof Error ? cause.message : 'Please try logging out again.') }
    finally { setLogoutBusy(false) }
  }

  const connected = connection.state === 'connected'
  const invitePending = ['invitation_sent', 'waiting_for_partner', 'invitation_expired', 'invitation_accepted'].includes(connection.state)
  return <>
    <header className="private-global-nav">
      <ShuviaLogo href="/home" className="private-brand"/>
      <nav className="private-primary-nav" aria-label="Main dashboard navigation">
        {nav.map(({ label, href }) => <Link key={href} href={href} aria-current={active === href ? 'page' : undefined} className={active === href ? 'private-primary-link is-current' : 'private-primary-link'}>{label}</Link>)}
      </nav>
      <div className="private-nav-actions">
        {connected ? <span className="private-connection-pill"><i/>Connected{connection.partner_name ? ` with ${connection.partner_name.split(' ')[0]}` : ''}</span> : <button className="private-invite-button" onClick={() => { setInviteOpen(true); setProfileOpen(false); setMoreOpen(false) }}><Heart size={15}/>Invite Partner</button>}
        <button className="private-avatar-button" aria-label={`Open profile menu for ${name}`} aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setMoreOpen(false) }}>
          {account?.avatarUrl ? <span className="private-avatar-photo" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(account.avatarUrl)})` }}/> : <span>{initialsText}</span>}
        </button>
        <button className="private-more-button" aria-label="More navigation and actions" aria-expanded={moreOpen} onClick={() => { setMoreOpen((open) => !open); setProfileOpen(false) }}><Menu size={18}/></button>
        {profileOpen && <div className="private-popover private-profile-menu" role="menu"><div className="private-profile-head">{account?.avatarUrl ? <span className="private-avatar-photo" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(account.avatarUrl)})` }}/> : <span>{initialsText}</span>}<div><b>{name}</b><small>{account?.email ?? 'Your Shuvia account'}</small></div></div>
          <Link role="menuitem" href="/settings?tab=account#profile" onClick={() => setProfileOpen(false)}><UserRound size={15}/>My Profile</Link>
          <Link role="menuitem" href="/settings?tab=account#profile" onClick={() => setProfileOpen(false)}><UserRound size={15}/>Edit Profile</Link>
          <Link role="menuitem" href="/settings?tab=account#account-security" onClick={() => setProfileOpen(false)}><LockKeyhole size={15}/>Account Settings</Link>
          <Link role="menuitem" href="/settings?tab=preferences#theme-preferences" onClick={() => setProfileOpen(false)}><Sparkles size={15}/>Theme Preferences</Link>
          <Link role="menuitem" href="/settings?tab=preferences#privacy-preferences" onClick={() => setProfileOpen(false)}><LockKeyhole size={15}/>Privacy Settings</Link>
          <button role="menuitem" onClick={() => { setProfileOpen(false); setInviteOpen(true) }}><Link2 size={15}/>Invitation Management</button>
          <Link role="menuitem" href="/space" onClick={() => setProfileOpen(false)}><Heart size={15}/>Relationship Management</Link>
          {menuError && <p className="private-menu-error" role="alert">{menuError}</p>}
          <div className="private-menu-divider"/><button type="button" role="menuitem" disabled={logoutBusy} onClick={() => void logout()}><X size={15}/>{logoutBusy ? 'Logging out…' : 'Log out'}</button>
        </div>}
        {moreOpen && <div className="private-popover private-more-menu"><p>MORE</p><Link href="/join" onClick={() => setMoreOpen(false)}><Link2 size={15}/>Join with Invitation Code</Link><Link href="/space" onClick={() => setMoreOpen(false)}><Heart size={15}/>Relationship Management</Link>{!connected && <button onClick={() => { setMoreOpen(false); setInviteOpen(true) }}><Share2 size={15}/>Invite your partner</button>}</div>}
      </div>
    </header>
    <nav className="private-mobile-nav" aria-label="Your Shuvia navigation">{mobileNav.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-current={active === href ? 'page' : undefined} className={active === href ? 'mobile-nav-link is-current' : 'mobile-nav-link'}><Icon size={19}/><span>{label}</span></Link>)}</nav>
    {inviteOpen && <div className="private-dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false) }}><section className="private-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="private-invite-title"><button className="private-dialog-close" aria-label="Close invitation manager" onClick={() => setInviteOpen(false)}><X size={18}/></button><div className="private-dialog-mark"><Heart size={20}/></div><p className="private-dialog-eyebrow">A PRIVATE INVITATION</p><h2 id="private-invite-title">Invite Your Partner</h2><p className="private-dialog-copy">Share an invitation to connect your accounts and create your shared space.</p>
      {error && <p className="private-dialog-error" role="alert">{error}</p>}{notice && <p className="private-dialog-notice" role="status">{notice}</p>}
      {connected ? <div className="private-invite-state"><span className="private-connection-pill"><i/>CONNECTED</span><p>Your shared space with {connection.partner_name || 'your person'} is ready.</p><Link href="/space" onClick={() => setInviteOpen(false)}>Manage your connection <ChevronRight size={15}/></Link></div> : invite ? <div className="private-invite-result"><span className="private-dialog-eyebrow">YOUR INVITATION CODE</span><strong>{invite.code}</strong><div className="private-invite-actions"><button onClick={() => void copyInvite('code')}>{copied === 'code' ? <Check size={15}/> : <Copy size={15}/>}Copy Code</button><button onClick={() => void copyInvite('link')}>{copied === 'link' ? <Check size={15}/> : <Link2 size={15}/>}Copy Invitation Link</button><button onClick={() => void shareInvite()}><Share2 size={15}/>Share Invitation</button></div><p>Expires {new Date(invite.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · shown once</p></div> : invitePending ? <div className="private-invite-state"><span className={`private-invite-status ${connection.state === 'invitation_expired' ? 'is-expired' : ''}`}>{connection.state === 'invitation_accepted' ? 'ACCEPTANCE WAITING FOR CONFIRMATION' : connection.state === 'invitation_expired' ? 'INVITATION EXPIRED' : 'INVITATION IN PROGRESS'}</span>{connection.invitation_expires_at && <p>Expires {new Date(connection.invitation_expires_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. For your security, the original code cannot be shown again.</p>}<Link href="/space" onClick={() => setInviteOpen(false)}>Review invitation status <ChevronRight size={15}/></Link>{connection.is_owner && connection.state !== 'invitation_accepted' && <button className="private-dialog-primary" disabled={busy} onClick={() => void generateInvitation()}>{busy ? 'Preparing…' : 'Regenerate Invitation'}</button>}</div> : <div className="private-invite-state"><p>Your accounts stay separate. Either person can end the connection. Your partner must accept before you confirm the shared space.</p><label className="private-invite-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)}/><span>I understand and consent to create this private shared space.</span></label><button className="private-dialog-primary" disabled={busy || !consented || connection.state === 'loading'} onClick={() => void generateInvitation()}>{busy ? 'Preparing your invitation…' : 'Generate Invitation'}</button></div>}
      {!connected && <Link className="private-dialog-join" href="/join" onClick={() => setInviteOpen(false)}>Join with Invitation Code</Link>}
    </section></div>}
  </>
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
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot)
  const question = useMemo(() => dailyQuestion(now), [now])

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
      .on('broadcast', { event: 'partner_joined' }, () => { if (data.your_notifications_enabled !== false) setPartnerJoined(true) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'couple_activity_events', filter: `space_id=eq.${data.space_id}` }, () => {
        if (data.your_notifications_enabled !== false) setNewActivity((count) => count + 1)
        router.refresh()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setLiveState('live')
          if (data.your_share_online_status !== false) await channel.track({ user_id: userId, full_name: data.your_name, page: 'home', online_at: new Date().toISOString(), share_activity: data.your_share_activity !== false })
          await channel.send({ type: 'broadcast', event: 'partner_joined', payload: { user_id: userId, joined_at: new Date().toISOString() } })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveState('reconnecting')
        else if (status === 'CLOSED') setLiveState('offline')
      })
    return () => { void supabase.removeChannel(channel) }
  }, [data.space_id, data.your_name, data.your_share_activity, data.your_share_online_status, data.your_notifications_enabled, router, userId])

  const together = now ? daysSince(data.connected_at, now) : null
  const nextDate = data.dates[0]
  return <div className="private-shell"><PrivateNav active="/home" initialName={data.your_name}/><main className="private-main">
    <header className="private-topbar"><div className="private-breadcrumb"><span>YOUR SPACE</span><span className="crumb-slash">/</span><b>HOME</b></div><div className="private-top-actions"><span className="partner-identity"><i style={avatarStyle(data.partner_avatar_url)}>{!data.partner_avatar_url && initials(data.partner_name)}</i><b>{data.partner_name}</b></span><span className={`live-pill live-${liveState}`}><i/>{liveState === 'live' ? partnerOnline ? 'Online' : 'Offline' : liveState === 'reconnecting' ? 'Reconnecting' : liveState === 'offline' ? 'Offline' : 'Checking status'}</span>{data.your_notifications_enabled !== false && <button className="notification-button" aria-label="Show recent updates" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(!notificationOpen); setNewActivity(0) }}><Bell size={18}/>{newActivity > 0 && <i/>}</button>}</div>
      {notificationOpen && data.your_notifications_enabled !== false && <section className="notification-popover"><div className="popover-heading"><strong>Little updates</strong><button aria-label="Close updates" onClick={() => setNotificationOpen(false)}>×</button></div>{data.activity.length ? data.activity.map((item) => <p key={item.id}><i/>{item.summary}<small>{new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></p>) : <div className="notification-empty"><Bell size={20}/><span>No new notes or shared moments yet.</span></div>}</section>}
    </header>
    <div className="home-content">{partnerJoined && <button className="partner-joined-toast" role="status" onClick={() => setPartnerJoined(false)}><span className="peer-presence is-online"/>{data.partner_name} just joined your little world <span>×</span></button>}
      <section className="home-welcome"><div><p className="private-eyebrow"><span/> A SMALL PLACE THAT'S YOURS</p><h1>Good to have you<br/>here, <em>{data.your_name.split(' ')[0]}.</em></h1><p className="welcome-copy">A little corner for you and {data.partner_name.split(' ')[0]} — wherever today finds you.</p><div className="welcome-links"><Link href="/notes" className="home-text-link">Leave a little note <ChevronRight size={15}/></Link><Link href="/space" className="home-text-link">Connection details <ChevronRight size={15}/></Link></div></div><div className="together-card"><div className="together-flower">âœ³</div><p>YOUR SHUVIA STORY</p><strong>{together ?? '—'}</strong><span>{together === null ? 'days in your little world' : together === 1 ? 'day in your little world' : 'days in your little world'}</span><small>Since {<LocalizedTime value={data.connected_at} options={{ month: 'long', year: 'numeric' }}/>}</small></div></section>

      <section className="home-question"><div className="question-copy"><p className="private-eyebrow">TODAY, BETWEEN THE TWO OF YOU <span>· {(now ? dateLabel(new Date(now).toISOString()) : '—')}</span></p><h2>{question}</h2><Link href="/games" className="question-link">Take it to your games <ChevronRight size={15}/></Link></div><div className="question-response"><span className="question-art">“</span><p>Some questions make the miles feel a little smaller.</p><Link href="/games" className="button button-dark">Start together <ChevronRight size={15}/></Link></div></section>

      <div className="home-grid home-grid-main"><section className="home-panel play-panel"><div className="panel-top"><div><p className="private-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>{partnerPlaying ? 'Your person is playing.' : 'A little time to play?'}</h2></div><Gamepad2 size={19}/></div><p>{partnerPlaying ? `${data.partner_name.split(' ')[0]} has a question open in your shared room. Join in whenever you’re ready.` : 'No shared game is in progress yet. Pick a question, a dare, or a virtual date and make a new little ritual.'}</p><Link href="/games" className="panel-action">{partnerPlaying ? 'Join their round' : 'Find something to play'} <ChevronRight size={15}/></Link></section>
      <section className="home-panel note-panel"><div className="panel-top"><div><p className="private-eyebrow">WORDS TO KEEP CLOSE</p><h2>Recent love notes</h2></div><MessageCircle size={18}/></div>{data.notes.length ? <div className="recent-notes">{data.notes.map((note) => <article key={note.id}><p>“{note.body}”</p><small>{note.author_name} <span>·</span> {<LocalizedTime value={note.created_at} options={{ month: 'short', day: 'numeric' }}/>}</small></article>)}</div> : <div className="mini-empty"><span className="empty-illustration note-empty-art"><MessageCircle size={19}/></span><p>A blank page for something kind.</p><Link href="/notes">Write the first note <ChevronRight size={14}/></Link></div>}<Link className="panel-arrow" href="/notes" aria-label="Open all love notes"><ChevronRight size={18}/></Link></section></div>

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
  return <div className="private-shell"><PrivateNav active={active} initialName={data.your_name}/><main className="private-main"><header className="private-topbar"><div className="private-breadcrumb"><Link href="/home">HOME</Link><span className="crumb-slash">/</span><b>{title.toUpperCase()}</b></div><Link href="/space" className="feature-partners"><span>{initials(data.your_name)}</span><span>{initials(data.partner_name)}</span><span>{data.your_name.split(' ')[0]} & {data.partner_name.split(' ')[0]}</span></Link></header><div className="feature-content"><p className="private-eyebrow"><span/> {eyebrow}</p><h1>{title}</h1><p className="feature-lede">{description}</p>
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
