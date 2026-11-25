import { Footer, Header, Landing } from '@/App'
import { StructuredData } from '@/components/seo/structured-data'
import { defaultDescription, defaultTitle, siteUrl } from '@/lib/seo/metadata'

export const metadata = {
  alternates: { canonical: '/' },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: 'SHUVIA', url: siteUrl, founder: { '@id': `${siteUrl}/#founder` } },
    { '@type': 'Person', '@id': `${siteUrl}/#founder`, name: 'Shubham Verma' },
    { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: 'SHUVIA', publisher: { '@id': `${siteUrl}/#organization` }, inLanguage: 'en' },
    { '@type': 'WebPage', '@id': `${siteUrl}/#webpage`, url: `${siteUrl}/`, name: defaultTitle, description: defaultDescription, isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${siteUrl}/#organization` } },
  ],
}

export default function HomePage() { return <><StructuredData data={structuredData}/><Header/><Landing/><Footer/></> }
