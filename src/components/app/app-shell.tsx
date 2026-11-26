'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Download, WifiOff, Wifi } from 'lucide-react'

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
function subscribeOnline(callback:()=>void){window.addEventListener('online',callback);window.addEventListener('offline',callback);return()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback)}}
function getOnline(){return navigator.onLine}
export function AppShell({children}:{children:React.ReactNode}){
 const pathname=usePathname()
 const online=useSyncExternalStore(subscribeOnline,getOnline,()=>true)
 const [reconnected,setReconnected]=useState(false),[install,setInstall]=useState<InstallEvent|null>(null),[offlineDismissed,setOfflineDismissed]=useState(false)
 useEffect(()=>{if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>undefined);const onlineAgain=()=>{setOfflineDismissed(false);setReconnected(true);window.setTimeout(()=>setReconnected(false),3500)},offline=()=>{setOfflineDismissed(false);setReconnected(false)},prompt=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent)};window.addEventListener('offline',offline);window.addEventListener('online',onlineAgain);window.addEventListener('beforeinstallprompt',prompt);return()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',onlineAgain);window.removeEventListener('beforeinstallprompt',prompt)}},[])
 useEffect(()=>{const theme=localStorage.getItem('shuvia-theme');if(theme==='warm'||theme==='rose'||theme==='lavender')document.documentElement.dataset.theme=theme},[])
 useEffect(()=>{
  const root=document.documentElement
  delete root.dataset.cardMotionReady
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if(reduceMotion||!('IntersectionObserver'in window))return
  const selector='.experience,.connection-action,.home-welcome,.home-question,.home-panel,.suggestion-strip,.game-deck-card,.active-card,.letter-card,.gallery-memory,.polaroid,.scratch-panel,.wheel-panel,.surprise-event-list article,.day-row,.theme-option,.couple-card,.couple-create-card,.invite-preview-card,.feature-compose,.feature-list-panel'
  let order=0
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;reveal(entry.target as HTMLElement)}},{threshold:.12,rootMargin:'0px 0px -24px 0px'})
  const reveal=(card:HTMLElement)=>{card.dataset.cardMotionRevealed='true';observer.unobserve(card)}
  const register=(node:Element)=>{
   if(!(node instanceof HTMLElement)||!node.matches(selector)||node.dataset.cardMotionObserved==='true')return
   node.dataset.cardMotionObserved='true'
   node.style.setProperty('--card-motion-delay',`${(order++%6)*45}ms`)
   observer.observe(node)
  }
  const scan=(node:ParentNode)=>{if(node instanceof Element)register(node);node.querySelectorAll(selector).forEach(register)}
  const onFocus=(event:FocusEvent)=>{const target=event.target;if(target instanceof Element){const card=target.closest<HTMLElement>(selector);if(card)reveal(card)}}
  root.dataset.cardMotionReady='true'
  scan(document.body)
  document.addEventListener('focusin',onFocus)
  const mutations=new MutationObserver(records=>{for(const record of records)record.addedNodes.forEach(node=>{if(node instanceof Element)scan(node)})})
  mutations.observe(document.body,{childList:true,subtree:true})
  return()=>{mutations.disconnect();observer.disconnect();document.removeEventListener('focusin',onFocus);delete root.dataset.cardMotionReady}
 },[pathname])
 async function installApp(){if(!install)return;await install.prompt();await install.userChoice;setInstall(null)}
 return <>{children}{((!online&&!offlineDismissed)||reconnected||install)&&<div className="network-toast" role="status" aria-live="polite">{!online?<><WifiOff size={15}/><span>You’re offline. Your private pages will reconnect when you’re back.</span></>:reconnected?<><Wifi size={15}/><span>You’re back online. Shuvia is finding your place again.</span></>:<><span>Keep your little world close.</span><button onClick={()=>void installApp()}><Download size={14}/> Install Shuvia</button></>}<button className="network-close" onClick={()=>{setReconnected(false);setOfflineDismissed(true);setInstall(null)}} aria-label="Dismiss">×</button></div>}</>
}
