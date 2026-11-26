'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

type LocalizedTimeProps = {
  value: string
  options: Intl.DateTimeFormatOptions
  className?: string
}

function parseDate(value: string, timezone: 'UTC' | 'local') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00${timezone === 'UTC' ? 'Z' : ''}`)
  }
  return new Date(value)
}

export function LocalizedTime({ value, options, className }: LocalizedTimeProps) {
  const optionsKey = JSON.stringify(options)
  const formatterOptions = useMemo(() => JSON.parse(optionsKey) as Intl.DateTimeFormatOptions, [optionsKey])
  const stableDate = parseDate(value, 'UTC')
  const fallback = `${new Intl.DateTimeFormat('en-US', { ...formatterOptions, timeZone: 'UTC' }).format(stableDate)}${formatterOptions.timeStyle ? ' UTC' : ''}`
  const subscribe = useCallback(() => () => undefined, [])
  const getSnapshot = useCallback(
    () => new Intl.DateTimeFormat(undefined, formatterOptions).format(parseDate(value, 'local')),
    [formatterOptions, value],
  )
  const getServerSnapshot = useCallback(() => fallback, [fallback])
  const label = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return <time className={className} dateTime={value}>{label}</time>
}
