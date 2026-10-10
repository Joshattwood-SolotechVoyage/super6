// Super 6 v0.33.1 — F-All Cup UI + mid-season 15-player format
(async()=>{
  // backend.js initialises asynchronously; wait for it before looking for Super6Backend.
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') throw new Error('Super 6 backend is not ready.');
  const sb=B.client();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null,loading=null,currentUserId=null;

  function q(sel,root=document){return root.querySelector(sel)}
  function qa(sel,root=document){return [...root.querySelectorAll(sel)]}
  function isHidden(el){return !el||el.classList.contains('hidden')}
  function playerName(id){return state?.playerMap?.get(String(id))?.username||'Player'}

  async function loadState(force=false){
    if(loading&&!force)return loading;
    loading=(async()=>{
      const {data:{user}}=await sb.auth.getUser(); currentUserId=user?.id||null;
      const {data:season,error:se}=await sb.from('seasons').select('id,name,status,created_at').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(se)throw se;
      if(!season){state={season:null,players:[],leagues:[],members:[],matches:[],competition:null,rounds:[]};return state}
      const [pr,lr,mr,xr,cr,rr]=await Promise.all([
        sb.from('profiles').select('id,username,role,league_id').eq('role','player').order('username'),
        sb.from('leagues').select('id,name,sort_order').eq('season_id',season.id).order('sort_order'),
        sb.from('fall_members').select('season_id,player_id,seed_no,created_at').eq('season_id',season.id).order('seed_no'),
        sb.from('fall_matches').select('id,season_id,matchday,slot_no,round_id,round_name,player1_id,player2_id,player1_score,player2_score,player1_table_points,player2_table_points,status,assigned_at,calculated_at').eq('season_id',season.id).order('matchday').order('slot_no'),
        sb.from('fall_competition_state').select('season_id,roster_locked_at,roster_locked_by,champion_id,completed_at,updated_at').eq('season_id',season.id).maybeSingle(),
        sb.from('rounds').select('id,name,status,cutoff_at,fall_week,completed_at').eq('season_id',season.id).order('cutoff_at',{ascending:false})
      ]);
      for(const r of [pr,lr,mr,xr,cr,rr])if(r.error)throw r.error;
      const players=pr.data||[],leagues=lr.data||[];
      state={season,players,leagues,members:mr.data||[],matches:xr.data||[],competition:cr.data||null,rounds:rr.data||[]};
      state.playerMap=new Map(players.map(p=>[String(p.id),p]));
      return state;
    })();
    try{return await loading}finally{loading=null}
  }

  function tableRows(){
    if(!state)return[];
    const rows=(state.members||[]).map(m=>({id:String(m.player_id),name:playerName(m.player_id),p:0,w:0,d:0,l:0,s6:0,pts:0}));
    const map=new Map(rows.map(r=>[r.id,r]));
    for(const m of state.matches||[]){
      if(m.status!=='completed')continue;
      const a=map.get(String(m.player1_id)),b=map.get(String(m.player2_id)); if(!a||!b)continue;
      const s1=Number(m.player1_score||0),s2=Number(m.player2_score||0);
      a.p++;b.p++;a.s6+=s1;b.s6+=s2;
      if(s1>s2){a.w++;b.l++;a.pts+=3}
      else if(s2>s1){b.w++;a.l++;b.pts+=3}
      else{a.d++;b.d++;a.pts++;b.pts++}
    }
    const h2h=(a,b)=>{
      const m=(state.matches||[]).find(x=>x.status==='completed'&&((String(x.player1_id)===a.id&&String(x.player2_id)===b.id)||(String(x.player1_id)===b.id&&String(x.player2_id)===a.id)));
      if(!m)return 0;
      const aScore=String(m.player1_id)===a.id?Number(m.player1_score||0):Number(m.player2_score||0);
      const bScore=String(m.player1_id)===b.id?Number(m.player1_score||0):Number(m.player2_score||0);
      return bScore-aScore;
    };
    rows.sort((a,b)=>b.pts-a.pts||b.s6-a.s6||h2h(a,b)||a.name.localeCompare(b.name));
    return rows;
  }

  function tableHTML(me=''){
    const rows=tableRows();
    if(!rows.length)return '<div class="notice">The 15-player F-All roster has not been locked yet.</div>';
    return `<div class="fall-table-wrap"><table class="fall-table"><thead><tr><th>Pos</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>S6</th><th>Pts</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${me===r.id?'me':''}"><td>${i+1}</td><td title="${esc(r.name)}"><b>${esc(r.name)}</b></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.s6}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`;
  }

  function fixtureHTML(m,me=''){
    const mine=me&&(String(m.player1_id)===me||String(m.player2_id)===me);
    const done=m.status==='completed';
    const score=done?`${Number(m.player1_score||0)} – ${Number(m.player2_score||0)}`:'vs';
    const note=done?(m.player1_score>m.player2_score?'3–0 table pts':m.player2_score>m.player1_score?'0–3 table pts':'1–1 table pts'):(m.round_name||'Waiting for an F-All week');
    return `<div class="fall-fixture ${mine?'mine':''} ${done?'done':''}"><div><b>${esc(playerName(m.player1_id))}</b><small>${done?Number(m.player1_score||0)+' S6 pts':''}</small></div><strong>${score}</strong><div class="right"><b>${esc(playerName(m.player2_id))}</b><small>${done?Number(m.player2_score||0)+' S6 pts':''}</small></div><span>${esc(note)}</span></div>`;
  }

  function roundsHTML(me=''){
    if(!(state?.matches||[]).length)return'';
    const groups=[];
    for(let d=1;d<=15;d++)groups.push({d,matches:state.matches.filter(m=>Number(m.matchday)===d)});
    const current=groups.find(g=>g.matches.some(m=>m.status==='scheduled'))?.d||groups.find(g=>g.matches.some(m=>m.status==='waiting'))?.d||15;
    return `<div class="fall-rounds">${groups.map(g=>{const completed=g.matches.filter(m=>m.status==='completed').length;const label=completed===8?'Complete':g.matches.some(m=>m.round_id)?(g.matches[0]?.round_name||'Assigned'):'Waiting';return `<details class="fall-round" ${g.d===current?'open':''}><summary><span>Round ${g.d}</span><small>${esc(label)} · ${completed}/8</small></summary><div class="fall-fixtures">${g.matches.map(m=>fixtureHTML(m,me)).join('')}</div></details>`}).join('')}</div>`;
  }

  function ensurePlayerUI(){
    const nav=q('.player-nav'); if(!nav)return;
    let btn=q('[data-player-tab="fall"]',nav);
    if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.playerTab='fall';btn.textContent='F-All';const hist=q('[data-player-tab="history"]',nav);hist?nav.insertBefore(btn,hist):nav.appendChild(btn)}
    if(!q('#playerFall')){
      const main=q('#playerArea'); if(!main)return;
      const el=document.createElement('div');el.className='screen hidden';el.id='playerFall';el.innerHTML='<section class="card fall-hero"><div class="section-head"><div><div class="kicker">15-round head-to-head league</div><h3>⚽ F-All Cup</h3><div class="muted">15 players · everyone plays everyone once · 7 H2Hs + one rotating bye each round · 3 points win · 1 draw · 0 loss.</div></div><span class="chip" id="playerFallStatus">Waiting</span></div><div id="playerFallBody"><div class="muted">Loading F-All…</div></div></section>';main.appendChild(el);
    }
    if(!nav.dataset.fallBound){
      nav.dataset.fallBound='1';
      nav.addEventListener('click',e=>{
        const b=e.target.closest('button[data-player-tab]');if(!b)return;
        const fall=q('#playerFall');
        if(b.dataset.playerTab==='fall'){
          e.preventDefault();e.stopImmediatePropagation();
          qa('button[data-player-tab]',nav).forEach(x=>x.classList.toggle('active',x===b));
          qa('#playerArea > .screen').forEach(x=>x.classList.add('hidden'));fall?.classList.remove('hidden');
          renderPlayer(true);
        }else fall?.classList.add('hidden');
      },true);
    }
  }

  async function renderPlayer(force=false){
    ensurePlayerUI();const body=q('#playerFallBody'),chip=q('#playerFallStatus');if(!body)return;
    body.innerHTML='<div class="muted">Loading F-All…</div>';
    try{await loadState(force);const me=String(currentUserId||'');const member=state.members.some(m=>String(m.player_id)===me);const completedDays=new Set(state.matches.filter(m=>m.status==='completed').map(m=>m.matchday)).size;
      chip.textContent=state.competition?.champion_id?'Complete':state.competition?.roster_locked_at?`Round ${Math.min(15,completedDays+1)} / 15`:'Waiting';
      if(!state.competition?.roster_locked_at){body.innerHTML='<div class="notice">F-All has not started yet. Admin will select and lock the 15-player roster.</div>';return}
      const champ=state.competition?.champion_id?`<div class="fall-champion">🏆 F-All Champion: <b>${esc(playerName(state.competition.champion_id))}</b></div>`:'';
      const membership=member?'<div class="notice good">You are in this season’s F-All Cup.</div>':'<div class="notice">You are not in this season’s 15-player F-All Cup roster, but you can follow the table and results.</div>';
      body.innerHTML=`${champ}${membership}<div class="fall-block"><div class="kicker">Standings</div><h3>F-All table</h3>${tableHTML(me)}</div><div class="fall-block"><div class="kicker">Full schedule</div><h3>15 rounds</h3>${roundsHTML(me)}</div>`;
    }catch(err){body.innerHTML=`<div class="notice bad">Could not load F-All: ${esc(err.message||err)}</div>`}
  }

  function ensureAdminUI(){
    const nav=q('#adminTabs');if(!nav)return;
    let btn=q('[data-admin-tab="fall"]',nav);
    if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.adminTab='fall';btn.innerHTML='<b>F-All</b><small>15-round cup</small>';const players=q('[data-admin-tab="players"]',nav);players?nav.insertBefore(btn,players):nav.appendChild(btn)}
    if(!q('[data-admin-panel="fall"]')){
      const anchor=q('[data-admin-panel="players"]');const panel=document.createElement('div');panel.className='admin-tab-panel hidden';panel.dataset.adminPanel='fall';panel.innerHTML='<section class="card fall-admin-hero"><div class="section-head"><div><div class="kicker">Competition control</div><h3>⚽ F-All Cup</h3><div class="muted">Select 15 players, lock the roster, then tick F-All week on 15 normal Super 6 rounds.</div></div><span class="chip" id="adminFallStatus">Not started</span></div><div id="adminFallBody"><div class="muted">Loading F-All…</div></div></section>';anchor?.parentNode?.insertBefore(panel,anchor); if(!anchor)q('#adminArea .screen')?.appendChild(panel)
    }
    if(!nav.dataset.fallBound){nav.dataset.fallBound='1';nav.addEventListener('click',e=>{const b=e.target.closest('button[data-admin-tab="fall"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();qa('button[data-admin-tab]',nav).forEach(x=>x.classList.toggle('active',x===b));qa('[data-admin-panel]').forEach(x=>x.classList.add('hidden'));q('[data-admin-panel="fall"]')?.classList.remove('hidden');renderAdmin(true)},true)}
  }

  function rosterPickerHTML(){
    return `<div class="notice"><b>Choose exactly 15 players.</b><br>When you lock the roster the app randomly generates all 15 rounds (105 head-to-head fixtures, with one bye per player). The roster cannot be changed afterwards.</div><div class="fall-select-head"><span><b id="fallSelectedCount">0</b> / 15 selected</span><button class="big-action" id="fallLockRoster" type="button" disabled>Lock 15 & generate fixtures</button></div>${state.leagues.map(l=>{const ps=state.players.filter(p=>String(p.league_id)===String(l.id));return `<div class="fall-roster-group"><h4>${esc(l.name)}</h4><div class="fall-player-grid">${ps.map(p=>`<label class="fall-player-option"><input type="checkbox" data-fall-player="${esc(p.id)}"><span>${esc(p.username)}</span></label>`).join('')}</div></div>`}).join('')}`;
  }

  async function renderAdmin(force=false){
    ensureAdminUI();const body=q('#adminFallBody'),chip=q('#adminFallStatus');if(!body)return;body.innerHTML='<div class="muted">Loading F-All…</div>';
    try{await loadState(force);const locked=!!state.competition?.roster_locked_at;const completedDays=new Set(state.matches.filter(m=>m.status==='completed').map(m=>m.matchday)).size;chip.textContent=state.competition?.champion_id?'Complete':locked?`Round ${Math.min(15,completedDays+1)} / 15`:'Not started';
      if(!locked){body.innerHTML=rosterPickerHTML();bindRosterPicker();return}
      const rows=tableRows(),leader=rows[0],done=state.matches.filter(m=>m.status==='completed').length;
      const champ=state.competition?.champion_id?`<div class="fall-champion">🏆 F-All Champion: <b>${esc(playerName(state.competition.champion_id))}</b></div>`:'';
      const championControl=done===105&&!state.competition?.champion_id?`<div class="notice"><b>All 15 rounds are complete.</b><br>Table tie-break order is F-All points → total F-All-week S6 points → head-to-head. If still identical, use the Admin decision below.</div><div class="inline"><select id="fallChampionSelect">${rows.map(r=>`<option value="${esc(r.id)}" ${leader?.id===r.id?'selected':''}>${esc(r.name)} · ${r.pts} pts · ${r.s6} S6</option>`).join('')}</select><button id="fallSetChampion" class="secondary" type="button">Confirm F-All champion</button></div>`:'';
      body.innerHTML=`${champ}<div class="fall-admin-summary"><div><span>Roster</span><b>15</b></div><div><span>Rounds complete</span><b>${completedDays}/15</b></div><div><span>Matches complete</span><b>${done}/105</b></div><div><span>Leader</span><b style="font-size:15px">${esc(leader?.name||'—')}</b></div></div><div class="fall-block"><div class="kicker">Standings</div><h3>F-All table</h3>${tableHTML()}</div>${championControl}<div class="fall-block"><div class="kicker">Generated draw</div><h3>15-round fixture list</h3>${roundsHTML()}</div>`;
      q('#fallSetChampion')?.addEventListener('click',async()=>{const id=q('#fallChampionSelect')?.value;if(!id)return;if(!confirm('Confirm this player as the F-All Cup champion?'))return;try{const {error}=await sb.rpc('admin_set_fall_champion',{p_player_id:id});if(error)throw error;await renderAdmin(true)}catch(err){alert(err.message||err)}});
    }catch(err){body.innerHTML=`<div class="notice bad">Could not load F-All: ${esc(err.message||err)}</div>`}
  }

  function bindRosterPicker(){
    const boxes=qa('[data-fall-player]'),count=q('#fallSelectedCount'),btn=q('#fallLockRoster');
    const update=()=>{const n=boxes.filter(x=>x.checked).length;if(count)count.textContent=n;if(btn)btn.disabled=n!==15;boxes.forEach(x=>{if(n>=15&&!x.checked)x.disabled=true;else x.disabled=false})};
    boxes.forEach(x=>x.addEventListener('change',update));update();
    btn?.addEventListener('click',async()=>{const ids=boxes.filter(x=>x.checked).map(x=>x.dataset.fallPlayer);if(ids.length!==15)return;if(!confirm('Lock these 15 players and randomly generate all 15 F-All rounds? This roster cannot be changed afterwards.'))return;btn.disabled=true;btn.textContent='Generating…';try{const {error}=await sb.rpc('admin_lock_fall_roster',{p_player_ids:ids});if(error)throw error;await renderAdmin(true);await syncRoundToggle(true)}catch(err){alert(err.message||err);btn.disabled=false;btn.textContent='Lock 15 & generate fixtures'}})
  }

  function ensureRoundToggle(){
    const editor=q('[data-admin-panel="round"]');if(!editor||q('#fallWeekCheckbox'))return;
    const shart=q('.shart-toggle',editor);const ch=q('.chumpions-toggle',editor);const label=document.createElement('label');label.className='fall-toggle';label.innerHTML='<input id="fallWeekCheckbox" type="checkbox"><span><b>⚽ F-All Cup week</b><small>Tick this when this normal Super 6 round should play the next F-All round (7 H2H fixtures + one bye).</small><em id="fallWeekHelp">Lock the 15-player F-All roster first.</em></span>';
    (shart||ch)?.insertAdjacentElement('afterend',label);if(!shart&&!ch)q('#fixtureEditor',editor)?.insertAdjacentElement('beforebegin',label);
    syncRoundToggle(false);
  }

  async function currentRound(){
    await loadState(false);return (state.rounds||[]).find(r=>r.status==='published'||r.status==='draft')||state.rounds?.[0]||null;
  }
  async function syncRoundToggle(force=false){
    ensureRoundToggle();const cb=q('#fallWeekCheckbox'),help=q('#fallWeekHelp');if(!cb)return;
    try{await loadState(force);const round=await currentRound();const locked=!!state.competition?.roster_locked_at;cb.disabled=!locked||!round;cb.checked=!!round?.fall_week;const day=round?(state.matches||[]).find(m=>String(m.round_id)===String(round.id))?.matchday:null;help.textContent=!locked?'Lock the 15-player F-All roster first.':day?`This is F-All Round ${day}.`:'Tick to assign the next F-All round.'}catch(err){cb.disabled=true;if(help)help.textContent='Could not load F-All status.'}
  }

  function bindRoundSave(){
    const btn=q('#saveRoundBtn');if(!btn||btn.dataset.fallBound)return;btn.dataset.fallBound='1';
    btn.addEventListener('click',()=>{const wanted=!!q('#fallWeekCheckbox')?.checked;setTimeout(async()=>{try{await loadState(true);const round=await currentRound();if(!round)return;const {error}=await sb.rpc('admin_set_fall_week',{p_round_id:round.id,p_enabled:wanted});if(error)throw error;await loadState(true);await syncRoundToggle(false);if(!isHidden(q('[data-admin-panel="fall"]')))renderAdmin(false)}catch(err){alert('F-All week: '+(err.message||err))}},1200)},true);
  }

  function boot(){ensurePlayerUI();ensureAdminUI();ensureRoundToggle();bindRoundSave();if(!isHidden(q('#adminArea')))syncRoundToggle(false)}
  boot();
  const mo=new MutationObserver(()=>{boot()});
  mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('focus',()=>{if(!isHidden(q('#playerFall')))renderPlayer(true);if(!isHidden(q('[data-admin-panel="fall"]')))renderAdmin(true)});
})().catch(err=>{console.error(err);const el=document.getElementById('app')||document.body;if(el){const d=document.createElement('div');d.className='notice bad';d.textContent='F-All failed to start: '+(err?.message||err);el.prepend(d)}});
