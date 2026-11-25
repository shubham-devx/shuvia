import { Suspense } from 'react'
import Link from 'next/link'
import { VerifyPanel } from '@/components/auth/verify-panel'
import { pageMetadata } from '@/lib/seo/metadata'

export const metadata = pageMetadata({ title: 'Verify your email', description: 'Confirm your email address to continue to Shuvia.', path: '/verify-email', noIndex: true })

export default function VerifyEmailPage() {
  return <div className="auth-page"><header className="simple-header"><Link href="/" className="auth-logo">shuvia<span>®</span></Link></header><main className="verify-panel"><Suspense fallback={<p>Opening your inbox note…</p>}><VerifyPanel/></Suspense></main></div>
}
