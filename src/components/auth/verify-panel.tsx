'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { safeInternalPath } from '@/lib/auth/redirect'
import { AuthMessage } from './frame'

export function VerifyPanel() {
  const params = useSearchParams(); const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(params.get('sent') === '1'); const [error, setError] = useState('')
  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const nextRoute = safeInternalPath(params.get('next'))
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('next', nextRoute)
      const { error: authError } = await createSupabaseBrowserClient().auth.resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl.toString() } })
      if (authError) throw authError
      setSent(true)
    } catch { setError('We could not resend that link right now. Check the email address or try again in a little while.') }
    finally { setBusy(false) }
  }
  const nextParam = params.get('next')
  const loginHref = nextParam ? `/login?next=${encodeURIComponent(safeInternalPath(nextParam))}` : '/login'
  return <><div className="verify-mark"><MailCheck size={22}/></div><p className="eyebrow">A NOTE IS ON ITS WAY</p><h1>Check your<br/><em>inbox.</em></h1><p>Open the Shuvia verification link in your email to confirm it’s really you. We’ll bring you straight to your onboarding when you do.</p>{params.get('error') === 'invalid-link' && <AuthMessage kind="error">That verification link is invalid or has expired. You can request a fresh one below.</AuthMessage>}{sent && <AuthMessage kind="success">If that address has an account awaiting verification, we’ve sent a fresh link.</AuthMessage>}{error && <AuthMessage kind="error">{error}</AuthMessage>}
    <form className="auth-form" onSubmit={resend}><label htmlFor="verify-email">Email address</label><input id="verify-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required/><button type="submit" className="button button-dark auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Resend verification email'} <span aria-hidden="true">→</span></button></form><Link className="auth-inline-link" href={loginHref}>Back to log in</Link></>
}
