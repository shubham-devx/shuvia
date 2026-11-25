import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/metadata'

const lastModified = new Date('2026-11-25T00:00:00.000Z')

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
