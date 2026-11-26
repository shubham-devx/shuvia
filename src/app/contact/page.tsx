import Link from 'next/link'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'
import { ArrowUpRight, Mail } from 'lucide-react'
import { pageMetadata } from '@/lib/seo/metadata'
export const metadata = pageMetadata({title:'Contact Shuvia',description:'Contact the Shuvia team for account help, privacy requests, or questions about your shared space.',path:'/contact'})
export default function ContactPage(){return <main className="policy-page contact-page"><ShuviaLogo className="auth-logo"/><p className="eyebrow">A NOTE TO THE SHUVIA TEAM</p><h1>We’re here<br/><em>to listen.</em></h1><p className="policy-lede">For account help, privacy requests, or a thought about the little world you’re building together, write to us.</p><a className="contact-email" href="mailto:subhamv2003@gmail.com"><Mail size={18}/> subhamv2003@gmail.com <ArrowUpRight size={15}/></a><p className="contact-founder">Shuvia · founded by Shubham Verma</p><Link className="underlined-link" href="/">Back to Shuvia →</Link></main>}
