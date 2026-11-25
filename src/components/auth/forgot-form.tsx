'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { forgotPasswordSchema } from '@/lib/auth/schemas'
import { AuthMessage } from './frame'

export function ForgotPasswordForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false); const [error, setError] = useState('')
  const linkError = params.get('error') === 'invalid-link' ? 'That reset link is invalid or has expired. Request a fresh one below.' : params.get('error') === 'expired-link' ? 'Your reset session has expired. Request a new link to continue.' : ''
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Enter a valid email.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(parsed.data) })
      if (!response.ok) throw new Error('We could not send your note just now. Please try again shortly.')
      setSent(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  return <><h2>A fresh start, if you need one.</h2><p className="auth-card-intro">Share the email on your Shuvia account and we’ll send a private reset link.</p>{linkError && <AuthMessage kind="error">{linkError}</AuthMessage>}{error && <AuthMessage kind="error">{error}</AuthMessage>}{sent && <AuthMessage kind="success">If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.</AuthMessage>}
    {!sent && <form className="auth-form" onSubmit={submit} noValidate><label htmlFor="forgot-email">Email address</label><input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required/><button className="button button-dark auth-submit" disabled={busy}>{busy ? 'Sending a little note…' : 'Send reset link'} <span aria-hidden="true">→</span></button></form>}
    <p className="auth-bottom"><Link href="/login">Back to log in</Link></p></>
}
