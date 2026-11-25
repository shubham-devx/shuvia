import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/frame'
import { ForgotPasswordForm } from '@/components/auth/forgot-form'

export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="A SMALL RESET" title={<>Find your way<br/><em>back in.</em></>} description="We’ll send a one-time, time-limited link to the email on your account." note="We’ll only send the note you asked for."><Suspense fallback={<p className="auth-card-intro">Opening your reset form…</p>}><ForgotPasswordForm/></Suspense></AuthFrame>
}
