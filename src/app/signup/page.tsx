import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/frame'
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return <AuthFrame eyebrow="A LITTLE SPACE FOR TWO" title={<>Start with<br/><em>the two of you.</em></>} description="Build your own small corner of the internet, made for everything you share and everything still ahead." note="Two hearts. One little world."><Suspense fallback={<p className="auth-card-intro">Preparing your space…</p>}><SignupForm/></Suspense></AuthFrame>
}
