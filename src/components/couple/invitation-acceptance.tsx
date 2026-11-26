'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, HeartHandshake, LockKeyhole } from 'lucide-react'

export type InvitationPreview = { status: string; spaceStatus?: string; inviterFirstName?: string | null; expiresAt?: string | null }

export function InvitationAcceptance({ token, preview }: { token: string; preview: InvitationPreview | null }) {
  const [consented, setConsented] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [accepted, setAccepted] = useState<'connected' | 'accepted' | null>(null)
  const router = useRouter()
  async function accept() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/couple', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'accept-token', token, consentPolicy: true }) })
      const result = await response.json() as { error?: string; status?: string }
      if (!response.ok) throw new Error(result.error ?? 'This invitation is no longer available.')
      setAccepted(result.status === 'connected' ? 'connected' : 'accepted'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not accept that invitation.') }
    finally { setBusy(false) }
  }
  async function switchAccount() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('We could not switch accounts. Please sign out and open the invitation again.')
      router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not switch accounts.') }
    finally { setBusy(false) }
  }
  const state = accepted ?? (preview?.status === 'accepted' && preview.spaceStatus === 'connected' ? 'connected' : preview?.status ?? 'unavailable')
  return <main className="invite-stage"><div className="invite-symbol"><HeartHandshake size={23}/></div><p className="eyebrow">A PRIVATE INVITATION</p>
    {state === 'pending' ? <><h1>{preview?.inviterFirstName || 'Your person'}<br/><em>made room for you.</em></h1><p className="invite-intro">A private Shuvia space is waiting for the two of you. Accepting records your yes; your person will confirm before the shared space opens.</p>{preview?.expiresAt && <p className="expiry-line">Invitation expires <time dateTime={preview.expiresAt}>{new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></p>}
      {error && <p className="auth-error" role="alert">{error}</p>}<div className="invite-policy"><LockKeyhole size={16}/><p>Your accounts stay separate. Either person can end the connection; any future shared-space content will be removed for both. Your individual account and profile remain yours.</p></div><label className="couple-consent invite-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)}/><span>I understand and want to accept this invitation.</span></label><button className="button button-dark couple-primary" disabled={busy || !consented} onClick={accept}>{busy ? 'Connecting your space…' : 'Accept and open our space'} <ArrowRight size={16}/></button></> : state === 'connected' ? <><h1>You’re connected.<br/><em>Make it yours.</em></h1><p className="invite-intro">Your private shared space is ready. You can both add memories, notes, and special dates now.</p><div className="accepted-seal"><Check size={17}/> YOUR SPACE IS OPEN</div><button className="button button-dark couple-primary" onClick={() => router.push('/home')}>Explore our shared space <ArrowRight size={16}/></button></> : state === 'accepted' ? <><h1>Your yes is<br/><em>on its way.</em></h1><p className="invite-intro">Your invitation is waiting for the other person to confirm.</p><div className="accepted-seal"><Check size={17}/> INVITATION ACCEPTED</div><button className="button button-dark couple-primary" onClick={() => router.push('/home')}>Continue to home <ArrowRight size={16}/></button></> : state === 'self' ? <><h1>This one is<br/><em>for your person.</em></h1><p className="invite-intro">This browser is signed in as the person who created the invitation. Your partner can sign in to their own account to accept it.</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button button-dark couple-primary" disabled={busy} onClick={switchAccount}>{busy ? 'Switching account…' : 'Switch account to accept'} <ArrowRight size={16}/></button><button className="quiet-action" onClick={() => router.push('/space')}>Back to your space</button></> : state === 'already_connected' ? <><h1>One little world<br/><em>at a time.</em></h1><p className="invite-intro">End your current couple connection before accepting another invitation.</p><button className="button button-dark couple-primary" onClick={() => router.push('/space')}>Review your space <ArrowRight size={16}/></button></> : <><h1>This invitation<br/><em>is no longer open.</em></h1><p className="invite-intro">It may have expired, been cancelled, or already been accepted. Ask your person to create a fresh invitation if you still want to connect.</p></>}
  </main>
}

export function JoinByCode({ initialCode = '', resume = false }: { initialCode?: string; resume?: boolean }) {
  const [code, setCode] = useState(initialCode.toUpperCase()); const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [consented, setConsented] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [accepted, setAccepted] = useState(false)
  const [notice, setNotice] = useState('')
  const router = useRouter(); const resumed = useRef(false)
  const submit = useCallback(async (action: 'preview-code' | 'accept-code' | 'withdraw') => {
    setBusy(true); setError('')
    try {
      const body = action === 'withdraw' ? { action } : { action, code, ...(action === 'accept-code' ? { consentPolicy: true } : {}) }
      const response = await fetch('/api/couple', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json() as { error?: string; invitation?: InvitationPreview; status?: string }
      if (response.status === 401) {
        const next = `/join?code=${encodeURIComponent(code.trim().toUpperCase())}&resume=1`
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      if (response.status === 403 && action === 'preview-code') {
        const next = `/join?code=${encodeURIComponent(code.trim().toUpperCase())}&resume=1`
        const target = result.error?.toLowerCase().includes('onboarding') ? '/onboarding' : '/verify-email'
        router.replace(`${target}?next=${encodeURIComponent(next)}`)
        return
      }
      if (!response.ok) throw new Error(result.error ?? 'We could not complete that just now.')
      if (action === 'preview-code') { setPreview(result.invitation ?? { status: 'unavailable' }); router.replace('/join') }
      if (action === 'accept-code') { setAccepted(true); setPreview({ status: result.status === 'connected' ? 'connected' : 'accepted', spaceStatus: result.status }) }
      if (action === 'withdraw') { setAccepted(false); setPreview({ status: 'unavailable' }); setNotice('Your acceptance was withdrawn.') }
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not complete that just now.') }
    finally { setBusy(false) }
  }, [code, router])
  useEffect(() => {
    if (resume && code && !resumed.current) {
      resumed.current = true
      void submit('preview-code')
    }
  }, [resume, code, submit])
  const state = accepted ? preview?.status ?? 'accepted' : preview?.status === 'accepted' && preview.spaceStatus === 'connected' ? 'connected' : preview?.status
  return <main className="invite-stage join-code-stage"><div className="invite-symbol"><LockKeyhole size={21}/></div><p className="eyebrow">JOIN YOUR PERSON</p><h1>Join your<br/><em>shared space.</em></h1><p className="invite-intro">Enter the invitation code your person shared with you. We’ll show who it’s from before you decide.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    {!state && <><form className="join-code-form" onSubmit={(event) => { event.preventDefault(); void submit('preview-code') }}><label htmlFor="couple-code">Invitation code</label><input id="couple-code" autoComplete="off" maxLength={16} value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setPreview(null) }} placeholder="ABCDE-FGHIJ" required/><button className="button button-dark couple-primary" disabled={busy}>{busy ? 'Looking for your invite…' : 'Continue'} <ArrowRight size={16}/></button></form><p className="invite-auth-links">Already have an account? <Link href={`/login?next=${encodeURIComponent(`/join${code ? `?code=${encodeURIComponent(code)}` : ''}`)}`}>Log in</Link><span> · </span><Link href={`/register?next=${encodeURIComponent(`/join${code ? `?code=${encodeURIComponent(code)}` : ''}`)}`}>Create one</Link></p></>}
    {state === 'pending' && <div className="invite-preview-card"><p className="eyebrow">A NOTE FROM YOUR PERSON</p><h2>{preview?.inviterFirstName || 'Someone special'} made a space for you.</h2><p>This private invitation expires {preview?.expiresAt ? new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'soon'}.</p><div className="invite-policy"><LockKeyhole size={16}/><p>Your accounts stay separate. Either person can disconnect; any future shared-space content will be removed for both. Your individual account and profile remain yours.</p></div><label className="couple-consent invite-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)}/><span>I understand and want to accept this invitation.</span></label><button className="button button-dark couple-primary" disabled={busy || !consented} onClick={() => void submit('accept-code')}>{busy ? 'Sending your yes…' : 'Accept this invitation'} <ArrowRight size={16}/></button><button className="quiet-action" disabled={busy} onClick={() => setPreview(null)}>Not now</button></div>}
    {state === 'connected' && <div className="accepted-seal"><Check size={17}/> YOUR SHARED SPACE IS OPEN</div>}{state === 'accepted' && <div className="accepted-seal"><Check size={17}/> INVITATION ACCEPTED</div>}
    {state && state !== 'pending' && state !== 'accepted' && <div className="invite-unavailable"><p>{state === 'self' ? 'You created this code. Share it with your person.' : state === 'already_connected' ? 'End your current connection before joining another space.' : 'This code is expired, cancelled, or unavailable. Ask your person for a fresh one.'}</p>{state === 'already_connected' && <button className="underlined-link" onClick={() => router.push('/space')}>Review your space <ArrowRight size={14}/></button>}<button className="quiet-action" onClick={() => setPreview(null)}>Try another code</button></div>}
    {(state === 'accepted' || state === 'connected') && <button className="button button-dark couple-primary" onClick={() => router.push('/home')}>{state === 'connected' ? 'Explore our shared space' : 'Continue to home'} <ArrowRight size={16}/></button>}
  </main>
}
