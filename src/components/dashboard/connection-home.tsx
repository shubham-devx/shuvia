import Link from 'next/link'
import { ArrowRight, CalendarDays, Gamepad2, Heart, LockKeyhole, MessageCircle, Sparkles } from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'

type Props = { name: string; state: string; isOwner?: boolean; loadError?: boolean }

const sharedFeatures = [
  { label: 'Love notes', icon: MessageCircle },
  { label: 'Games', icon: Gamepad2 },
  { label: 'Memories', icon: Heart },
  { label: 'Our days', icon: CalendarDays },
  { label: 'Surprises', icon: Sparkles },
]

export function ConnectionHome({ name, state, isOwner = false, loadError = false }: Props) {
  const firstName = name.trim().split(/\s+/)[0] || 'there'
  const invitationPending = ['invitation_sent', 'waiting_for_partner', 'invitation_accepted'].includes(state)

  return <div className="connection-home-shell">
    <header className="connection-home-topbar"><Link className="connection-wordmark" href="/">shuvia<span>®</span></Link><span className="connection-top-note">A PRIVATE SPACE FOR TWO</span><Link className="connection-settings-link" href="/settings">Settings</Link><LogoutButton/></header>
    <main className="connection-home">
      <header className="connection-home-intro"><p className="private-eyebrow"><span/> YOUR LITTLE WORLD</p><h1>Welcome, {firstName}.<br/><em>Your space starts here.</em></h1><p>Invite your person to make a private place for notes, games, memories, and days worth looking forward to.</p></header>

      {loadError ? <section className="connection-status connection-status-error" role="alert"><LockKeyhole size={19}/><div><h2>We couldn’t check your connection yet.</h2><p>Your account is safe. Try again in a moment or open your connection settings.</p></div><Link prefetch={false} href="/space" className="connection-text-link">Open connection settings <ArrowRight size={15}/></Link></section> : state === 'invitation_accepted' ? <section className="connection-status" role="status"><span className="connection-status-mark"><Heart size={18}/></span><div><p className="private-eyebrow">ONE YES IS IN</p><h2>{isOwner ? 'Your person said yes.' : 'Your yes is saved.'}</h2><p>{isOwner ? 'Confirm the connection to open your shared home.' : 'The person who invited you needs to confirm before your shared home opens.'}</p></div><Link prefetch={false} href="/space" className="connection-text-link">{isOwner ? 'Confirm connection' : 'Check connection'} <ArrowRight size={15}/></Link></section> : invitationPending ? <section className="connection-status" role="status"><span className="connection-status-mark"><LockKeyhole size={18}/></span><div><p className="private-eyebrow">INVITATION IN PROGRESS</p><h2>Your invitation is taking shape.</h2><p>Open your connection page to share the code or check its status.</p></div><Link prefetch={false} href="/space" className="connection-text-link">Open invitation <ArrowRight size={15}/></Link></section> : null}

      {!loadError && state !== 'invitation_accepted' && <section className="connection-actions" aria-label="Connect with your person">
        <Link prefetch={false} href="/space" className="connection-action connection-action-primary"><span className="connection-action-icon"><Heart size={20}/></span><span className="connection-action-copy"><small>START YOUR SHARED SPACE</small><strong>Create an invitation</strong><span>Make a private invite and share its link or code.</span></span><ArrowRight className="connection-action-arrow" size={18}/></Link>
        <Link prefetch={false} href="/join" className="connection-action"><span className="connection-action-icon"><LockKeyhole size={20}/></span><span className="connection-action-copy"><small>ALREADY HAVE A CODE?</small><strong>Enter invitation code</strong><span>Sign in, enter the code your person shared, and accept.</span></span><ArrowRight className="connection-action-arrow" size={18}/></Link>
      </section>}

      <section className="connection-preview"><div><p className="private-eyebrow">WHEN YOU’RE CONNECTED</p><h2>A little room for the things you share.</h2><p>Both people accept before the shared home opens. Your individual accounts stay separate.</p></div><div className="connection-feature-list">{sharedFeatures.map(({ label, icon: Icon }) => <span key={label}><Icon size={16}/>{label}</span>)}</div></section>
    </main>
    <footer className="connection-home-footer"><span>shuvia · two hearts, one little world</span><span><LockKeyhole size={13}/> Private to the two of you</span></footer>
  </div>
}
