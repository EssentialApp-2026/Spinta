// Spinta – service worker: prima la rete (versione sempre aggiornata), poi la cache (funziona offline)
const CACHE='spinta-v2.14';
const CORE=['./spinta.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;const u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  const key=u.origin+u.pathname;
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(key,cp))}return res})
    .catch(()=>caches.match(key).then(m=>m||(r.mode==='navigate'?caches.match('./spinta.html'):undefined))));
});
// tocco su un avviso: riporta in primo piano l'app (o la apre)
self.addEventListener('notificationclick',e=>{e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus'in c)return c.focus()}
    return self.clients.openWindow?self.clients.openWindow('./spinta.html'):undefined}));
});
