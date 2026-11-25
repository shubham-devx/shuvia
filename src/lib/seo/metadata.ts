import type { Metadata } from 'next'

export const siteUrl = 'https://shuvia.com'
export const siteName = 'SHUVIA'
export const defaultDescription = 'A beautiful private space for couples to play, talk, share romantic moments and create memories together—even when life keeps them apart.'
export const defaultTitle = 'SHUVIA – A Beautiful Space for Love, Connection & Togetherness'
export const socialImage = '/images/shuvia-og.png'

type PageMetadata = {
  title: string
  description: string
  path: string
  noIndex?: boolean
}

export function pageMetadata({ title, description, path, noIndex = false }: PageMetadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: noIndex ? { index: false, follow: false, noarchive: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} | SHUVIA`,
      description,
      url: path,
      images: [{ url: socialImage, width: 1200, height: 630, alt: 'Shuvia — Two hearts. One little world.' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | SHUVIA`,
      description,
      images: [socialImage],
    },
  }
}
