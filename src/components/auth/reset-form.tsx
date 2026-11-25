'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resetPasswordSchema } from '@/lib/auth/schemas'
import { AuthMessage } from './frame'

export function ResetPasswordForm() {
  const router = useRouter(); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your new password.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(parsed.data) })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'This reset link is no longer valid. Request another one.')
      setDone(true); window.setTimeout(() => router.replace('/login?reset=success'), 1300)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please request a new reset link.') }
    finally { setBusy(false) }
  }
  return <><h2>Choose a new password.</h2><p className="auth-card-intro">Make it something only you know. At least 12 characters.</p>{error && <AuthMessage kind="error">{error}</AuthMessage>}{done && <AuthMessage kind="success">Your password has been changed. Taking you to log in…</AuthMessage>}
    {!done && <form className="auth-form" onSubmit={submit} noValidate><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required/><label htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required/><button className="button button-dark auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Save new password'} <span aria-hidden="true">→</span></button></form>}
    <p className="auth-bottom"><Link href="/forgot-password">Request another reset link</Link></p>
  </>
}
