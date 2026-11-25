'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function logout() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (!response.ok) throw new Error('Please try logging out again.')
      router.replace('/login'); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try logging out again.') }
    finally { setBusy(false) }
  }
  return <>{error && <p className="auth-error" role="alert">{error}</p>}<button className="logout-button" disabled={busy} onClick={logout}>{busy ? 'Leaving…' : 'Log out securely'}</button></>
}
