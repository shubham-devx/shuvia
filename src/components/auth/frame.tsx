import Link from 'next/link'
import type { ReactNode } from 'react'

export function AuthFrame({ eyebrow, title, description, note, children }: {
  eyebrow: string; title: ReactNode; description: string; note: string; children: ReactNode
}) {
  return <div className="auth-page"><header className="simple-header"><Link href="/" className="auth-logo" aria-label="Shuvia home">shuvia<span>®</span></Link></header>
    <main className="auth-main"><section className="auth-aside"><p className="eyebrow"><span className="eyebrow-dot"/>{eyebrow}</p><h1>{title}</h1><p>{description}</p><div className="aside-note">{note}</div></section><section className="auth-card">{children}</section></main></div>
}

export function AuthMessage({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return <p className={kind === 'error' ? 'auth-error' : 'auth-success'} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}
