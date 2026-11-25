'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signupSchema } from '@/lib/auth/schemas'
import { safeInternalPath } from '@/lib/auth/redirect'
import { createSupabaseBrowserClient, setRememberMePreference } from '@/lib/supabase/client'
import { AuthMessage } from './frame'

export function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const score = useMemo(() => [password.length >= 12, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length, [password])
  const strength = ['Add a password', 'A little more to go', 'Getting stronger', 'Strong password', 'Lovely and strong'][password ? score : 0]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null)
    const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword, acceptTerms })
    if (!parsed.success) { setMessage({ kind: 'error', text: parsed.error.issues[0]?.message ?? 'Check the details and try again.' }); return }
    setBusy(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const nextRoute = safeInternalPath(params.get('next'))
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('next', nextRoute)
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          data: { full_name: parsed.data.fullName, legal_accepted: true, legal_version: '2026-11-25' },
        },
      })
      if (error) throw error
      setRememberMePreference(true)
      if (data.session) { router.replace(nextRoute); router.refresh(); return }
      router.replace(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&sent=1`)
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error && error.name !== 'ZodError' ? error.message : 'Account setup is not connected yet. Please try again later.' })
    } finally { setBusy(false) }
  }

  return <><h2>Your little world starts here.</h2><p className="auth-card-intro">A few details, then we’ll save you a place.</p>
    {message && <AuthMessage kind={message.kind}>{message.text}</AuthMessage>}
    <form className="auth-form" onSubmit={submit} noValidate>
      <label htmlFor="signup-name">Full name</label><input id="signup-name" autoComplete="name" maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required/>
      <label htmlFor="signup-email">Email address</label><input id="signup-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required/>
      <label htmlFor="signup-password">Password</label><div className="password-control"><input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 12 characters" required/><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
      <div className="password-strength" aria-hidden="true">{[1,2,3,4].map((step) => <i key={step} className={step <= score ? 'on' : ''}/>)}</div><p className="strength-label" aria-live="polite">{strength}</p>
      <label htmlFor="signup-confirm">Confirm password</label><div className="password-control"><input id="signup-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type it once more" required/></div>
      <label className="terms-control"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}/><span>I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span></label>
      <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? 'Making your space…' : 'Create my account'} <span aria-hidden="true">→</span></button>
    </form><p className="auth-bottom">Already have a little world? <Link href="/login">Log in</Link></p>
  </>
}
