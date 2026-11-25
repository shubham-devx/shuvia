import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Mail } from 'lucide-react'
export const metadata:Metadata={title:'Contact',description:'Get in touch with the Shuvia team.'}
export default function ContactPage(){return <main className="policy-page contact-page"><Link href="/" className="auth-logo">shuvia<span>®</span></Link><p className="eyebrow">A NOTE TO THE SHUVIA TEAM</p><h1>We’re here<br/><em>to listen.</em></h1><p className="policy-lede">For account help, privacy requests, or a thought about the little world you’re building together, write to us.</p><a className="contact-email" href="mailto:subhamv2003@gmail.com"><Mail size={18}/> subhamv2003@gmail.com <ArrowUpRight size={15}/></a><p className="contact-founder">Shuvia · founded by Shubham Verma</p><Link className="underlined-link" href="/">Back to Shuvia →</Link></main>}
