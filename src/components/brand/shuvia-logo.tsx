import Link from 'next/link'
import type { MouseEventHandler } from 'react'

type ShuviaLogoProps = {
  href?: string
  className?: string
  compact?: boolean
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export function ShuviaLogo({ href = '/', className = '', compact = false, onClick }: ShuviaLogoProps) {
  return <Link href={href} onClick={onClick} className={`shuvia-logo ${compact ? 'shuvia-logo-compact' : ''} ${className}`.trim()} aria-label="Shuvia home">
    <svg className="shuvia-logo-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M20 33s-13-7.3-13-17.1c0-4.2 3-7.2 7-7.2 3 0 5.3 1.8 6 5 .7-3.2 3-5 6-5 4 0 7 3 7 7.2C33 25.7 20 33 20 33Z" fill="currentColor"/>
      <path d="M13.5 13.2c-.8 1.3-.5 3 .2 4.2M26.5 13.2c.8 1.3.5 3-.2 4.2" fill="none" stroke="var(--logo-highlight, #d0ad88)" strokeLinecap="round" strokeWidth="1.5"/>
      <circle cx="20" cy="3.8" r="1.6" fill="var(--logo-highlight, #d0ad88)"/>
    </svg>
    {!compact && <span className="shuvia-logo-word">shuvia<sup>®</sup></span>}
    {compact && <span className="sr-only">shuvia</span>}
  </Link>
}
