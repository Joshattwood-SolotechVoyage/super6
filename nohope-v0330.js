// Super 6 v0.33.0 — No-Hope-A League
(async()=>{
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') throw new Error('Super 6 backend is not ready.');
  const sb=B.client();

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups=['A','B','C','D'];
  let state=null,loading=null,currentUserId=null;

  function hidden(el){return !el||el.classList.contains('hidden')}
  function nameOf(id){return state?.playerMap?.get(String(id))?.username||'Player'}
  function roundName(id){return state?.roundMap?.get(String(id))?.name||''}

  async function loadState(force=false){
    if(loading&&!force) return loading;
    loading=(async()=>{
      const {data:{user}}=await sb.auth.getUser(); currentUserId=user?.id||null;
      const {data:season,error:se}=await sb.from('seasons').select('id,name,status,created_at').eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(se) throw se;
      if(!season){state={season:null,players:[],leagues:[],members:[],matches:[],competition:null,finalists:[],knockout:[],rounds:[]};return state}

      const [pr,lr,mr,xr,cr,fr,kr,rr]=await Promise.all([
        sb.from('profiles').select('id,username,role,league_id').eq('role','player').order('username'),
        sb.from('leagues').select('id,name,sort_order').eq('season_id',season.id).order('sort_order'),
        sb.from('nohope_members').select('season_id,player_id,group_code,created_at,updated_at').eq('season_id',season.id),
        sb.from('nohope_matches').select('id,season_id,round_id,group_code,matchday,slot_no,player1_id,player2_id,player1_score,player2_score,player1_tiebreak,player2_tiebreak,status,winner_id,is_draw,calculated_at').eq('season_id',season.id).order('matchday').order('group_code').order('slot_no'),
        sb.from('nohope_competition_state').select('season_id,group_stage_confirmed,group_stage_confirmed_at,champion_id,completed_at,updated_at').eq('season_id',season.id).maybeSingle(),
        sb.from('nohope_group_finalists').select('season_id,group_code,position,player_id').eq('season_id',season.id).order('group_code').order('position'),
        sb.from('nohope_knockout_matches').select('id,season_id,stage,slot_no,round_id,player1_id,player2_id,player1_score,player2_score,player1_tiebreak,player2_tiebreak,status,winner_id,decided_by,calculated_at').eq('season_id',season.id),
        sb.from('rounds').select('id,name,status,cutoff_at,no_hope_a,completed_at').eq('season_id',season.id).order('cutoff_at',{ascending:false})
      ]);
      for(const r of [pr,lr,mr,xr,cr,fr,kr,rr]) if(r.error) throw r.error;

      const players=pr.data||[],rounds=rr.data||[];
      state={season,players,leagues:lr.data||[],members:mr.data||[],matches:xr.data||[],competition:cr.data||null,finalists:fr.data||[],knockout:kr.data||[],rounds};
      state.playerMap=new Map(players.map(p=>[String(p.id),p]));
      state.memberMap=new Map(state.members.map(m=>[String(m.player_id),m]));
      state.roundMap=new Map(rounds.map(r=>[String(r.id),r]));
      return state;
    })();
    try{return await loading}finally{loading=null}
  }

  function currentRound(){
    return state?.rounds?.find(r=>r.status==='published'||r.status==='draft')||state?.rounds?.[0]||null;
  }

  function groupCounts(){
    const out={A:0,B:0,C:0,D:0};
    for(const m of state?.members||[]) if(out[m.group_code]!=null) out[m.group_code]++;
    return out;
  }

  function groupRows(){
    const out={A:[],B:[],C:[],D:[]};
    for(const m of state?.members||[]){
      if(!out[m.group_code]) continue;
      out[m.group_code].push({
        id:String(m.player_id),name:nameOf(m.player_id),group:m.group_code,
        played:0,wins:0,draws:0,losses:0,points:0,s6:0,h2h:0,accuracy:0,accuracySamples:0
      });
    }
    const map=new Map(Object.values(out).flat().map(r=>[r.id,r]));
    const completed=(state?.matches||[]).filter(m=>m.status==='completed'&&m.player1_score!=null&&m.player2_score!=null);

    for(const m of completed){
      const a=map.get(String(m.player1_id)),b=map.get(String(m.player2_id)); if(!a||!b) continue;
      const s1=Number(m.player1_score),s2=Number(m.player2_score);
      a.played++;b.played++;a.s6+=s1;b.s6+=s2;
      if(m.player1_tiebreak!=null){a.accuracy+=Number(m.player1_tiebreak);a.accuracySamples++}
      if(m.player2_tiebreak!=null){b.accuracy+=Number(m.player2_tiebreak);b.accuracySamples++}
      if(s1>s2){a.wins++;b.losses++;a.points+=3}
      else if(s2>s1){b.wins++;a.losses++;b.points+=3}
      else{a.draws++;b.draws++;a.points++;b.points++}
    }

    for(const g of groups){
      const rows=out[g],groupMatches=completed.filter(m=>m.group_code===g);
      const cohorts=new Map();
      rows.forEach(r=>{if(!cohorts.has(r.points))cohorts.set(r.points,[]);cohorts.get(r.points).push(r)});
      for(const cohort of cohorts.values()){
        if(cohort.length<2) continue;
        const ids=new Set(cohort.map(r=>r.id));
        for(const m of groupMatches.filter(m=>ids.has(String(m.player1_id))&&ids.has(String(m.player2_id)))){
          const a=map.get(String(m.player1_id)),b=map.get(String(m.player2_id));
          const s1=Number(m.player1_score),s2=Number(m.player2_score);
          if(s1>s2)a.h2h+=3;else if(s2>s1)b.h2h+=3;else{a.h2h++;b.h2h++}
        }
      }
      rows.sort((a,b)=>
        b.points-a.points||
        b.h2h-a.h2h||
        b.s6-a.s6||
        ((a.accuracySamples?a.accuracy:999999)-(b.accuracySamples?b.accuracy:999999))||
        a.name.localeCompare(b.name)
      );
      let last='',pos=0;
      rows.forEach((r,i)=>{
        const acc=r.accuracySamples?r.accuracy:'x';
        const key=`${r.points}|${r.h2h}|${r.s6}|${acc}`;
        if(key!==last){pos=i+1;last=key}
        r.position=pos;r.tieKey=key;r.qualifying=pos<=4;
      });
    }
    return out;
  }

  function groupTable(g,me=''){
    const rows=groupRows()[g]||[];
    if(!rows.length) return '<div class="notice">No players assigned to this group yet.</div>';
    return `<div class="nohope-table-wrap"><table class="nohope-table"><thead><tr><th>Pos</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>`<tr class="${me===r.id?'me':''} ${r.qualifying?'qualifying':''}"><td>${r.position}</td><td title="${esc(r.name)}"><b>${esc(r.name)}</b></td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td><b>${r.points}</b></td></tr>`).join('')}</tbody></table></div>`;
  }

  function allGroupsHTML(me=''){
    return `<div class="nohope-groups">${groups.map(g=>`<section class="nohope-group-card"><div class="nohope-group-title"><h4>Group ${g}</h4><span>Top 4 qualify</span></div>${groupTable(g,me)}</section>`).join('')}</div>`;
  }

  function stageLabel(s){return s==='R16'?'Round of 16':s==='QF'?'Quarter-finals':s==='SF'?'Semi-finals':'Final'}
  function stageOrder(s){return s==='R16'?1:s==='QF'?2:s==='SF'?3:4}

  function knockoutHTML(admin=false,me=''){
    const rows=[...(state?.knockout||[])].sort((a,b)=>stageOrder(a.stage)-stageOrder(b.stage)||Number(a.slot_no)-Number(b.slot_no));
    if(!rows.length) return '<div class="notice">The knockout bracket appears once the group tables are confirmed.</div>';
    return `<div class="nohope-knockout">${['R16','QF','SF','F'].map(stage=>{
      const matches=rows.filter(m=>m.stage===stage);
      return `<section class="nohope-stage"><div class="nohope-stage-head"><b>${stageLabel(stage)}</b><span>${matches.length?matches.filter(m=>m.status==='completed').length+'/'+matches.length:'Waiting'}</span></div><div class="nohope-match-grid">${matches.length?matches.map(m=>knockoutMatchHTML(m,admin,me)).join(''):'<div class="notice">Waiting for previous stage.</div>'}</div></section>`;
    }).join('')}</div>`;
  }

  function knockoutMatchHTML(m,admin=false,me=''){
    const p1=String(m.player1_id),p2=String(m.player2_id),mine=me&&(me===p1||me===p2);
    const done=m.status==='completed',review=m.status==='review';
    const s1=m.player1_score==null?'—':m.player1_score,s2=m.player2_score==null?'—':m.player2_score;
    const winner=String(m.winner_id||'');
    const decision=done?(m.decided_by==='score'?'Super 6 points':m.decided_by==='first_goal'?'First-goal tiebreak':'Admin decision'):review?'Admin review required':m.round_id?(roundName(m.round_id)||'Scheduled'):'Waiting for No-Hope-A week';
    const controls=admin&&review?`<div class="nohope-admin-decision"><small>Still tied / requires review</small><button data-nohope-winner="${esc(p1)}" data-nohope-match="${esc(m.id)}" type="button">${esc(nameOf(p1))} advances</button><button data-nohope-winner="${esc(p2)}" data-nohope-match="${esc(m.id)}" type="button">${esc(nameOf(p2))} advances</button></div>`:'';
    return `<div class="nohope-ko-match ${mine?'mine':''} ${done?'done':''} ${review?'review':''}"><div class="${winner===p1?'winner':''}"><b>${esc(nameOf(p1))}</b><strong>${s1}</strong></div><div class="${winner===p2?'winner':''}"><b>${esc(nameOf(p2))}</b><strong>${s2}</strong></div><small>${esc(decision)}</small>${controls}</div>`;
  }

  function currentWeekHTML(){
    const round=currentRound();
    if(!round) return '<div class="notice">No current Super 6 round.</div>';
    const gm=(state.matches||[]).filter(m=>String(m.round_id)===String(round.id));
    const km=(state.knockout||[]).filter(m=>String(m.round_id)===String(round.id));
    if(!round.no_hope_a&&!gm.length&&!km.length) return '<div class="notice">This Super 6 round is not a No-Hope-A week.</div>';

    if(gm.length){
      const day=gm[0]?.matchday;
      return `<div class="nohope-current"><div><b>No-Hope-A Matchday ${day}</b><span>${esc(round.name)}</span></div><div class="nohope-current-fixtures">${gm.map(m=>`<div><span>Group ${esc(m.group_code)}</span><b>${esc(nameOf(m.player1_id))} <i>${m.status==='completed'?(m.player1_score+'–'+m.player2_score):'v'}</i> ${esc(nameOf(m.player2_id))}</b></div>`).join('')}</div></div>`;
    }
    if(km.length){
      return `<div class="nohope-current"><div><b>${esc(stageLabel(km[0].stage))}</b><span>${esc(round.name)}</span></div><div class="nohope-current-fixtures">${km.map(m=>`<div><span>Match ${m.slot_no}</span><b>${esc(nameOf(m.player1_id))} <i>${m.status==='completed'?(m.player1_score+'–'+m.player2_score):'v'}</i> ${esc(nameOf(m.player2_id))}</b></div>`).join('')}</div></div>`;
    }
    return '<div class="notice">No-Hope-A is selected, but fixtures have not been attached yet.</div>';
  }

  function rosterHTML(){
    const counts=groupCounts(),started=(state.matches||[]).length>0||!!state.competition?.group_stage_confirmed;
    const search=(q('#nohopePlayerSearch')?.value||'').trim().toLowerCase();
    const players=(state.players||[]).filter(p=>!search||p.username.toLowerCase().includes(search));
    return `<div class="nohope-counts">${groups.map(g=>`<span class="${counts[g]===5?'good':''}">Group ${g} <b>${counts[g]}/5</b></span>`).join('')}</div>${started?'<div class="notice">Group membership is locked because the competition has started.</div>':'<div class="notice">Assign exactly 5 players to each group. There are 20 places in total.</div>'}<div class="nohope-roster">${players.map(p=>{const current=state.memberMap.get(String(p.id))?.group_code||'';return `<div class="nohope-roster-row"><b>${esc(p.username)}</b><select data-nohope-player="${esc(p.id)}" ${started?'disabled':''}><option value="">Not entered</option>${groups.map(g=>`<option value="${g}" ${current===g?'selected':''}>Group ${g}</option>`).join('')}</select></div>`}).join('')}</div>`;
  }

  function confirmGroupHTML(){
    if(state.competition?.group_stage_confirmed) return '<div class="notice good">Group tables confirmed. The Round of 16 bracket is locked.</div>';
    const completed=(state.matches||[]).filter(m=>m.status==='completed').length;
    const review=(state.matches||[]).filter(m=>m.status==='review').length;
    if((state.matches||[]).length<80) return `<div class="notice"><b>Group stage: ${(state.matches||[]).length}/80 fixtures created.</b><br>There are 10 No-Hope-A matchdays. Confirm the tables after all group fixtures are complete.</div>`;
    if(completed<80) return `<div class="notice"><b>${completed}/80 fixtures completed.</b>${review?' '+review+' fixture(s) need review before the group stage can be closed.':''}</div>`;
    return '<div class="notice good"><b>All 80 group fixtures are complete.</b><br>The current top four in each group will be locked into the Round of 16.</div><button class="big-action" id="confirmNohopeGroups" type="button">Confirm tables & create Round of 16</button>';
  }

  function ensurePlayerUI(){
    const nav=q('.player-nav');if(!nav)return;
    let btn=q('[data-player-tab="nohope"]',nav);
    if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.playerTab='nohope';btn.textContent='No-Hope-A';const hist=q('[data-player-tab="history"]',nav);hist?nav.insertBefore(btn,hist):nav.appendChild(btn)}
    if(!q('#playerNohope')){
      const history=q('#playerHistory');const el=document.createElement('div');el.className='screen hidden';el.id='playerNohope';
      el.innerHTML='<section class="card nohope-hero"><div class="section-head"><div><div class="kicker">Extra competition</div><h3>🚫 No-Hope-A League</h3><div class="muted">4 groups of 5 · everyone plays everyone twice · top 4 qualify · then Round of 16 through to the Final.</div></div><span class="chip" id="playerNohopeStatus">Group stage</span></div><div id="playerNohopeBody"><div class="muted">Loading No-Hope-A…</div></div></section>';
      history?.parentNode?.insertBefore(el,history);
    }
    if(!nav.dataset.nohopeBound){
      nav.dataset.nohopeBound='1';
      nav.addEventListener('click',e=>{
        const b=e.target.closest('button[data-player-tab]');if(!b)return;
        if(b.dataset.playerTab==='nohope'){
          e.preventDefault();e.stopImmediatePropagation();
          qa('button[data-player-tab]',nav).forEach(x=>x.classList.toggle('active',x===b));
          qa('#playerArea > .screen').forEach(x=>x.classList.add('hidden'));
          q('#playerNohope')?.classList.remove('hidden');
          renderPlayer(true);
        }else q('#playerNohope')?.classList.add('hidden');
      },true);
    }
  }

  async function renderPlayer(force=false){
    ensurePlayerUI();const body=q('#playerNohopeBody'),chip=q('#playerNohopeStatus');if(!body)return;
    body.innerHTML='<div class="muted">Loading No-Hope-A…</div>';
    try{
      await loadState(force);
      const me=String(currentUserId||''),member=state.memberMap.get(me),champ=state.competition?.champion_id;
      chip.textContent=champ?'Complete':state.competition?.group_stage_confirmed?'Knockout':'Group stage';
      const champion=champ?`<div class="nohope-champion">🏆 No-Hope-A Champion <b>${esc(nameOf(champ))}</b></div>`:'';
      const mine=member?`<div class="notice good">You are in <b>Group ${esc(member.group_code)}</b>.</div>`:'<div class="notice">You are not currently entered in No-Hope-A, but you can follow the competition.</div>';
      body.innerHTML=`${champion}${mine}<div class="nohope-block"><div class="kicker">Group stage</div><h3>Standings</h3>${allGroupsHTML(me)}</div><div class="nohope-block"><div class="kicker">Knockout stage</div><h3>Road to the Final</h3>${knockoutHTML(false,me)}</div>`;
    }catch(err){body.innerHTML=`<div class="notice bad">Could not load No-Hope-A: ${esc(err.message||err)}</div>`}
  }

  function ensureAdminUI(){
    const nav=q('#adminTabs');if(!nav)return;
    let btn=q('[data-admin-tab="nohope"]',nav);
    if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.adminTab='nohope';btn.innerHTML='<b>No-Hope-A</b><small>Groups & knockouts</small>';const players=q('[data-admin-tab="players"]',nav);players?nav.insertBefore(btn,players):nav.appendChild(btn)}
    if(!q('[data-admin-panel="nohope"]')){
      const players=q('[data-admin-panel="players"]');const panel=document.createElement('div');panel.className='admin-tab-panel hidden';panel.dataset.adminPanel='nohope';
      panel.innerHTML='<section class="card nohope-admin-hero"><div class="section-head"><div><div class="kicker">Competition control</div><h3>🚫 No-Hope-A League</h3><div class="muted">The Chumpions format with smaller groups: 4 groups of 5, double round robin, top 4 qualify, then Round of 16 to Final.</div></div><span class="chip good">4 × 5</span></div><div class="notice">Group scoring: 3 points win · 1 draw · 0 loss. Knockouts: Super 6 points → closest first-goal prediction → Admin decision if still level.</div><div id="adminNohopeCurrentWeek"></div></section><section class="card"><div class="section-head"><div><div class="kicker">Live group stage</div><h3>Standings</h3><div class="muted">Each player plays the other four players twice. Every five-player group has one bye each matchday.</div></div></div><div id="adminNohopeStandings"></div><div id="adminNohopeConfirm"></div></section><section class="card"><div class="section-head"><div><div class="kicker">Knockout stage</div><h3>Road to the Final</h3><div class="muted">Top four from every group make the Round of 16. Winners feed the bracket automatically.</div></div><span class="chip">R16 → Final</span></div><div id="adminNohopeKnockout"></div></section><section class="card"><div class="section-head"><div><div class="kicker">Group setup</div><h3>Players & groups</h3><div class="muted">Exactly 5 players per group. Choose A, B, C, D or Not entered.</div></div></div><label class="latest-picks-search"><span>🔎</span><input id="nohopePlayerSearch" type="search" placeholder="Search player…" autocomplete="off"></label><div id="adminNohopeRoster"></div></section>';
      players?.parentNode?.insertBefore(panel,players);
    }
    if(!nav.dataset.nohopeBound){
      nav.dataset.nohopeBound='1';
      nav.addEventListener('click',e=>{
        const b=e.target.closest('button[data-admin-tab="nohope"]');if(!b)return;
        e.preventDefault();e.stopImmediatePropagation();
        qa('button[data-admin-tab]',nav).forEach(x=>x.classList.toggle('active',x===b));
        qa('[data-admin-panel]').forEach(x=>x.classList.add('hidden'));
        q('[data-admin-panel="nohope"]')?.classList.remove('hidden');
        renderAdmin(true);
      },true);
    }
  }

  async function renderAdmin(force=false){
    ensureAdminUI();
    const current=q('#adminNohopeCurrentWeek'),stand=q('#adminNohopeStandings'),confirmBox=q('#adminNohopeConfirm'),ko=q('#adminNohopeKnockout'),roster=q('#adminNohopeRoster');
    if(!current||!stand||!ko||!roster)return;
    try{
      await loadState(force);
      current.innerHTML=currentWeekHTML();
      stand.innerHTML=allGroupsHTML();
      confirmBox.innerHTML=confirmGroupHTML();
      ko.innerHTML=knockoutHTML(true);
      roster.innerHTML=rosterHTML();
      bindAdminActions();
      syncRoundToggle(false);
    }catch(err){
      current.innerHTML=`<div class="notice bad">Could not load No-Hope-A: ${esc(err.message||err)}</div>`;
    }
  }

  function bindAdminActions(){
    q('#nohopePlayerSearch')?.addEventListener('input',()=>{
      const holder=q('#adminNohopeRoster');if(holder){holder.innerHTML=rosterHTML();bindRosterSelects()}
    });
    bindRosterSelects();

    q('#confirmNohopeGroups')?.addEventListener('click',async()=>{
      const standings=groupRows();
      const finalists=[];
      for(const g of groups){
        const rows=standings[g]||[];
        for(let i=0;i<4;i++) if(rows[i]) finalists.push({group_code:g,position:i+1,player_id:rows[i].id});
      }
      if(finalists.length!==16){alert('The four groups do not have 16 qualifying places yet.');return}
      if(!confirm('Lock the current top four in every group and create the No-Hope-A Round of 16?'))return;
      const btn=q('#confirmNohopeGroups');btn.disabled=true;btn.textContent='Creating bracket…';
      try{
        const {error}=await sb.rpc('admin_confirm_nohope_group_stage',{p_finalists:finalists});
        if(error)throw error;
        await renderAdmin(true);
      }catch(err){alert(err.message||err);btn.disabled=false;btn.textContent='Confirm tables & create Round of 16'}
    });

    qa('[data-nohope-winner]').forEach(btn=>btn.addEventListener('click',async()=>{
      const player=btn.dataset.nohopeWinner,match=btn.dataset.nohopeMatch;
      if(!confirm(`Advance ${nameOf(player)} from this tied knockout match?`))return;
      try{
        const {error}=await sb.rpc('admin_choose_nohope_knockout_winner',{p_match_id:match,p_player_id:player});
        if(error)throw error;
        await renderAdmin(true);
      }catch(err){alert(err.message||err)}
    }));
  }

  function bindRosterSelects(){
    qa('[data-nohope-player]').forEach(sel=>sel.addEventListener('change',async()=>{
      const player=sel.dataset.nohopePlayer,value=sel.value||null,old=state.memberMap.get(String(player))?.group_code||'';
      sel.disabled=true;
      try{
        const {error}=await sb.rpc('admin_set_nohope_member',{p_player_id:player,p_group_code:value});
        if(error)throw error;
        await renderAdmin(true);
      }catch(err){alert(err.message||err);sel.value=old;sel.disabled=false}
    }));
  }

  function ensureRoundToggle(){
    const panel=q('[data-admin-panel="round"]');if(!panel||q('#nohopeWeekCheckbox'))return;
    const anchor=q('.fall-toggle',panel)||q('.shart-toggle',panel)||q('.chumpions-toggle',panel);
    const label=document.createElement('label');label.className='nohope-toggle';
    label.innerHTML='<input id="nohopeWeekCheckbox" type="checkbox"><span><b>🚫 No-Hope-A League week</b><small>Tick this when this Super 6 round should play the next No-Hope-A group matchday or knockout stage.</small><em id="nohopeWeekHelp">Set up all four groups first.</em></span>';
    anchor?.insertAdjacentElement('afterend',label);
  }

  async function syncRoundToggle(force=false){
    ensureRoundToggle();const cb=q('#nohopeWeekCheckbox'),help=q('#nohopeWeekHelp');if(!cb)return;
    try{
      await loadState(force);
      const round=currentRound(),counts=groupCounts(),groupsReady=groups.every(g=>counts[g]===5);
      const started=(state.matches||[]).length>0,confirmed=!!state.competition?.group_stage_confirmed,champion=!!state.competition?.champion_id;
      const days=new Set((state.matches||[]).map(m=>m.matchday)).size;
      const attachedGroup=round?(state.matches||[]).find(m=>String(m.round_id)===String(round.id)):null;
      const attachedKO=round?(state.knockout||[]).find(m=>String(m.round_id)===String(round.id)):null;
      cb.checked=!!round?.no_hope_a;
      cb.disabled=!round||champion||(!started&&!groupsReady)||(started&&!confirmed&&days>=10&&!attachedGroup);
      if(!round)help.textContent='No current Super 6 round.';
      else if(champion)help.textContent='No-Hope-A is complete.';
      else if(attachedGroup)help.textContent=`This is No-Hope-A Matchday ${attachedGroup.matchday}.`;
      else if(attachedKO)help.textContent=`This is the No-Hope-A ${stageLabel(attachedKO.stage)}.`;
      else if(!groupsReady&&!started)help.textContent='Assign exactly 5 players to each group first.';
      else if(started&&!confirmed&&days>=10)help.textContent='All 10 group matchdays are assigned. Confirm the group tables next.';
      else if(confirmed)help.textContent='Tick to attach the next No-Hope-A knockout stage.';
      else help.textContent=`Tick to create No-Hope-A Matchday ${days+1} of 10.`;
    }catch(err){cb.disabled=true;if(help)help.textContent='Could not load No-Hope-A status.'}
  }

  function bindRoundSave(){
    const btn=q('#saveRoundBtn');if(!btn||btn.dataset.nohopeBound)return;btn.dataset.nohopeBound='1';
    btn.addEventListener('click',()=>{
      const wanted=!!q('#nohopeWeekCheckbox')?.checked;
      setTimeout(async()=>{
        try{
          await loadState(true);
          const round=currentRound();if(!round)return;
          if(Boolean(round.no_hope_a)!==wanted){
            const {error}=await sb.rpc('admin_set_nohope_round',{p_round_id:round.id,p_enabled:wanted});
            if(error)throw error;
          }
          await loadState(true);await syncRoundToggle(false);
          if(!hidden(q('[data-admin-panel="nohope"]')))renderAdmin(false);
        }catch(err){alert('No-Hope-A week: '+(err.message||err));await syncRoundToggle(true)}
      },1200);
    },true);
  }

  function boot(){
    ensurePlayerUI();ensureAdminUI();ensureRoundToggle();bindRoundSave();
    if(!hidden(q('#adminArea')))syncRoundToggle(false);
  }

  boot();
  const mo=new MutationObserver(()=>boot());
  mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('focus',()=>{
    if(!hidden(q('#playerNohope')))renderPlayer(true);
    if(!hidden(q('[data-admin-panel="nohope"]')))renderAdmin(true);
  });
})().catch(err=>{
  console.error(err);
  const el=document.getElementById('app')||document.body;
  if(el){const d=document.createElement('div');d.className='notice bad';d.textContent='No-Hope-A failed to start: '+(err?.message||err);el.prepend(d)}
});