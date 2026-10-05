// Super 6 v0.31.1 — corrected SHART flow
// Round 1: everybody qualifies together -> Top 32 -> random R32 -> knockout.
(()=>{
  const B=window.Super6Backend;
  if(!B||typeof B.loadShartState!=='function') return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const originalLoad=B.loadShartState.bind(B);
  let cache=null, loading=null;

  B.loadShartState=async function(){
    const base=await originalLoad();
    if(!base?.season?.id) return {...base,qualifyingResults:[]};
    const sb=B.client(), seasonId=base.season.id;
    const [memberRes,compRes]=await Promise.all([
      sb.from('shart_members').select('season_id, player_id, source, created_at').eq('season_id',seasonId),
      sb.from('shart_competition_state').select('season_id, qualifying_round_id, qualifying_calculated_at, qualifying_confirmed_at, qualifying_confirmed_by, draw_generated_at, draw_generated_by, champion_id, completed_at, updated_at').eq('season_id',seasonId).maybeSingle()
    ]);
    if(memberRes.error) throw new Error(memberRes.error.message||'Run the v0.31.1 SHART qualifier SQL upgrade.');
    if(compRes.error) throw new Error(compRes.error.message||'Run the v0.31.1 SHART qualifier SQL upgrade.');
    const competition=compRes.data||base.competition||null;
    let qualifyingResults=[];
    if(competition?.qualifying_round_id){
      const rr=await sb.from('round_player_results').select('round_id, player_id, points, tie_break_difference, counted, position, calculated_at').eq('round_id',competition.qualifying_round_id);
      if(rr.error) throw new Error(rr.error.message||'Could not load SHART qualifier results.');
      qualifyingResults=rr.data||[];
    }
    return {...base,members:memberRes.data||[],competition,qualifyingResults};
  };
  B.mode=(B.mode||'')+'-qualifier-v0311';

  const names=s=>new Map((s.players||[]).map(p=>[String(p.id),p.username||'Player']));
  const memberSet=s=>new Set((s.members||[]).map(m=>String(m.player_id)));
  const drawExists=s=>Boolean(s.competition?.draw_generated_at)||(s.matches||[]).length>0;
  const stageLabel=x=>x==='QUAL'?'Qualifying Round':x==='R32'?'Round of 32':x==='R16'?'Round of 16':x==='QF'?'Quarter-finals':x==='SF'?'Semi-finals':x==='F'?'Final':'SHART';
  const qRound=s=>{
    const id=s.competition?.qualifying_round_id;
    return (s.rounds||[]).find(r=>id&&String(r.id)===String(id))||(s.rounds||[]).find(r=>r.shart_stage==='QUAL')||null;
  };
  const qRows=s=>{
    const nm=names(s), rows=(s.qualifyingResults||[]).filter(r=>r.counted===true).map(r=>({...r,points:Number(r.points||0),tie_break_difference:r.tie_break_difference==null?null:Number(r.tie_break_difference)}));
    rows.sort((a,b)=>b.points-a.points||((a.tie_break_difference??999999)-(b.tie_break_difference??999999))||String(nm.get(String(a.player_id))||'').localeCompare(String(nm.get(String(b.player_id))||'')));
    let key='',pos=0;
    return rows.map((r,i)=>{const k=`${r.points}|${r.tie_break_difference==null?'x':r.tie_break_difference}`;if(k!==key){pos=i+1;key=k}return {...r,qpos:pos}});
  };
  const qMeta=s=>{
    const rows=qRows(s), members=memberSet(s), round=qRound(s), out={rows,members,round,completed:round?.status==='completed',counted:rows.length,boundary:[],seats:0,needsAdmin:false};
    if(!out.completed||rows.length<=32)return out;
    const b=rows[31]; if(!b)return out;
    const same=r=>r.points===b.points&&r.tie_break_difference===b.tie_break_difference;
    const better=rows.filter(r=>r.points>b.points||(r.points===b.points&&(r.tie_break_difference??999999)<(b.tie_break_difference??999999)));
    out.boundary=rows.filter(same); out.seats=Math.max(0,32-better.length); out.needsAdmin=out.boundary.length>out.seats;
    return out;
  };
  const currentStage=s=>['R32','R16','QF','SF','F'].find(st=>(s.matches||[]).some(m=>m.stage===st&&m.status!=='completed'))||null;
  const roundName=(s,id)=>(s.rounds||[]).find(r=>String(r.id)===String(id))?.name||'';

  function qTable(s,{admin=false,me='' }={}){
    const nm=names(s), meta=qMeta(s), members=memberSet(s), candidates=new Set(meta.needsAdmin?meta.boundary.map(r=>String(r.player_id)):[]);
    if(!meta.rows.length)return '<div class="notice shart-v0311-sentinel">Qualifier results will appear here after Round 1 is completed.</div>';
    return `<div class="shart-v0311-sentinel shart-qualifier-list"><div class="shart-qualifier-head"><span>Pos</span><span>Player</span><span>Pts</span><span>FG</span><span>Status</span></div>${meta.rows.map(r=>{
      const id=String(r.player_id), qualified=members.has(id), candidate=candidates.has(id), mine=me&&id===String(me), fg=r.tie_break_difference==null?'—':`±${r.tie_break_difference}m`;
      let label=qualified?'QUALIFIED':candidate?'ADMIN DECISION':Number(r.qpos)<=32?'PENDING':'OUT';
      const cb=admin&&candidate?`<input type="checkbox" data-shart-q="${esc(id)}" ${qualified?'checked':''}>`:'';
      return `<div class="shart-qualifier-row ${qualified?'qualified':''} ${candidate?'boundary':''} ${mine?'mine':''}"><span>${r.qpos}</span><span>${cb}<b>${esc(nm.get(id)||'Player')}</b></span><span>${r.points} pts</span><span>FG ${fg}</span><span>${label}</span></div>`;
    }).join('')}</div>`;
  }

  function matchHTML(s,m,admin=false){
    const nm=names(s), p1=String(m.player1_id||''),p2=String(m.player2_id||''), score=m.player1_score!=null&&m.player2_score!=null?`${m.player1_score} – ${m.player2_score}`:'vs';
    const note=m.status==='review'?'Admin decision needed':m.status==='completed'?`${esc(nm.get(String(m.winner_id))||'Winner')} through${m.decided_by==='first_goal'?' on first-goal tiebreak':m.decided_by==='admin'?' · Admin decision':''}`:m.round_id?(esc(roundName(s,m.round_id))||'Scheduled'):'Waiting for a SHART week';
    const controls=admin&&m.status==='review'&&p1&&p2?`<div class="shart-admin-choice"><small>Still tied — who advances?</small><div><button class="secondary small" data-shart-win="${esc(m.id)}" data-player="${esc(p1)}">${esc(nm.get(p1)||'Player')}</button><button class="secondary small" data-shart-win="${esc(m.id)}" data-player="${esc(p2)}">${esc(nm.get(p2)||'Player')}</button></div></div>`:'';
    return `<div class="shart-match ${m.status==='completed'?'done':''}"><div class="shart-match-main"><div><b>${esc(nm.get(p1)||'TBC')}</b><small>${m.player1_score==null?'':m.player1_score+' pts'}</small></div><strong>${score}</strong><div class="right"><b>${esc(nm.get(p2)||'TBC')}</b><small>${m.player2_score==null?'':m.player2_score+' pts'}</small></div></div><div class="shart-match-note">${note}</div>${controls}</div>`;
  }
  function bracket(s,admin=false){
    if(!drawExists(s))return '<div class="notice shart-v0311-sentinel">Complete Round 1, confirm the Top 32, then generate the random Round-of-32 draw.</div>';
    const nm=names(s), champ=s.competition?.champion_id?`<div class="shart-champion"><span>🏆 SHART Champion</span><strong>${esc(nm.get(String(s.competition.champion_id))||'Player')}</strong></div>`:'';
    return `<div class="shart-v0311-sentinel">${champ}<div class="shart-bracket">${['R32','R16','QF','SF','F'].map(st=>{const ms=(s.matches||[]).filter(m=>m.stage===st).sort((a,b)=>a.slot_no-b.slot_no);return `<section class="shart-stage"><div class="shart-stage-head"><b>${stageLabel(st)}</b><span>${ms.filter(m=>m.status==='completed').length}/${ms.length} decided</span></div>${ms.map(m=>matchHTML(s,m,admin)).join('')}</section>`}).join('')}</div></div>`;
  }

  async function getState(force=false){
    if(cache&&!force)return cache;
    if(loading)return loading;
    loading=B.loadShartState().then(s=>cache=s).finally(()=>loading=null);
    return loading;
  }
  async function authId(){try{return (await B.client().auth.getSession()).data?.session?.user?.id||''}catch{return ''}}
  const active=id=>{const el=document.querySelector(id);return el&&!el.classList.contains('hidden')};

  function bindAdmin(root){
    root.querySelectorAll('[data-shart-q]').forEach(cb=>cb.onchange=async()=>{cb.disabled=true;try{await B.setShartMember(cb.dataset.shartQ,cb.checked);cache=null;await renderAdmin(true)}catch(e){alert(e?.message||'Could not save qualifier decision.');cb.checked=!cb.checked}finally{cb.disabled=false}});
    root.querySelectorAll('[data-shart-win]').forEach(btn=>btn.onclick=async()=>{const name=btn.textContent;if(!confirm(`Advance ${name} from this SHART tie?`))return;btn.disabled=true;try{await B.chooseShartWinner(btn.dataset.shartWin,btn.dataset.player);cache=null;await renderAdmin(true)}catch(e){alert(e?.message||'Could not save SHART decision.')}finally{btn.disabled=false}});
  }

  async function renderAdmin(force=false){
    if(!active('#adminArea'))return;
    const week=document.querySelector('#adminShartCurrentWeek'), br=document.querySelector('#adminShartBracket'), roster=document.querySelector('#adminShartRoster'), count=document.querySelector('#shartEntrantCount');
    if(!week||!br||!roster)return;
    try{
      const s=await getState(force), meta=qMeta(s), members=memberSet(s), drawn=drawExists(s), stage=currentStage(s), current=await B.loadCurrentRound().catch(()=>null);
      if(count){count.textContent=`${members.size} / 32 qualified`;count.className='chip '+(members.size===32?'good':'')}
      if(!current) week.innerHTML=`<div class="notice shart-v0311-sentinel">${drawn&&stage?`Next stage: <b>${stageLabel(stage)}</b>. Create the next normal Super 6 round and tick <b>SHART week</b>.`:meta.round?`Qualifier: <b>${esc(meta.round.name||'Round 1')}</b>. ${meta.completed?'Review the Top 32 below.':'Complete it to calculate the Top 32.'}`:'Create a normal Super 6 round and tick <b>SHART week</b>. The first SHART week becomes the all-player qualifier.'}</div>`;
      else if(!current.shartRound&&!current.shart_round) week.innerHTML=`<div class="notice shart-v0311-sentinel">${esc(current.name||'Current round')} is not a SHART week.${!meta.round&&!drawn?' Tick <b>SHART week</b> to make it the all-player qualifier.':''}</div>`;
      else if((current.shartStage||current.shart_stage)==='QUAL') week.innerHTML=`<div class="shart-v0311-sentinel shart-week-banner"><b>💨 ${esc(current.name)} · Qualifying Round</b><span>Everybody is included automatically. Top 32 = points, then closest first-goal prediction.</span></div>${(current.completed||current.status==='completed')?qTable(s,{admin:true}):'<div class="notice shart-v0311-sentinel">Qualifier is live. There are no head-to-head ties yet.</div>'}`;
      else {const st=current.shartStage||current.shart_stage; const ms=(s.matches||[]).filter(m=>m.stage===st&&String(m.round_id||'')===String(current.id||'')); week.innerHTML=`<div class="shart-v0311-sentinel shart-week-banner"><b>💨 ${esc(current.name)} · ${stageLabel(st)}</b><span>Normal counted Super 6 scores decide each tie.</span></div>${ms.map(m=>matchHTML(s,m,true)).join('')}`}
      br.innerHTML=bracket(s,true);
      if(drawn) roster.innerHTML='<div class="notice good shart-v0311-sentinel"><b>Top 32 locked.</b> The Round-of-32 draw has been generated.</div>';
      else if(!meta.round) roster.innerHTML='<div class="notice shart-v0311-sentinel"><b>No manual entrant selection.</b><br>Everybody starts in Round 1. Tick <b>SHART week</b> on the qualifying Super 6 round.</div>';
      else if(!meta.completed) roster.innerHTML=`<div class="notice shart-v0311-sentinel"><b>${esc(meta.round.name||'Round 1')} is the qualifier.</b><br>Complete it and the app will calculate the Top 32 automatically.</div>`;
      else {
        const note=meta.needsAdmin?`<div class="notice warn"><b>Admin cut-line decision needed.</b><br>${meta.boundary.length} players are still exactly tied after points and first-goal accuracy. Choose ${meta.seats} for the remaining place${meta.seats===1?'':'s'}.</div>`:'<div class="notice good"><b>Top 32 calculated.</b> Ready for the random draw.</div>';
        const ready=members.size===32&&meta.counted>=32;
        roster.innerHTML=`<div class="shart-v0311-sentinel">${meta.counted<32?`<div class="notice bad">Only ${meta.counted} counted players — 32 are needed for the knockout.</div>`:''}${note}<div class="shart-roster-actions"><div><b>${members.size} / 32 qualified</b><small>No manual roster selection — only exact cut-line ties need Admin.</small></div><button id="shartV0311Draw" class="big-action" ${ready?'':'disabled'}>Confirm Top 32 & Generate random Round of 32</button></div>${qTable(s,{admin:true})}</div>`;
        const drawBtn=roster.querySelector('#shartV0311Draw'); if(drawBtn&&ready)drawBtn.onclick=async()=>{if(!confirm('Lock these Top 32 and generate the random Round-of-32 draw?'))return;drawBtn.disabled=true;try{await B.generateShartDraw();cache=null;await renderAdmin(true)}catch(e){alert(e?.message||'Could not generate SHART draw.')}};
      }
      bindAdmin(week);bindAdmin(br);bindAdmin(roster);
    }catch(e){week.innerHTML=`<div class="notice bad shart-v0311-sentinel">${esc(e?.message||'SHART setup error. Run the v0.31.1 SQL upgrade.')}</div>`;br.innerHTML='';roster.innerHTML=''}
  }

  async function renderPlayer(force=false){
    if(!active('#playerArea'))return;
    const body=document.querySelector('#playerShartBody'), status=document.querySelector('#playerShartStatus'); if(!body)return;
    try{
      const s=await getState(force), me=await authId(), meta=qMeta(s), members=memberSet(s), drawn=drawExists(s), qualified=members.has(String(me));
      if(!drawn){
        if(!meta.round){if(status)status.textContent='Waiting';body.innerHTML='<div class="notice shart-v0311-sentinel"><b>Round 1 is the SHART qualifier.</b><br>Everybody starts together. The Top 32 then go into the random knockout draw.</div>';return}
        if(!meta.completed){if(status)status.textContent='Qualifier';body.innerHTML=`<div class="shart-player-banner shart-v0311-sentinel"><b>💨 ${esc(meta.round.name||'SHART Qualifier')}</b><span>Everybody is in automatically. Top 32 qualify.</span></div>`;return}
        const cand=new Set(meta.needsAdmin?meta.boundary.map(r=>String(r.player_id)):[]), mine=meta.rows.find(r=>String(r.player_id)===String(me));
        if(status)status.textContent=qualified?'Qualified':cand.has(String(me))?'Admin decision':'Out';
        const banner=qualified?'<div class="shart-player-banner champion"><b>✅ Qualified for the Round of 32</b><span>The random draw will decide your opponent.</span></div>':cand.has(String(me))?'<div class="shart-player-banner"><b>⚖️ Tied on the cut line</b><span>Admin will decide the remaining qualifying place.</span></div>':mine?'<div class="shart-player-banner out"><b>Your SHART run ends in qualifying</b><span>You can still follow the competition.</span></div>':'<div class="notice">No counted qualifier result was recorded.</div>';
        body.innerHTML=`<div class="shart-v0311-sentinel">${banner}<div class="section-head"><div><div class="kicker">Round 1</div><h3>Qualifier standings</h3></div><span class="chip ${qualified?'good':''}">${members.size} / 32 qualified</span></div>${qTable(s,{me})}</div>`;return;
      }
      if(status)status.textContent=qualified?'Knockout':'Did not qualify';
      body.innerHTML=`<div class="shart-v0311-sentinel">${qualified?'<div class="notice good">You qualified for the SHART knockout.</div>':'<div class="notice">You did not qualify for the Round of 32.</div>'}${bracket(s,false)}</div>`;
    }catch(e){body.innerHTML=`<div class="notice bad shart-v0311-sentinel">${esc(e?.message||'SHART setup error. Run the v0.31.1 SQL upgrade.')}</div>`;if(status)status.textContent='Setup needed'}
  }

  async function render(force=false){
    const adminTab=document.querySelector('[data-admin-tab="shart"].active');
    const playerTab=document.querySelector('[data-player-tab="shart"].active');
    if(adminTab)await renderAdmin(force); if(playerTab)await renderPlayer(force);
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-admin-tab="shart"],[data-player-tab="shart"]'))setTimeout(()=>render(true),80)});
  const watch=new MutationObserver(()=>{
    const a=document.querySelector('[data-admin-tab="shart"].active'),p=document.querySelector('[data-player-tab="shart"].active');
    if(a&&!document.querySelector('#adminShartRoster .shart-v0311-sentinel'))setTimeout(()=>renderAdmin(false),20);
    if(p&&!document.querySelector('#playerShartBody .shart-v0311-sentinel'))setTimeout(()=>renderPlayer(false),20);
  });
  const app=document.querySelector('#app');if(app)watch.observe(app,{subtree:true,childList:true});
})();