(async()=>{
if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
if(typeof DecompressionStream==='undefined') throw new Error('This browser needs updating before this Super 6 version can load.');
const files=['app-v031-payload-01.txt','app-v031-payload-02.txt','app-v031-payload-03.txt','app-v031-payload-04.txt','app-v031-payload-05.txt','app-v031-payload-06.txt','app-v031-payload-07.txt','app-v031-payload-08.txt','app-v031-payload-09.txt'];
const parts=await Promise.all(files.map(async f=>{const r=await fetch(f+'?v=0.31.0',{cache:'force-cache'});if(!r.ok) throw new Error('Could not load '+f);return r.text();}));
const b64=parts.join('');
const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
const source=await new Response(stream).text();
(0,eval)(source);
})().catch(err=>{console.error(err);const el=document.getElementById('app')||document.body;if(el){const d=document.createElement('div');d.style.cssText='margin:16px;padding:14px;border:1px solid #b44;background:#fff4f2;color:#6b1d1d;border-radius:10px;font:14px Arial';d.textContent='Super 6 failed to load: '+(err?.message||err);el.prepend(d);}});
