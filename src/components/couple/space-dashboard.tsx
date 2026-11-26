'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Copy, HeartHandshake, Link2, LockKeyhole, MessageCircle, Share2, UserRound } from 'lucide-react'
import { LocalizedTime } from '@/components/app/localized-time'

type CoupleSpace = {
  state: string
  is_owner: boolean
  created_at: string
  invitation_expires_at: string | null
  partner_name: string | null
  partner_avatar_url: string | null
}
type NewInvitation = { token: string; code: string; inviteUrl: string; expiresAt: string }
type Action = 'create' | 'regenerate' | 'confirm' | 'cancel' | 'withdraw' | 'disconnect'

export function SpaceDashboard({ initial, loadError = false }: { initial: CoupleSpace | null; loadError?: boolean }) {
  const [space, setSpace] = useState(initial)
  const [invite, setInvite] = useState<NewInvitation | null>(null)
  const [consented, setConsented] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState<'cancel' | 'disconnect' | null>(null)
  const router = useRouter()

  useEffect(() => {
    const shouldWatch = space?.state === 'invitation_sent' || space?.state === 'waiting_for_partner' || (space?.state === 'invitation_accepted' && !space.is_owner)
    if (!shouldWatch) return
    let live = true
    const check = async () => {
      try {
        const response = await fetch('/api/couple', { cache: 'no-store' })
        const result = await response.json() as { space?: { state?: string } }
        if (live && result.space?.state === 'connected') { router.replace('/home'); router.refresh() }
      } catch { /* Keep the consent status visible if the network is temporarily unavailable. */ }
    }
    void check()
    const timer = window.setInterval(() => void check(), 4000)
    return () => { live = false; window.clearInterval(timer) }
  }, [router, space?.is_owner, space?.state])

  async function act(action: Action) {
    setBusy(true); setError(''); setNotice('')
    try {
      const body: Record<string, unknown> = { action }
      if (action === 'create') body.consentPolicy = consented
      const response = await fetch('/api/couple', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json() as NewInvitation & { status?: string; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'We could not complete that just now.')
      window.dispatchEvent(new Event('shuvia:connection-updated'))
      if (action === 'create' || action === 'regenerate') {
        setInvite(result)
        if (initial) setSpace({ ...initial, state: 'invitation_sent', is_owner: true, invitation_expires_at: result.expiresAt, partner_name: null })
        else setSpace({ state: 'invitation_sent', is_owner: true, created_at: new Date().toISOString(), invitation_expires_at: result.expiresAt, partner_name: null, partner_avatar_url: null })
        setConsented(false)
        setNotice(action === 'create' ? 'Your private invitation is ready.' : 'A fresh invitation is ready. The old link and code no longer work.')
      } else {
        const messages: Record<Exclude<Action, 'create' | 'regenerate'>, string> = {
          confirm: 'You’re connected. Your little world is ready.',
          cancel: 'The invitation has been cancelled.',
          withdraw: 'Your acceptance was withdrawn.',
          disconnect: 'The shared space is closed for both of you.',
        }
        const nextState = action === 'confirm' ? 'connected' : action === 'disconnect' ? 'disconnected' : 'connection_cancelled'
        setSpace((current) => current ? { ...current, state: nextState, invitation_expires_at: null } : current)
        setNotice(messages[action])
        setInvite(null)
        if (action === 'confirm') { router.replace('/home'); router.refresh() }
        else router.refresh()
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not complete that just now.') }
    finally { setBusy(false); setConfirming(null) }
  }

  return <div className="couple-page"><div className="couple-kicker"><span className="couple-spark">✳</span><p className="eyebrow">A PRIVATE PLACE FOR TWO</p></div>
    <h1 className="couple-title">Your little<br/><em>world together.</em></h1>
    <p className="couple-lede">The connection starts with two clear yeses. Your Shuvia accounts always stay yours.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    {loadError ? <section className="couple-card"><h2>We couldn’t open your space just yet.</h2><p>Refresh in a moment. Your private connection details haven’t changed.</p></section> : !space || ['connection_cancelled','disconnected'].includes(space.state) ? <section className="couple-create-card"><div className="couple-lock"><LockKeyhole size={19}/></div><p className="eyebrow">JUST THE TWO OF YOU</p><h2>{space?.state === 'disconnected' ? 'A new chapter, if you want one.' : 'Make a space for your person.'}</h2><p>Create a private invitation. Only someone with the link or code can request to join, and you’ll both have to say yes.</p>
      <div className="privacy-promise"><span><LockKeyhole size={15}/></span><p><b>Your accounts remain separate.</b><br/>A couple space shares only a display name and the space itself. It never gives either person access to the other’s account or private preferences.</p></div>
      <label className="couple-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)}/><span>I understand either person can end the connection. Shared content will then be kept private and inaccessible to both of us; deleting an account removes its shared-space content.</span></label>
      <button className="button button-dark couple-primary" disabled={busy || !consented} onClick={() => act('create')}>{busy ? 'Making a little room…' : 'Create our private space'} <ArrowRight size={16}/></button><p className="join-code-link">Have an invitation code? <Link href="/join">Join your person</Link></p>
    </section> : space.state === 'invitation_sent' || space.state === 'waiting_for_partner' || space.state === 'invitation_expired' || space.state === 'invitation_declined' ? <section className="couple-card waiting-card"><div className="state-ribbon"><span className="state-dot"/> {space.state === 'invitation_expired' ? 'INVITATION EXPIRED' : space.state === 'invitation_declined' ? 'INVITATION DECLINED' : 'WAITING FOR YOUR PERSON'}</div><h2>{space.state === 'invitation_expired' ? 'The invitation window has closed.' : space.state === 'invitation_declined' ? 'Your person declined this invitation.' : 'A little world is ready when they are.'}</h2><p>{space.state === 'invitation_expired' || space.state === 'invitation_declined' ? 'The old link and code are no longer active. Make a fresh invitation whenever you’re ready.' : 'Your person can join by private link or code. When they accept, your shared space opens for both of you.'}</p>{space.invitation_expires_at && <p className="expiry-line">{space.state === 'invitation_expired' ? 'Expired' : 'Invitation expires'} <LocalizedTime value={space.invitation_expires_at} options={{ dateStyle: 'medium', timeStyle: 'short' }}/></p>}
      {invite ? <InvitationShare invitation={invite}/> : space.state !== 'invitation_expired' && <div className="secret-note"><LockKeyhole size={15}/><span>The link and code are shown only when created. If you didn’t save them, generate a fresh invitation to revoke the old one.</span></div>}
      <div className="couple-actions"><button className="button button-dark" disabled={busy} onClick={() => act('regenerate')}>{busy ? 'Making a fresh invite…' : invite || space.state === 'invitation_expired' || space.state === 'invitation_declined' ? 'Regenerate invitation' : 'Create a fresh invitation'} <ArrowRight size={15}/></button><button className="quiet-action" disabled={busy} onClick={() => setConfirming('cancel')}>Cancel invitation</button></div>
    </section> : space.state === 'invitation_accepted' ? <section className="couple-card accepted-card"><div className="state-ribbon"><span className="state-dot"/> ONE YES IS IN</div><div className="partner-avatar"><UserRound size={23}/></div><p className="partner-caption">YOUR PERSON</p><h2>{space.partner_name || 'Your person'} said yes.</h2>{space.is_owner ? <><p>They’ve accepted your invitation. Confirm that you’re ready to make this a shared space.</p><button className="button button-dark couple-primary" disabled={busy} onClick={() => act('confirm')}>{busy ? 'Connecting…' : 'Confirm our connection'} <HeartHandshake size={16}/></button><button className="quiet-action" disabled={busy} onClick={() => setConfirming('cancel')}>Cancel this connection</button></> : <><p>Your acceptance is saved. Your person will confirm the connection before the shared space opens.</p><button className="quiet-action" disabled={busy} onClick={() => act('withdraw')}>Withdraw my yes</button></>}</section> : <section className="couple-card connected-card"><div className="state-ribbon connected-ribbon"><span className="state-dot"/> CONNECTED</div><div className="partner-avatar"><UserRound size={23}/></div><p className="partner-caption">YOUR PERSON</p><h2>{space.partner_name || 'The two of you'}<br/><em>are in this together.</em></h2><p>Your accounts are still separate. This space only connects the two of you here.</p><div className="privacy-promise"><span><LockKeyhole size={15}/></span><p>Either person can close the shared space. Individual accounts and profile details stay private.</p></div><button className="quiet-action disconnect-action" disabled={busy} onClick={() => setConfirming('disconnect')}>Disconnect this space</button></section>}
    {confirming && <div className="couple-modal-backdrop"><section className="couple-modal" role="dialog" aria-modal="true" aria-labelledby="couple-confirm-title"><p className="eyebrow">A MOMENT TO BE SURE</p><h2 id="couple-confirm-title">{confirming === 'disconnect' ? 'Close your shared space?' : 'Cancel this invitation?'}</h2><p>{confirming === 'disconnect' ? 'This ends the connection for both people. Shared notes, memories, dates, games, and surprises will be retained privately and become unavailable to both former members. Your Shuvia accounts and profiles remain.' : 'This invitation stops working. Your person will need a new invitation to join.'}</p><div className="modal-buttons"><button className="quiet-action" disabled={busy} onClick={() => setConfirming(null)}>Keep it open</button><button className="button button-dark" disabled={busy} onClick={() => act(confirming)}>{busy ? 'Closing…' : confirming === 'disconnect' ? 'Disconnect for both' : 'Cancel invitation'}</button></div></section></div>}
  </div>
}

function InvitationShare({ invitation }: { invitation: NewInvitation }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const message = `I made a little private space for us on Shuvia. Join me with this link: ${invitation.inviteUrl} Or use this code: ${invitation.code}`
  async function copy(value: string, kind: 'link' | 'code') {
    try { await navigator.clipboard.writeText(value); setCopied(kind); window.setTimeout(() => setCopied(null), 1800) }
    catch { setCopied(null) }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Our little world on Shuvia', text: `Join me on Shuvia with code ${invitation.code}.`, url: invitation.inviteUrl }) }
      catch (error) { if (error instanceof Error && error.name !== 'AbortError') await copy(invitation.inviteUrl, 'link') }
    } else await copy(invitation.inviteUrl, 'link')
  }
  return <div className="invite-share"><div className="invite-code-head"><div><p className="eyebrow">YOUR PRIVATE INVITATION CODE</p><div className="invite-code">{invitation.code}</div></div><button className="icon-copy" aria-label="Copy invitation code" onClick={() => copy(invitation.code, 'code')}>{copied === 'code' ? <Check size={17}/> : <Copy size={17}/>}</button></div><div className="invite-share-buttons"><button className="button button-dark" onClick={share}><Share2 size={15}/> Share invite</button><a className="button button-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a><button className="button button-outline copy-link" onClick={() => copy(invitation.inviteUrl, 'link')}>{copied === 'link' ? <Check size={15}/> : <Link2 size={15}/>} {copied === 'link' ? 'Copied' : 'Copy link'}</button></div></div>
}
