'use client'
import { useEffect } from 'react'
export default function AppError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error('Shuvia page error',error.digest)},[error.digest]);return <main className="offline-page"><p className="private-eyebrow"><span/> A LITTLE PAUSE</p><h1>Something needs<br/><em>a second try.</em></h1><p>We couldn’t open this page just now. Your saved moments are still safe.</p><button className="button button-dark" onClick={reset}>Try this page again <span>→</span></button></main>}
