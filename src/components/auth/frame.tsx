import type { ReactNode } from 'react'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'

export function AuthFrame({ eyebrow, title, description, note, children }: {
  eyebrow: string; title: ReactNode; description: string; note: string; children: ReactNode
}) {
  return <div className="auth-page"><header className="simple-header"><ShuviaLogo className="auth-logo"/></header>
    <main className="auth-main"><section className="auth-aside"><p className="eyebrow"><span className="eyebrow-dot"/>{eyebrow}</p><h1>{title}</h1><p>{description}</p><div className="aside-note">{note}</div></section><section className="auth-card">{children}</section></main></div>
}

export function AuthMessage({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return <p className={kind === 'error' ? 'auth-error' : 'auth-success'} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}
