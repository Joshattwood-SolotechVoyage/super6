/* Super 6 v0.34.0 — read-only Admin Fixture Centre. */
(async function(){
'use strict';
if(window.__SUPER6_BACKEND_READY)await window.__SUPER6_BACKEND_READY;
const B=window.Super6Backend;
if(!B||typeof B.client!=='function')return;
const sb=B.client();
const cups=[{id:'chumpions',label:'Chumpions',count:10},{id:'nohope',label:'No-Hope-A',count:10},{id:'fall',label:'F-All Cup',count:15},{id:'shart',label:'SHART',count:0}];
const stages=['R1','R32','R16','QF','SF','F'];
const labels={R1:'Round 1',R32:'Round of 32',R16:'Round of 16',QF:'Quarter-finals',SF:'Semi-finals',F:'Final'};
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const id=x=>String(x??'');
const pair=x=>[id(x.player1_id),id(x.player2_id)].sort().join('|');
const clean=x=>String(x??'').replace(/[\r\n\t]+/g,' ').trim();
const date=x=>{if(!x)return '';const d=new Date(x);return isNaN(d)?'':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(d)};
const state={rows:[],loaded:false,loading:false,cup:'all',round:'all',group:'all',status:'all',search:'',shown:60};
let generation=0;
const cupLabel=c=>cups.find(x=>x.id===c)?.label||c;
const statusName=x=>x==='completed'?'Completed':x==='review'?'Needs review':'Upcoming';
function ensureUI(){
 const nav=$('#adminTabs'),admin=$('#adminArea');
 if(!nav||!admin)return;
 if(!$('[data-admin-tab="fixturecentre"]',nav)){
  const button=document.createElement('button');
  button.type='button';button.dataset.adminTab='fixturecentre';
  button.innerHTML='<b>Fixture Centre</b><small>Full draw & export</small>';
  const before=$('[data-admin-tab="players"]',nav);
  if(before)nav.insertBefore(button,before);else nav.appendChild(button);
 }
 if(!$('[data-admin-panel="fixturecentre"]',admin)){
  const panel=document.createElement('div');panel.className='admin-tab-panel hidden fixture-centre';panel.dataset.adminPanel='fixturecentre';
  panel.innerHTML='<section class="card fc-hero"><div class="section-head"><div><div class="kicker">Admin tools</div><h3>Fixture Centre</h3><div class="muted">Every competition, every round, all in one place.</div></div><span class="chip good">Read-only</span></div>'+
  '<div class="fc-actions"><button type="button" class="fc-primary" id="fcExport" disabled>↓ Export Excel (.xlsx)</button><button type="button" class="fc-secondary" id="fcCopy" disabled>Copy filtered fixtures</button><button type="button" class="fc-secondary" id="fcRefresh">↻ Refresh</button></div>'+
  '<div id="fcNotice" class="fc-notice" role="status" aria-live="polite"></div>'+
  '<div id="fcMetrics" class="fc-metrics"><div class="fc-metric"><b>—</b><span>Fixtures</span></div></div>'+
  '<div class="fc-filters">'+
  '<div class="fc-filter"><label for="fcCup">Competition</label><select id="fcCup"><option value="all">All competitions</option><option value="chumpions">Chumpions League</option><option value="nohope">No-Hope-A</option><option value="fall">F-All Cup</option><option value="shart">SHART</option></select></div>'+
  '<div class="fc-filter"><label for="fcRound">Round</label><select id="fcRound"><option value="all">All rounds</option></select></div>'+
  '<div class="fc-filter"><label for="fcGroup">Group</label><select id="fcGroup"><option value="all">All groups</option><option value="A">Group A</option><option value="B">Group B</option><option value="C">Group C</option><option value="D">Group D</option></select></div>'+
  '<div class="fc-filter"><label for="fcStatus">Status</label><select id="fcStatus"><option value="all">All fixtures</option><option value="completed">Completed</option><option value="upcoming">Upcoming</option><option value="review">Needs review</option></select></div>'+
  '<div class="fc-filter"><label for="fcSearch">Find player</label><input id="fcSearch" placeholder="Search player name…" autocomplete="off" type="search"/></div></div>'+
  '<div class="fc-results-head"><b id="fcCount">Fixtures</b><small id="fcShowing"></small></div>'+
  '<div id="fcList"><div class="fc-empty">Open Fixture Centre to load every fixture.</div></div>'+
  '<div class="fc-footer"><button type="button" class="fc-secondary" id="fcMore" hidden>Show 60 more</button></div>'+
  '<p class="fc-hint">Excel export always includes all four competition sheets, regardless of filters. Copy includes all fixtures matching your selected filters. Future scores are blank, never 0–0.</p></section>';
  const before=$('[data-admin-panel="players"]',admin);if(before)before.insertAdjacentElement('beforebegin',panel);else admin.appendChild(panel);
  $('#fcCup').addEventListener('change',e=>{state.cup=e.target.value;state.round='all';state.group='all';state.shown=60;updateOptions();render()});
  $('#fcRound').addEventListener('change',e=>{state.round=e.target.value;state.shown=60;render()});
  $('#fcGroup').addEventListener('change',e=>{state.group=e.target.value;state.shown=60;render()});
  $('#fcStatus').addEventListener('change',e=>{state.status=e.target.value;state.shown=60;render()});
  $('#fcSearch').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();state.shown=60;render()});
  $('#fcMore').addEventListener('click',()=>{state.shown+=60;render()});
  $('#fcRefresh').addEventListener('click',()=>load(true));
  $('#fcCopy').addEventListener('click',copy);
  $('#fcExport').addEventListener('click',exportExcel);
 }
 if(!nav.dataset.fixtureCentreBound){
  nav.dataset.fixtureCentreBound='1';
  nav.addEventListener('click',e=>{
   const button=e.target.closest('button[data-admin-tab="fixturecentre"]');if(!button)return;
   e.preventDefault();e.stopImmediatePropagation();
   $$('button[data-admin-tab]',nav).forEach(b=>b.classList.toggle('active',b===button));
   $$('[data-admin-panel]',admin).forEach(x=>x.classList.add('hidden'));
   $('[data-admin-panel="fixturecentre"]',admin)?.classList.remove('hidden');
   load(false);
  },true);
 }
}
function active(){return !$('#adminArea')?.classList.contains('hidden')&&!$('[data-admin-panel="fixturecentre"]')?.classList.contains('hidden')}
function notice(txt,error=false){const el=$('#fcNotice');if(el){el.textContent=txt;el.style.color=error?'#a53d34':'#24583a'}}
function updateOptions(){
 const select=$('#fcRound'),cup=cups.find(x=>x.id===state.cup);
 if(!select)return;
 let values='<option value="all">All rounds</option>';
 if(cup){
  for(let i=1;i<=cup.count;i++)values+='<option value="round-'+i+'">Round '+i+'</option>';
  if(cup.id==='shart'){for(const s of stages)values+='<option value="stage-'+s+'">'+esc(labels[s])+'</option>'}
  else if(cup.id!=='fall')for(const s of stages.slice(2)){if(state.rows.some(x=>x.cup===cup.id&&x.stage===s))values+='<option value="stage-'+s+'">'+esc(labels[s])+'</option>'}
 }
 select.innerHTML=values;
 if(![...select.options].some(x=>x.value===state.round))state.round='all';
 select.value=state.round;select.disabled=!cup;
 const group=$('#fcGroup');if(group){group.disabled=!['all','chumpions','nohope'].includes(state.cup);if(group.disabled)state.group='all';group.value=state.group}
}
async function fetchRows(){
 const {data:{user},error:authError}=await sb.auth.getUser();
 if(authError)throw authError;
 if(!user)throw Error('Sign in as an administrator.');
 const [who,season]=await Promise.all([
  sb.from('profiles').select('role').eq('id',user.id).maybeSingle(),
  sb.from('seasons').select('id').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle()
 ]);
 if(who.error)throw who.error;if(who.data?.role!=='admin')throw Error('Admin access required.');
 if(season.error)throw season.error;
 if(!season.data?.id)throw Error('There is no active season.');
 const sid=season.data.id;
 const req=[
  sb.from('profiles').select('id,username').order('username'),
  sb.from('rounds').select('id,name,cutoff_at').eq('season_id',sid).order('cutoff_at'),
  sb.from('chumpions_group_schedule').select('matchday,group_code,slot_no,player1_id,player2_id').eq('season_id',sid).order('matchday').order('group_code').order('slot_no'),
  sb.from('chumpions_matches').select('round_id,group_code,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid),
  sb.from('chumpions_knockout_matches').select('round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid),
  sb.from('nohope_group_schedule').select('matchday,group_code,slot_no,player1_id,player2_id').eq('season_id',sid).order('matchday').order('group_code').order('slot_no'),
  sb.from('nohope_matches').select('round_id,matchday,group_code,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid),
  sb.from('nohope_knockout_matches').select('round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid),
  sb.from('fall_matches').select('round_id,matchday,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid).order('matchday').order('slot_no'),
  sb.from('shart_matches').select('round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',sid)
 ];
 const res=await Promise.all(req);
 for(const r of res)if(r.error)throw r.error;
 const [profiles,rounds,chSchedule,chMatches,chKnock,noSchedule,noMatches,noKnock,fallMatches,shartMatches]=res.map(r=>r.data||[]);
 const names=new Map(profiles.map(x=>[id(x.id),clean(x.username)]));
 const roundMap=new Map(rounds.map(x=>[id(x.id),x]));
 const chRounds=[...new Set(chMatches.map(x=>id(x.round_id)).filter(Boolean))];
 chRounds.sort((a,b)=>String(roundMap.get(a)?.cutoff_at||'').localeCompare(String(roundMap.get(b)?.cutoff_at||'')));
 function make(cup,round,group,slot,fixture,stage,match){
  const r=roundMap.get(id(match?.round_id));
  const complete=match?.status==='completed'&&match.player1_score!=null&&match.player2_score!=null;
  const status=complete?'completed':match?.status==='review'||match?.status==='shootout'?'review':'upcoming';
  return {cup,cupLabel:cupLabel(cup),round:round??null,group:group||'',slot:slot||0,
   stage:stage||'',stageLabel:labels[stage]||'',p1:names.get(id(fixture.player1_id))||'To be confirmed',
   p2:names.get(id(fixture.player2_id))||'To be confirmed',s1:complete?Number(match.player1_score):null,
   s2:complete?Number(match.player2_score):null,status,statusLabel:statusName(status),
   superRound:r?.name||'',date:r?date(r.cutoff_at):''};
 }
 const rows=[];
 for(const s of chSchedule){
  const day=Number(s.matchday),rid=chRounds[day-1];
  const match=rid?chMatches.find(x=>id(x.round_id)===rid&&x.group_code===s.group_code&&pair(x)===pair(s)):null;
  rows.push(make('chumpions',day,s.group_code,s.slot_no,s,'',match));
 }
 for(const m of chKnock)rows.push(make('chumpions',null,'',m.slot_no,m,m.stage,m));
 for(const s of noSchedule){
  const match=noMatches.find(x=>Number(x.matchday)===Number(s.matchday)&&x.group_code===s.group_code&&Number(x.slot_no)===Number(s.slot_no));
  rows.push(make('nohope',Number(s.matchday),s.group_code,s.slot_no,s,'',match));
 }
 for(const m of noKnock)rows.push(make('nohope',null,'',m.slot_no,m,m.stage,m));
 for(const m of fallMatches)rows.push(make('fall',Number(m.matchday),'',m.slot_no,m,'',m));
 for(const m of shartMatches)rows.push(make('shart',null,'',m.slot_no,m,m.stage,m));
 const order=new Map(cups.map((c,i)=>[c.id,i]));
 rows.sort((a,b)=>order.get(a.cup)-order.get(b.cup)||(a.round??100+stages.indexOf(a.stage))-(b.round??100+stages.indexOf(b.stage))||
  a.group.localeCompare(b.group)||a.slot-b.slot||a.p1.localeCompare(b.p1));
 return rows;
}
async function load(force=false){
 if(!active())return;
 if(state.loading&&!force)return;
 if(state.loaded&&!force){render();return}
 const run=++generation;state.loading=true;
 notice('Loading all competition fixtures from Supabase…');
 ['#fcExport','#fcCopy','#fcRefresh'].forEach(s=>{if($(s))$(s).disabled=true});
 try{
  const rows=await fetchRows();if(run!==generation)return;
  state.rows=rows;state.loaded=true;updateOptions();render();
  notice('Loaded '+rows.length+' fixtures across four competitions.');
 }catch(e){
  if(run!==generation)return;
  if(!state.loaded)$('#fcList').innerHTML='<div class="fc-empty">'+esc(e.message||e)+'</div>';
  notice('Could not load fixtures: '+(e.message||e),true);
 }finally{
  if(run===generation){
   state.loading=false;
   ['#fcExport','#fcCopy'].forEach(s=>{if($(s))$(s).disabled=!state.loaded});
   if($('#fcRefresh'))$('#fcRefresh').disabled=false;
  }
 }
}
function matchKey(row){return row.round!==null?'round-'+row.round:'stage-'+row.stage}
function displayTitle(row){
 return row.cupLabel+' · '+(row.round!==null?'Round '+row.round:row.stageLabel)+(row.group?' · Group '+row.group:'');
}
function filter(){
 return state.rows.filter(x=>
  (state.cup==='all'||x.cup===state.cup)&&
  (state.round==='all'||matchKey(x)===state.round)&&
  (state.group==='all'||x.group===state.group)&&
  (state.status==='all'||x.status===state.status)&&
  (!state.search||(x.p1+' '+x.p2).toLowerCase().includes(state.search))
 );
}
function render(){
 if(!state.loaded)return;
 const all=state.rows,done=all.filter(x=>x.status==='completed').length,review=all.filter(x=>x.status==='review').length;
 $('#fcMetrics').innerHTML=[[all.length,'Total fixtures'],[done,'Completed results'],[all.length-done-review,'Upcoming fixtures'],[review,'Need review']].
  map(([n,t])=>'<div class="fc-metric"><b>'+n+'</b><span>'+esc(t)+'</span></div>').join('');
 const filtered=filter(),visible=filtered.slice(0,state.shown);
 $('#fcCount').textContent=filtered.length+' matching fixture'+(filtered.length===1?'':'s');
 $('#fcShowing').textContent='Showing '+visible.length+' of '+filtered.length;
 const blocks=new Map();
 for(const x of visible){
  const key=x.cup+'|'+matchKey(x)+'|'+x.group;
  if(!blocks.has(key))blocks.set(key,{row:x,rows:[]});
  blocks.get(key).rows.push(x);
 }
 const list=$('#fcList');
 if(!visible.length){
  list.innerHTML='<div class="fc-empty">No fixtures match these filters.'+(state.cup==='shart'?'<div>The random SHART draw has not been made yet.</div>':'')+'</div>';
 }else list.innerHTML=[...blocks.values()].map(block=>{
  const complete=block.rows.filter(x=>x.status==='completed').length;
  return '<div class="fc-round-block"><div class="fc-round-title"><strong>'+esc(displayTitle(block.row))+'</strong><small>'+complete+'/'+block.rows.length+' completed</small></div>'+
   '<table class="fc-table"><thead><tr><th>Fixture</th><th>Player 1</th><th>Score</th><th>Player 2</th><th>Status</th></tr></thead><tbody>'+
   block.rows.map(x=>'<tr><td>#'+esc(x.slot)+'</td><td><b>'+esc(x.p1)+'</b></td><td class="fc-score">'+(x.status==='completed'?esc(x.s1)+'–'+esc(x.s2):'<span class="fc-vs">vs</span>')+
   '</td><td><b>'+esc(x.p2)+'</b></td><td><span class="fc-status '+esc(x.status)+'">'+esc(x.statusLabel)+'</span></td></tr>').join('')+
   '</tbody></table></div>';
 }).join('');
 $('#fcMore').hidden=filtered.length<=state.shown;
}
async function copy(){
 const rows=filter();
 if(!rows.length){notice('No fixtures selected to copy.',true);return}
 if(!window.Super6FixtureExcel){notice('Export utilities have not loaded yet.',true);return}
 const xlsx=window.Super6FixtureExcel;
 const text=[xlsx.headers,...rows.map(xlsx.dataRow)].map(row=>row.map(clean).join('\t')).join('\n');
 try{
  if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
  else{
   const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:0;top:0;opacity:0';
   document.body.appendChild(area);area.focus();area.select();
   const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('Clipboard unavailable');
  }
  notice(rows.length+' fixtures copied. Paste straight into Numbers.');
 }catch(e){notice('Unable to copy. Please use Export Excel instead.',true)}
}
function exportExcel(){
 if(!state.loaded||!window.Super6FixtureExcel)return;
 try{
  const blob=window.Super6FixtureExcel.build(state.rows),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='Super6_Competition_Fixtures_'+new Date().toISOString().slice(0,10)+'.xlsx';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  notice('Downloaded four competition sheets with '+state.rows.length+' fixture records.');
 }catch(e){notice('Excel export failed: '+(e.message||e),true)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUI,{once:true});
else ensureUI();
})();