/* Super 6 Christmas football skin · 1–27 December 2026, Europe/London.
   Visual-only. ?christmas=on previews; ?christmas=off disables. */
(()=>{'use strict';
const cls='super6-christmas',id='s6ChristmasBanner';
const meta=document.querySelector('meta[name="theme-color"]'),original=meta?.content||'#173f2a';
const mode=(new URLSearchParams(location.search).get('christmas')||'').toLowerCase();
function stamp(){try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>parts.find(p=>p.type===k)?.value||'';return Number(get('year')+get('month')+get('day'));}catch{return 0;}}
function render(){const date=stamp(),scheduled=date>=20261201&&date<=20261227;const active=mode==='off'?false:(mode==='on'||scheduled);
document.documentElement.classList.toggle(cls,active);if(meta)meta.content=active?'#103b30':original;
if(!document.body)return;let banner=document.getElementById(id);
if(!active){banner?.remove();return;}const app=document.getElementById('app');if(!app)return;
if(!banner){banner=document.createElement('aside');banner.id=id;banner.className='s6-christmas-banner';banner.setAttribute('aria-label','Super 6 festive football theme');banner.innerHTML='<span class="s6-xmas-side" aria-hidden="true">❄️ ⚽</span><div class="s6-xmas-title"><strong>SUPER 6 <em>FESTIVE FIXTURES</em></strong><small id="s6ChristmasSubtitle"></small></div><span class="s6-xmas-side" aria-hidden="true">🎄 ⚽</span>';app.insertBefore(banner,app.firstChild);}
const sub=document.getElementById('s6ChristmasSubtitle');if(sub)sub.textContent=mode==='on'&&!scheduled?'PREVIEW · 1–27 DECEMBER':'1–27 DECEMBER · CHRISTMAS FOOTBALL';
}
render();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
setInterval(render,60000);
})();