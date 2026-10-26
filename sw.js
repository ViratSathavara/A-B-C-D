// Offline support: the page shell is cached on install, pictures and voice files are cached the first time they are used.
const V='abcd-v3', SHELL=['./','index.html','book.html','learn.html','app.css','app.js','content.js','data.bundle.js','data.sections.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Safari asks audio for byte ranges, so answer those from the cached copy
async function ranged(req,res){
  const m=/bytes=(\d+)-(\d*)/.exec(req.headers.get('range')||'');if(!m||!res.ok)return res;
  const buf=await res.clone().arrayBuffer(),s=+m[1],e=m[2]?+m[2]:buf.byteLength-1;
  return new Response(buf.slice(s,e+1),{status:206,headers:{'Content-Type':res.headers.get('Content-Type')||'audio/mpeg','Content-Range':`bytes ${s}-${e}/${buf.byteLength}`,'Content-Length':e-s+1}});
}
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url),same=u.origin===location.origin;
  const isDoc=r.mode==='navigate'||/\.(html|js|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
  e.respondWith((async()=>{
    const c=await caches.open(V);
    const hit=await c.match(r.url);
    if(isDoc&&same){ // fresh first, cached when offline
      try{const n=await fetch(r);if(n.ok)c.put(r.url,n.clone());return n}catch(_){return hit||(await c.match('index.html'))}
    }
    if(hit)return r.headers.get('range')?ranged(r,hit):hit;
    try{const n=await fetch(u.pathname.endsWith('.mp3')?r.url:r);
      if(n.ok&&(same||u.hostname.endsWith('gstatic.com')||u.hostname.endsWith('googleapis.com')))c.put(r.url,n.clone());
      return r.headers.get('range')&&n.ok?ranged(r,n):n}
    catch(_){return hit||Response.error()}
  })());
});
