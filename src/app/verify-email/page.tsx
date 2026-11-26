import { Suspense } from 'react'
import { VerifyPanel } from '@/components/auth/verify-panel'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'
import { pageMetadata } from '@/lib/seo/metadata'

export const metadata = pageMetadata({ title: 'Verify your email', description: 'Confirm your email address to continue to Shuvia.', path: '/verify-email', noIndex: true })

export default function VerifyEmailPage() {
  return <div className="auth-page"><header className="simple-header"><ShuviaLogo className="auth-logo"/></header><main className="verify-panel"><Suspense fallback={<p>Opening your inbox note…</p>}><VerifyPanel/></Suspense></main></div>
}
