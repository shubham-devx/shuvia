'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginSchema } from '@/lib/auth/schemas'
import { safeInternalPath } from '@/lib/auth/redirect'
import { createSupabaseBrowserClient, setRememberMePreference } from '@/lib/supabase/client'
import { AuthMessage } from './frame'

export function LoginForm() {
  const router = useRouter(); const params = useSearchParams()
  const requestedNextPath = safeInternalPath(params.get('next'), '/home')
  const isCodeInvite = requestedNextPath.startsWith('/join?') && new URLSearchParams(requestedNextPath.split('?')[1] ?? '').has('code')
  const nextPath = isCodeInvite ? (() => {
    const url = new URL(requestedNextPath, 'https://shuvia.invalid')
    url.searchParams.set('resume', '1')
    return `${url.pathname}${url.search}${url.hash}`
  })() : requestedNextPath
  const isInviteReturn = nextPath.startsWith('/invite/') || isCodeInvite
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true); const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('')
    const parsed = loginSchema.safeParse({ email, password, rememberMe })
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Check your details and try again.'); return }
    setBusy(true)
    try {
      const supabase = createSupabaseBrowserClient(parsed.data.rememberMe)
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
      if (error) throw error
      setRememberMePreference(parsed.data.rememberMe)
      router.replace(nextPath === '/space' ? '/home' : nextPath)
    } catch (error) {
      setMessage(error instanceof Error && /not confirmed|confirm/i.test(error.message) ? 'Please verify your email before logging in. You can request a fresh link below.' : 'That email and password did not match. Please try again.')
    } finally { setBusy(false) }
  }
  return <>{isInviteReturn ? <><h2>Continue to your invitation.</h2><p className="auth-card-intro">Log in or create an account. We’ll return you to the invitation so you can accept and open your shared space.</p><div className="invite-login-choice"><p>New to Shuvia?</p><Link className="button button-dark" href={signupHref}>Create an account to accept</Link><p>Already have an account? Log in below.</p></div></> : <><h2>Good to see you again.</h2><p className="auth-card-intro">Pick up right where the two of you left off.</p></>}{params.get('reset') === 'success' && <AuthMessage kind="success">Your password is updated. Log in with your new password.</AuthMessage>}{params.get('error') === 'email-unverified' && <AuthMessage kind="error">Your email still needs verification. Check your inbox before opening your private space.</AuthMessage>}{message && <AuthMessage kind="error">{message}</AuthMessage>}
    <form className="auth-form" onSubmit={submit} noValidate><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required/><label htmlFor="login-password">Password</label><div className="password-control"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
      <div className="field-row"><label className="remember-control"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}/> Remember me</label><Link href="/forgot-password">Forgot password?</Link></div><button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? 'Finding your space…' : 'Log in'} <span aria-hidden="true">→</span></button></form>
    <p className="auth-bottom">New to Shuvia? <Link href={params.get('next') ? signupHref : '/signup'}>Create an account</Link></p><p className="auth-bottom">Joining your person? <Link href="/join">Enter invitation code</Link></p><p className="auth-bottom"><Link href={params.get('next') ? `/verify-email?next=${encodeURIComponent(nextPath)}` : '/verify-email'}>Need a new verification email?</Link></p>
  </>
}
