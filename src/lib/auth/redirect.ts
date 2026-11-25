export function safeInternalPath(value: string | null, fallback = '/onboarding') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const parsed = new URL(value, 'https://shuvia.invalid')
    if (parsed.origin !== 'https://shuvia.invalid' || parsed.pathname.startsWith('/auth/')) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch { return fallback }
}
