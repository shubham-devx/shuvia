import type { Metadata, Viewport } from 'next'
import { AppShell } from '@/components/app/app-shell'
import { defaultDescription, defaultTitle, siteName, siteUrl, socialImage } from '@/lib/seo/metadata'
import './globals.css'
import './polish.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: '%s | SHUVIA' },
  description: defaultDescription,
  applicationName: siteName,
  keywords: ['long-distance couples', 'couples connection', 'virtual date ideas', 'relationship games', 'love notes for couples', 'shared memories'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  openGraph: { type: 'website', siteName, title: defaultTitle, description: defaultDescription, url: siteUrl, images: [{ url: socialImage, width: 1200, height: 630, alt: 'Shuvia — Two hearts. One little world.' }] },
  twitter: { card: 'summary_large_image', title: defaultTitle, description: defaultDescription, images: [socialImage] },
  icons: { icon: [{ url: '/icons/shuvia-192.png', type: 'image/png', sizes: '192x192' }, { url: '/icons/shuvia-512.png', type: 'image/png', sizes: '512x512' }], apple: '/icons/shuvia-192.png' },
}

export const viewport: Viewport = { themeColor: '#6b2948', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body><AppShell>{children}</AppShell></body></html>
}
