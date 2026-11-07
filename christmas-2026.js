/* Super 6 Christmas 2026: visual-only theme, London 1–31 Dec. ?christmas=on/off for preview. */
(() => {
'use strict';
const params=new URLSearchParams(location.search);
const override=(params.get('christmas')||'').toLowerCase();
const meta=document.querySelector('meta[name="theme-color"]');
const original=meta?.content||'#173f2a';
let enabled=false, audioPlayed=false;
const savedMute=()=>{try{return localStorage.getItem('super6-christmas-muted')==='true'}catch(_){return false}};
let muted=savedMute();
function stamp(){try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>parts.find(p=>p.type===k)?.value||'';return Number(get('year')+get('month')+get('day'))}catch(_){return 0}}
function bells(){
if(!enabled||muted||audioPlayed||document.hidden)return;
const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
let ctx;try{ctx=new Ctx();if(ctx.state!=='running'){ctx.close();return}audioPlayed=true;
const notes=[659.25,659.25,659.25,659.25,659.25,659.25,659.25,783.99,523.25,587.33,659.25];
const beats=[0,.22,.44,.83,1.05,1.27,1.66,1.88,2.1,2.32,2.54];
notes.forEach((hz,i)=>{const t=ctx.currentTime+beats[i],o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.20);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.22)});
setTimeout(()=>ctx.close().catch(()=>{}),3500);
}catch(_){ctx?.close().catch(()=>{})}}
function render(){
const now=stamp(),scheduled=now>=20261201&&now<=20261231;
enabled=override==='off'?false:override==='on'||scheduled;
document.documentElement.classList.toggle('super6-christmas',enabled);
if(meta)meta.content=enabled?'#123e31':original;
if(!document.body)return;
let banner=document.getElementById('s6ChristmasBanner');
if(!enabled){banner?.remove();document.getElementById('s6ChristmasSnow')?.remove();return}
const app=document.getElementById('app');if(!app)return;
if(!banner){banner=document.createElement('aside');banner.id='s6ChristmasBanner';banner.className='s6-christmas-banner';banner.setAttribute('aria-label','Super 6 Christmas takeover');
const word=document.createElement('div');word.className='s6-christmas-wordmark';word.innerHTML='<span aria-hidden="true">🎄 ⚽</span><div><strong>SUPER 6 · FESTIVE FIXTURES</strong><small>HAVE YOURSELF A MERRY LITTLE MATCHDAY</small></div>';
const button=document.createElement('button');button.type='button';button.className='s6-christmas-sound';button.setAttribute('aria-label','Toggle Christmas bells');button.addEventListener('click',()=>{muted=!muted;try{localStorage.setItem('super6-christmas-muted',String(muted))}catch(_){};button.textContent=muted?'🔕 Bells off':'🔔 Bells on';if(!muted){audioPlayed=false;bells()}});
banner.append(word,button);app.insertBefore(banner,app.firstChild)}
banner.querySelector('button').textContent=muted?'🔕 Bells off':'🔔 Bells on';
if(!document.getElementById('s6ChristmasSnow')){const snow=document.createElement('div');snow.id='s6ChristmasSnow';snow.className='s6-christmas-snow';snow.setAttribute('aria-hidden','true');for(let i=0;i<20;i++){const flake=document.createElement('span');flake.textContent='❄';flake.style.left=((i*37)%100)+'%';flake.style.animationDelay=(-(i*1.7))+'s';flake.style.animationDuration=(13+i%7*2)+'s';snow.appendChild(flake)}document.body.appendChild(snow)}
}
render();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.setInterval(render,60000);
// Mobile browsers block sound until a user gesture. Never hijack the gesture or play repeatedly.
document.addEventListener('pointerdown',e=>{if(enabled&&!audioPlayed&&!muted&&e.target.closest('#loginForm, .player-nav, .admin-nav, .topbar, .s6-christmas-banner'))bells()},{passive:true});
})();