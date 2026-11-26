import { Suspense } from 'react'
import { Header, Footer } from '@/App'
import { JoinByCode } from '@/components/couple/invitation-acceptance'
import { pageMetadata } from '@/lib/seo/metadata'

export const metadata = pageMetadata({ title: 'Join with an invitation code', description: 'Enter the private invitation code your partner shared with you.', path: '/join' })

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string; resume?: string }> }) {
  const query = await searchParams
  return <><Header/><Suspense fallback={<main className="invite-stage"><p className="eyebrow">JOIN YOUR PERSON</p><h1>Opening your<br/><em>invitation.</em></h1></main>}><JoinByCode initialCode={query.code ?? ''} resume={query.resume === '1'}/></Suspense><Footer/></>
}
