import { Suspense } from 'react'
import { AuthFrame } from '@/components/auth/frame'
import { LoginForm } from '@/components/auth/login-form'
import { pageMetadata } from '@/lib/seo/metadata'

export const metadata = pageMetadata({ title: 'Log in', description: 'Sign in to return to your private Shuvia space.', path: '/login', noIndex: true })

export default function LoginPage() {
  return <AuthFrame eyebrow="YOUR WORLD IS RIGHT HERE" title={<>Come back<br/><em>to your us.</em></>} description="Your notes, rituals and memories are waiting where you left them." note="A place for your kind of love."><Suspense fallback={<p className="auth-card-intro">Opening your space…</p>}><LoginForm/></Suspense></AuthFrame>
}
