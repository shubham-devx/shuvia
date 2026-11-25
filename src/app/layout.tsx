import type { Metadata, Viewport } from 'next'
import { AppShell } from '@/components/app/app-shell'
import './globals.css'
import './polish.css'

export const metadata:Metadata={
 title:{default:'Shuvia — Two hearts. One little world.',template:'%s · Shuvia'},
 description:'A private little world for the people who make distance feel smaller.',
 applicationName:'Shuvia',
 openGraph:{type:'website',siteName:'Shuvia',title:'Shuvia — Two hearts. One little world.',description:'A private little world for the people who make distance feel smaller.',images:[{url:'/icons/shuvia-512.svg',width:512,height:512,alt:'Shuvia'}]},
 twitter:{card:'summary',title:'Shuvia — Two hearts. One little world.',description:'A private little world for the people who make distance feel smaller.',images:['/icons/shuvia-512.svg']},
 icons:{icon:[{url:'/icons/shuvia-192.svg',type:'image/svg+xml',sizes:'192x192'},{url:'/icons/shuvia-512.svg',type:'image/svg+xml',sizes:'512x512'}],apple:'/icons/shuvia-192.svg'},
}
export const viewport:Viewport={themeColor:'#6b2948',width:'device-width',initialScale:1}

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body><AppShell>{children}</AppShell></body></html>
}
