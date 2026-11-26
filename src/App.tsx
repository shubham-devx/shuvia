'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, ArrowUpRight, ChevronDown, Compass, Heart, Menu, MessageCircle, X } from 'lucide-react'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'

const navItems = [['Home', '/'], ['Features', '/#features'], ['How it works', '/#how-it-works'], ['About', '/#story']] as const

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const close = () => setOpen(false)
  return <header className="site-header"><ShuviaLogo onClick={close} className="wordmark"/>
    <button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-controls="public-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav id="public-navigation" className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
      {navItems.map(([label, href]) => <a key={label} className="nav-link" href={href} aria-current={pathname === '/' && href === '/' ? 'page' : undefined} onClick={close}>{label}</a>)}
      <Link href="/login" className="public-account-link" onClick={close}>Log in</Link>
      <Link href="/join" className="public-join-link" onClick={close}>Join with code</Link>
      <Link href="/register" className={`nav-cta${pathname === '/signup' || pathname === '/register' ? ' active' : ''}`} onClick={close}>Create account <ArrowUpRight size={15} /></Link>
    </nav><span className="header-note">A place for your kind of love</span>
    {pathname !== '/' && <span className="sr-only">You are on the {pathname.slice(1)} page.</span>}
  </header>
}

export function Footer() {
  return <footer className="footer">
    <div className="footer-top">
      <div className="footer-brand-column">
        <ShuviaLogo href="/" className="wordmark footer-mark"/>
        <p>A private little world for two people to share moments, plans and everyday rituals.</p>
      </div>
      <nav className="footer-links" aria-label="Explore Shuvia">
        <p className="footer-heading">EXPLORE</p>
        <Link href="/">Home</Link><a href="/#features">Features</a><a href="/#how-it-works">How it works</a><a href="/#story">About</a><Link href="/contact">Contact</Link>
      </nav>
      <nav className="footer-links" aria-label="Account and policies">
        <p className="footer-heading">YOUR SPACE</p>
        <Link href="/register">Create account <ArrowUpRight size={14}/></Link><Link href="/login">Log in</Link><Link href="/join">Join with invitation code</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms and conditions</Link>
      </nav>
    </div>
    <div className="footer-bottom"><span>© 2026 Shuvia</span><span>A little world by Shubham Verma</span></div>
  </footer>
}

export function Landing() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  return <>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot"/> FOR THE LOVE THAT LIVES IN TWO PLACES</p><h1 id="hero-title">Love deserves<br/>its own <em>little world.</em></h1><p className="hero-body">Even when life keeps you apart, Shuvia gives you a place to play, talk, surprise and create memories together.</p><div className="hero-actions"><Link className="button button-dark" href="/signup">Create your space <ArrowRight size={17}/></Link><a className="text-link" href="/#story">Read our story <span>↓</span></a></div><div className="hero-foot"><span>A private place for the two of you, wherever you are.</span></div></div>
        <div className="hero-art" aria-label="Illustration of two separate rooms connected by a shared thread" role="img"><div className="hero-photo"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="distance-note"><span className="distance-line"/><span>2 places<br/><b>one us</b></span></div><div className="postcard"><span className="postcard-stamp">S</span><span>somewhere<br/>between here<br/><em>and you.</em></span><Heart size={18}/></div><span className="image-caption">SOMEWHERE, TOGETHER · 01</span></div>
      </section>
      <section className="manifesto" id="story"><div className="manifesto-index">A NOTE FROM US <span>— 01 / 04</span></div><div className="manifesto-content"><p className="manifesto-kicker">The miles are real.<br/>So is what you have.</p><h2>Being apart is part<br/>of your story. It doesn’t<br/>have to be <em>all of it.</em></h2><p className="manifesto-sub">Shuvia is a small, thoughtful space that makes room for your inside jokes, late-night talks and everything you’re building together.</p><Link href="/signup" className="underlined-link">A little more about us <ArrowUpRight size={15}/></Link></div><div className="manifesto-side"><div className="scribble">“</div><p>Two places, one shared routine.<br/>Make a little space that feels like yours.</p><span>THE SHUVIA PROMISE</span></div></section>
      <section className="public-feature-details" id="features" aria-labelledby="public-feature-title"><div className="public-feature-heading"><p className="eyebrow">MADE FOR THE THINGS YOU SHARE</p><h2 id="public-feature-title">A space that grows<br/><em>with your story.</em></h2><p>Keep the parts of your relationship you want to return to, all in one private space.</p></div><div className="public-feature-grid">
        <article><span>01 / TOGETHER</span><h3>Shared dashboard</h3><p>A calm home for your connection, recent moments, upcoming days and quick ways to spend time together.</p></article>
        <article><span>02 / PLAY</span><h3>Interactive games</h3><p>Choose from the existing question and prompt decks, then play together in your connected space.</p></article>
        <article><span>03 / WORDS</span><h3>Love notes</h3><p>Send a thoughtful message now or schedule it to open later, with private delivery in your shared space.</p></article>
        <article><span>04 / MEMORIES</span><h3>Memory shelf</h3><p>Save photos and captions in a private timeline you can revisit together.</p></article>
        <article><span>05 / MILESTONES</span><h3>Our days</h3><p>Keep birthdays, anniversaries and the dates that give you something to look forward to.</p></article>
        <article><span>06 / SURPRISES</span><h3>Little surprises</h3><p>Share the existing daily scratch cards, playful prompts and couple activities.</p></article>
      </div></section>
      <section className="public-how" id="how-it-works"><div><p className="eyebrow">THREE SMALL STEPS</p><h2>Start with the two<br/><em>of you.</em></h2><p>Each person keeps their own account. Shared features open only after both people agree to connect.</p></div><ol><li><span>01</span><div><h3>Create your account</h3><p>Sign up, verify your email and set up your private profile.</p></div></li><li><span>02</span><div><h3>Invite your partner</h3><p>Generate a private invitation link or share the one-time code.</p></div></li><li><span>03</span><div><h3>Start together</h3><p>After your partner accepts and you confirm, explore your shared space.</p></div></li></ol></section>
      <section className="preview"><div className="preview-photo" aria-label="An illustrated love letter on a writing desk" role="img"><div className="photo-caption">A moment worth keeping <span>✳</span></div></div><div className="preview-content"><p className="eyebrow">YOUR SPACE, YOUR RULES</p><h2>Somewhere to<br/>put <em>your us.</em></h2><p className="preview-text">A private corner for your shared rituals and the little things that make your relationship feel like yours. Thoughtful by design. Yours from the very first hello.</p><div className="feature-list"><div><span className="feature-icon lavender"><MessageCircle size={17}/></span><span><b>Letters from your person</b><small>Keep a kind word close for later.</small></span></div><div><span className="feature-icon rose"><Compass size={17}/></span><span><b>Things to look forward to</b><small>Make plans, even from miles away.</small></span></div></div><Link className="underlined-link" href="/signup">Take a peek inside <ArrowUpRight size={15}/></Link><div className="preview-sticker">MADE FOR<br/>TWO <Heart size={18}/></div></div></section>
      <section className="faq" id="faq"><div className="faq-title"><p className="eyebrow">THE THINGS YOU’RE WONDERING</p><h2>A few good<br/><em>questions.</em></h2><p>Something else on your mind? We’re just a note away.</p><a href="mailto:hello@shuvia.com" className="underlined-link">Say hello <ArrowUpRight size={15}/></a></div><div className="faq-list">{[
        ['What exactly is Shuvia?', 'Shuvia is a private digital space for two people to stay connected, share moments and build little rituals together — especially when they can’t be in the same place.'],
        ['Do we both need an account?', 'You start by creating your space, then invite your person to join you. It’s made for the two of you, together.'],
        ['Is Shuvia only for long-distance couples?', 'Long distance is close to our hearts, but Shuvia is for any couple who wants a place that feels like theirs.'],
        ['Is it free to get started?', 'Create an account and invite your person to begin sharing a private space.'],
      ].map(([question, answer], i) => <div className={`faq-item ${faqOpen === i ? 'expanded' : ''}`} key={question}><button className="faq-question" aria-expanded={faqOpen === i} onClick={() => setFaqOpen(faqOpen === i ? null : i)}><span className="faq-number">0{i + 1}</span><span>{question}</span><ChevronDown size={17}/></button>{faqOpen === i && <p className="faq-answer">{answer}</p>}</div>)}</div></section>
      <section className="final-cta"><span className="final-star">✳</span><p className="eyebrow">YOUR LITTLE WORLD IS WAITING</p><h2>Make a little room<br/>for <em>the two of you.</em></h2><div className="final-cta-actions"><Link className="button button-light" href="/register">Create account <ArrowRight size={16}/></Link><Link className="final-join-link" href="/join">Join with invitation code</Link></div><span className="final-note">No grand plan needed. Just the two of you.</span></section>
    </main>
  </>
}

