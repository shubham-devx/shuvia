const CACHE='shuvia-shell-v1'
const SHELL=['/offline','/icons/shuvia-192.svg','/icons/shuvia-512.svg']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||request.mode!=='navigate')return;event.respondWith(fetch(request).catch(async()=>{const cache=await caches.open(CACHE);return await cache.match('/offline')??Response.error()}))})
