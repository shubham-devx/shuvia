'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, WifiOff, Wifi } from 'lucide-react'

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
function subscribeOnline(callback:()=>void){window.addEventListener('online',callback);window.addEventListener('offline',callback);return()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback)}}
function getOnline(){return navigator.onLine}
export function AppShell({children}:{children:React.ReactNode}){
 const online=useSyncExternalStore(subscribeOnline,getOnline,()=>true)
 const [reconnected,setReconnected]=useState(false),[install,setInstall]=useState<InstallEvent|null>(null),[offlineDismissed,setOfflineDismissed]=useState(false)
 useEffect(()=>{if('serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>undefined);const onlineAgain=()=>{setOfflineDismissed(false);setReconnected(true);window.setTimeout(()=>setReconnected(false),3500)},offline=()=>{setOfflineDismissed(false);setReconnected(false)},prompt=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent)};window.addEventListener('offline',offline);window.addEventListener('online',onlineAgain);window.addEventListener('beforeinstallprompt',prompt);return()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',onlineAgain);window.removeEventListener('beforeinstallprompt',prompt)}},[])
 useEffect(()=>{const theme=localStorage.getItem('shuvia-theme');if(theme==='warm'||theme==='rose'||theme==='lavender')document.documentElement.dataset.theme=theme},[])
 async function installApp(){if(!install)return;await install.prompt();await install.userChoice;setInstall(null)}
 return <>{children}{((!online&&!offlineDismissed)||reconnected||install)&&<div className="network-toast" role="status" aria-live="polite">{!online?<><WifiOff size={15}/><span>You’re offline. Your private pages will reconnect when you’re back.</span></>:reconnected?<><Wifi size={15}/><span>You’re back online. Shuvia is finding your place again.</span></>:<><span>Keep your little world close.</span><button onClick={()=>void installApp()}><Download size={14}/> Install Shuvia</button></>}<button className="network-close" onClick={()=>{setReconnected(false);setOfflineDismissed(true);setInstall(null)}} aria-label="Dismiss">×</button></div>}</>
}
