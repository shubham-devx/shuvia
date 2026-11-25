'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Compass, Heart, Menu, MessageCircle, Sparkles, X } from 'lucide-react'

const navItems = [['Our story', '/#story'], ['The little things', '/#experiences'], ['FAQs', '/#faq']] as const

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const close = () => setOpen(false)
  return <header className="site-header"><Link href="/" className="wordmark" onClick={close} aria-label="Shuvia home">shuvia<span>®</span></Link>
    <button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
      {navItems.map(([label, href]) => <a key={label} className="nav-link" href={href} onClick={close}>{label}</a>)}
      <Link href="/signup" className={`nav-cta${pathname === '/signup' ? ' active' : ''}`} onClick={close}>Create your space <ArrowUpRight size={15} /></Link>
    </nav><span className="header-note">A place for your kind of love</span>
    {pathname !== '/' && <span className="sr-only">You are on the {pathname.slice(1)} page.</span>}
  </header>
}

export function Footer() { return <footer className="footer"><div className="footer-top"><div><Link href="/" className="wordmark footer-mark">shuvia<span>®</span></Link><p>Two hearts. One little world.</p></div><div className="footer-links"><Link href="/signup">Create your space <ArrowUpRight size={14}/></Link><a href="/#story">Our story</a><a href="/#faq">FAQs</a></div><p className="footer-note">Made with care for the ones who<br/>make the distance feel smaller.</p></div><div className="footer-bottom"><span>© 2026 Shuvia</span><span>A little world by Shubham Verma</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div></footer> }

const experiences = [
  { number: '01', title: 'Make ordinary feel special', text: 'Leave little notes, send a song, or make a moment out of a Tuesday. The small things are the big things.', icon: <MessageCircle /> },
  { number: '02', title: 'Find your own kind of fun', text: 'Play a quick game, answer a question you’ve never asked, or start a new ritual that belongs only to you.', icon: <Sparkles /> },
  { number: '03', title: 'Keep your story close', text: 'Collect the photos, plans, and little memories you’ll want to come back to — all in one place.', icon: <Heart /> },
]

export function Landing() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  return <>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot"/> FOR THE LOVE THAT LIVES IN TWO PLACES</p><h1 id="hero-title">Love deserves<br/>its own <em>little world.</em></h1><p className="hero-body">Even when life keeps you apart, Shuvia gives you a place to play, talk, surprise and create memories together.</p><div className="hero-actions"><Link className="button button-dark" href="/signup">Create your space <ArrowRight size={17}/></Link><a className="text-link" href="/#story">Read our story <span>↓</span></a></div><div className="hero-foot"><span>A private place for the two of you, wherever you are.</span></div></div>
        <div className="hero-art" aria-label="Illustration of two separate rooms connected by a shared thread" role="img"><div className="hero-photo"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="distance-note"><span className="distance-line"/><span>2 places<br/><b>one us</b></span></div><div className="postcard"><span className="postcard-stamp">S</span><span>somewhere<br/>between here<br/><em>and you.</em></span><Heart size={18}/></div><span className="image-caption">SOMEWHERE, TOGETHER · 01</span></div>
      </section>
      <section className="manifesto" id="story"><div className="manifesto-index">A NOTE FROM US <span>— 01 / 04</span></div><div className="manifesto-content"><p className="manifesto-kicker">The miles are real.<br/>So is what you have.</p><h2>Being apart is part<br/>of your story. It doesn’t<br/>have to be <em>all of it.</em></h2><p className="manifesto-sub">Shuvia is a small, thoughtful space that makes room for your inside jokes, late-night talks and everything you’re building together.</p><Link href="/signup" className="underlined-link">A little more about us <ArrowUpRight size={15}/></Link></div><div className="manifesto-side"><div className="scribble">“</div><p>Two places, one shared routine.<br/>Make a little space that feels like yours.</p><span>THE SHUVIA PROMISE</span></div></section>
      <section className="experiences" id="experiences"><div className="section-heading"><div><p className="eyebrow">GOOD THINGS HAPPEN HERE</p><h2>Little ways to feel<br/><em>a little closer.</em></h2></div><p className="section-aside">No big gestures required.<br/>Just a world that feels like you.</p></div><div className="experience-grid">{experiences.map((item) => <article className="experience" key={item.number}><div className="experience-top"><span>{item.number}</span><span className="experience-icon">{item.icon}</span></div><h3>{item.title}</h3><p>{item.text}</p><span className="experience-rule"/></article>)}</div><div className="experience-end"><span>THE GOOD STUFF IS IN THE DETAILS</span><ArrowDown size={17}/></div></section>
      <section className="preview"><div className="preview-photo" aria-label="An illustrated love letter on a writing desk" role="img"><div className="photo-caption">A moment worth keeping <span>✳</span></div></div><div className="preview-content"><p className="eyebrow">YOUR SPACE, YOUR RULES</p><h2>Somewhere to<br/>put <em>your us.</em></h2><p className="preview-text">A private corner for your shared rituals and the little things that make your relationship feel like yours. Thoughtful by design. Yours from the very first hello.</p><div className="feature-list"><div><span className="feature-icon lavender"><MessageCircle size={17}/></span><span><b>Letters from your person</b><small>Keep a kind word close for later.</small></span></div><div><span className="feature-icon rose"><Compass size={17}/></span><span><b>Things to look forward to</b><small>Make plans, even from miles away.</small></span></div></div><Link className="underlined-link" href="/signup">Take a peek inside <ArrowUpRight size={15}/></Link><div className="preview-sticker">MADE FOR<br/>TWO <Heart size={18}/></div></div></section>
      <section className="ritual"><div className="ritual-head"><p className="eyebrow">A SMALLER KIND OF MAGIC</p><span>MADE OF MOMENTS</span></div><div className="ritual-body"><div className="ritual-quote">A good morning<br/>from <em>your person.</em><span>8:14 AM · JUST NOW</span></div><div className="ritual-copy"><h2>Love doesn’t need<br/>to shout to be <em>felt.</em></h2><p>A voice note on the way to work. A photo of the sky they’d love. A “thinking of you” with no occasion attached. Give the everyday somewhere to land.</p><Link href="/signup" className="button button-outline">Start your little ritual <ArrowRight size={16}/></Link></div></div></section>
      <section className="faq" id="faq"><div className="faq-title"><p className="eyebrow">THE THINGS YOU’RE WONDERING</p><h2>A few good<br/><em>questions.</em></h2><p>Something else on your mind? We’re just a note away.</p><a href="mailto:hello@shuvia.com" className="underlined-link">Say hello <ArrowUpRight size={15}/></a></div><div className="faq-list">{[
        ['What exactly is Shuvia?', 'Shuvia is a private digital space for two people to stay connected, share moments and build little rituals together — especially when they can’t be in the same place.'],
        ['Do we both need an account?', 'You start by creating your space, then invite your person to join you. It’s made for the two of you, together.'],
        ['Is Shuvia only for long-distance couples?', 'Long distance is close to our hearts, but Shuvia is for any couple who wants a place that feels like theirs.'],
        ['Is it free to get started?', 'Create an account and invite your person to begin sharing a private space.'],
      ].map(([question, answer], i) => <div className={`faq-item ${faqOpen === i ? 'expanded' : ''}`} key={question}><button className="faq-question" aria-expanded={faqOpen === i} onClick={() => setFaqOpen(faqOpen === i ? null : i)}><span className="faq-number">0{i + 1}</span><span>{question}</span><ChevronDown size={17}/></button>{faqOpen === i && <p className="faq-answer">{answer}</p>}</div>)}</div></section>
      <section className="final-cta"><span className="final-star">✳</span><p className="eyebrow">YOUR LITTLE WORLD IS WAITING</p><h2>Make a little room<br/>for <em>the two of you.</em></h2><Link className="button button-light" href="/signup">Create your space <ArrowRight size={16}/></Link><span className="final-note">No grand plan needed. Just the two of you.</span></section>
    </main>
  </>
}

