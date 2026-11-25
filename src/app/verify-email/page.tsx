import { Suspense } from 'react'
import Link from 'next/link'
import { VerifyPanel } from '@/components/auth/verify-panel'

export default function VerifyEmailPage() {
  return <div className="auth-page"><header className="simple-header"><Link href="/" className="auth-logo">shuvia<span>®</span></Link></header><main className="verify-panel"><Suspense fallback={<p>Opening your inbox note…</p>}><VerifyPanel/></Suspense></main></div>
}
