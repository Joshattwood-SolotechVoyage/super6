/* Super 6 v0.34.1 — SHART player-side all-fixtures view, matching F-All. */
(async function(){
'use strict';
if(window.__SUPER6_BACKEND_READY)await window.__SUPER6_BACKEND_READY;
const B=window.Super6Backend;
if(!B||typeof B.client!=='function')return;
const sb=B.client();
const stages=[['R1','Round 1'],['R32','Round of 32'],['R16','Round of 16'],['QF','Quarter-finals'],['SF','Semi-finals'],['F','Final']];
const $=(s,p=document)=>p.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sid=x=>String(x||'');
let loading=null,cached=null,me='';
function ensure(){
 const screen=$('#playerShart'),body=$('#playerShartBody');
 if(!screen||!body)return null;
 let holder=$('#shartPlayerFullFixtures');
 if(holder)return holder;
 holder=document.createElement('div');
 holder.id='shartPlayerFullFixtures';
 holder.className='shart-fixture-browser';
 holder.innerHTML='<details class="cup-all-fixtures" id="shartSeasonFixtures">'+
   '<summary><span><b>View all fixtures</b><small>Round 1 through to the Final</small></span><span class="cup-full-count">SHART draw <span aria-hidden="true">⌄</span></span></summary>'+
   '<div class="cup-full-body"><p class="cup-full-intro">All drawn SHART matches in one place, just like the F-All round list.</p><div id="shartFullFixturesResults" class="shart-fixture-empty">Open this section to load the fixture list.</div></div>'+
   '</details>';
 body.insertAdjacentElement('beforebegin',holder);
 $('#shartSeasonFixtures',holder).addEventListener('toggle',e=>{
   if(e.target.open)refresh(true);
 });
 return holder;
}
function visible(){
 return !$('#playerArea')?.classList.contains('hidden')&&!$('#playerShart')?.classList.contains('hidden');
}
async function fetchState(force){
 if(cached&&!force)return cached;
 if(loading)return loading;
 loading=(async()=>{
   const [auth,season]=await Promise.all([
    sb.auth.getUser(),
    sb.from('seasons').select('id').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle()
   ]);
   if(auth.error)throw auth.error;
   if(season.error)throw season.error;
   me=sid(auth.data?.user?.id);
   if(!me)throw Error('Please sign in to see SHART fixtures.');
   if(!season.data?.id)return {matches:[],names:new Map()};
   const [mr,pr]=await Promise.all([
    sb.from('shart_matches').select('stage,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',season.data.id).order('slot_no'),
    sb.from('profiles').select('id,username').order('username')
   ]);
   if(mr.error)throw mr.error;
   if(pr.error)throw pr.error;
   cached={matches:mr.data||[],names:new Map((pr.data||[]).map(p=>[sid(p.id),p.username]))};
   return cached;
 })();
 try{return await loading}finally{loading=null;}
}
function matchHTML(m,names){
 const done=m.status==='completed'&&m.player1_score!=null&&m.player2_score!=null;
 const a=names.get(sid(m.player1_id))||'To be confirmed',b=names.get(sid(m.player2_id))||'To be confirmed';
 const mine=me&&(sid(m.player1_id)===me||sid(m.player2_id)===me);
 return '<div class="shart-fixture-row'+(mine?' mine':'')+'"><b>'+esc(a)+'</b><strong class="'+(done?'':'pending')+'">'+
   (done?esc(m.player1_score)+'–'+esc(m.player2_score):m.status==='shootout'?'Shootout':'vs')+
   '</strong><b>'+esc(b)+'</b></div>';
}
function paint(s){
 const target=$('#shartFullFixturesResults');if(!target)return;
 const matches=s.matches||[],openStage=stages.find(([key])=>matches.some(m=>m.stage===key&&m.status!=='completed'))?.[0]||
   stages.find(([key])=>matches.some(m=>m.stage===key))?.[0]||'R1';
 const roundHTML=stages.map(([code,label])=>{
  const group=matches.filter(m=>m.stage===code).sort((a,b)=>Number(a.slot_no)-Number(b.slot_no));
  const complete=group.filter(x=>x.status==='completed').length;
  const status=!group.length?'Not drawn':complete===group.length?'Complete':complete?'In progress':'Upcoming';
  return '<details class="fall-round"'+(openStage===code?' open':'')+'><summary><span>'+esc(label)+'</span><small>'+esc(status)+' · '+complete+'/'+group.length+'</small></summary>'+
    '<div class="shart-fixture-group">'+(group.length?group.map(m=>matchHTML(m,s.names)).join(''):
    '<div class="shart-fixture-empty">No fixture has been drawn for this stage yet.</div>')+'</div></details>';
 }).join('');
 target.className='';
 target.innerHTML=matches.length?'<div class="fall-rounds cup-full-rounds">'+roundHTML+'</div>':
   '<div class="shart-fixture-empty"><b>SHART has not started yet.</b> The random draw will appear here once it is made.</div>';
}
async function refresh(force){
 if(!visible())return;
 const container=ensure(),details=$('#shartSeasonFixtures',container);
 if(!details?.open)return;
 const target=$('#shartFullFixturesResults');
 if(target)target.innerHTML='<div class="shart-fixture-empty">Loading SHART fixtures…</div>';
 try{const s=await fetchState(force);if(details.open)paint(s);}
 catch(e){if(target)target.innerHTML='<div class="shart-fixture-empty">Unable to load SHART fixtures: '+esc(e.message||e)+'</div>'}
}
function init(){
 ensure();
 const nav=$('.player-nav');
 if(nav&&!nav.dataset.shartFixtureBound){
  nav.dataset.shartFixtureBound='1';
  nav.addEventListener('click',e=>{
   if(e.target.closest('[data-player-tab="shart"]')){
    queueMicrotask(()=>{ensure();refresh(false)});
   }
  },true);
 }
 window.addEventListener('focus',()=>{if(visible())refresh(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();