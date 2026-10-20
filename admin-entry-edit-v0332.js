// Super 6 v0.34.6 — Admin player predictions and audited manual points corrections.
(async()=>{
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') throw new Error('Super 6 backend is not ready.');
  const sb=B.client();

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const HOURS_FALLBACK=168;
  let roundCache=null;
  let hoursCache=HOURS_FALLBACK;
  let loading=null;

  function injectStyle(){
    if($('#admin48EntryStyle')) return;
    const style=document.createElement('style');
    style.id='admin48EntryStyle';
    style.textContent=`
      .admin-entry-48-btn{margin-left:auto;white-space:nowrap}
      .admin-entry-48-banner{margin:0 0 10px;padding:10px 12px;border:1px solid #c9b777;border-radius:10px;background:#fff8df;color:#173f2a;font-size:12px;line-height:1.35}
      .admin-entry-48-banner b{display:block;margin-bottom:2px}
      .admin-entry-48-banner.closed{background:#f3eee2;color:#6d6657;border-color:#d9d0bc}
      .admin48-grid{display:grid;gap:8px;margin-top:12px}
      .admin48-row{display:grid;grid-template-columns:minmax(0,1fr) 58px 16px 58px;gap:6px;align-items:center;padding:9px 0;border-bottom:1px solid #e4dcc8}
      .admin48-row span:first-child{font-size:12px;font-weight:700;min-width:0}
      .admin48-row input{width:100%;padding:8px 5px;text-align:center;border:1px solid #cfc4a9;border-radius:8px;background:#fff}
      .admin48-help{margin:8px 0 0;color:#667067;font-size:11px;line-height:1.4}
      .admin-correction-picker{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:12px}
      .admin-correction-picker .field{flex:1 1 220px;margin:0}
      .admin-correction-picker button{flex:0 1 auto;white-space:nowrap}
      .admin-manual-box{margin-top:13px;padding:12px;border:1px solid #d6ceb9;border-radius:12px;background:#fffaf0}
      .admin-manual-box h4{margin:0 0 5px;font-size:14px}
      .admin-manual-box .manual-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .admin-manual-box .manual-controls button{flex:0 1 auto}
      .admin-manual-box textarea{min-height:62px}
      @media(max-width:480px){.admin-manual-box .manual-controls button{flex:1 1 100%}}

      @media(max-width:480px){.admin-correction-picker button{width:100%}}
      .admin48-reason{width:100%;min-height:80px;font-size:16px;padding:10px 12px;border:1px solid #cfc4a9;border-radius:10px;background:#fff;resize:vertical;line-height:1.5}
      @media(max-width:420px){
        .admin-entry-48-btn{font-size:10px;padding:7px 8px}
        .admin48-row{grid-template-columns:minmax(0,1fr) 50px 12px 50px}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadWindow(force=false){
    if(loading&&!force) return loading;
    loading=(async()=>{
      const [roundRes,settingsRes]=await Promise.all([
        B.loadCurrentRound(),
        sb.from('app_settings').select('admin_entry_edit_hours').eq('id',1).maybeSingle()
      ]);
      roundCache=roundRes||null;
      hoursCache=Number(settingsRes?.data?.admin_entry_edit_hours??HOURS_FALLBACK)||HOURS_FALLBACK;
      return {round:roundCache,hours:hoursCache};
    })();
    try{return await loading}finally{loading=null}
  }

  function deadline(round=roundCache,hours=hoursCache){
    const cutoff=round?.cutoff_at?new Date(round.cutoff_at):null;
    if(!cutoff||Number.isNaN(cutoff.getTime())) return null;
    return new Date(cutoff.getTime()+Number(hours||HOURS_FALLBACK)*3600000);
  }

  function windowOpen(){
    const end=deadline();
    return !!end && Date.now()<end.getTime();
  }

  function windowLabel(){return hoursCache%24===0?(hoursCache/24)+'-day':hoursCache+'-hour'}

  function fmt(d){
    if(!d)return '';
    return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);
  }

  async function ensureBanner(){
    const panels=$('#adminLeaguePanels');
    if(!panels)return;
    await loadWindow(false).catch(()=>{});
    let banner=$('#adminEntry48Banner');
    if(!banner){
      banner=document.createElement('div');
      banner.id='adminEntry48Banner';
      banner.className='admin-entry-48-banner';
      panels.parentNode?.insertBefore(banner,panels);
    }
    const end=deadline();
    if(!roundCache||!end){
      banner.className='admin-entry-48-banner closed';
      banner.innerHTML='<b>Admin score corrections</b>No current round is available.';
      return;
    }
    if(windowOpen()){
      banner.className='admin-entry-48-banner';
      banner.innerHTML=`<b>Admin-only ${windowLabel()} grace period.</b>Only record predictions received before kickoff. Players remain locked at the normal cutoff. The Admin window closes ${esc(fmt(end))}.`;
    }else{
      banner.className='admin-entry-48-banner closed';
      banner.innerHTML='<b>Admin score correction window closed.</b>The Admin grace period after cutoff has ended.';
    }
  }

  async function decorateRows(){
    injectStyle();
    const panels=$('#adminLeaguePanels');
    if(!panels)return;
    await loadWindow(false).catch(()=>{});
    await ensureBanner();
    const open=windowOpen();

    $$('[data-view]',panels).forEach(view=>{
      const row=view.closest('.player-row');
      if(!row)return;
      let btn=row.querySelector('.admin-entry-48-btn');
      if(!open){
        btn?.remove();
        return;
      }
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='secondary small admin-entry-48-btn';
        btn.textContent='Edit picks';
        btn.dataset.playerId=view.dataset.view||'';
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          openEditor(btn.dataset.playerId);
        });
        const paid=row.querySelector('.switch');
        if(paid) row.insertBefore(btn,paid);
        else row.appendChild(btn);
      }
    });
    await ensureResultsShortcut();
  }


  // Make Admin score-prediction entry visible in Results as well as Overview.
  // Server-side Admin checks, cutoff limits and audit notes remain authoritative.
  let resultsShortcutLoading=null;
  let resultsShortcutRetryAt=0;

  let manualReadSequence=0;
  async function refreshManualOverride(hub,playerId){
    const token=++manualReadSequence;
    const summary=hub.querySelector('#adminManualCurrent');
    const status=hub.querySelector('#adminManualStatus');
    const points=hub.querySelector('#adminManualPoints');
    const setButton=hub.querySelector('#adminSetManualPoints');
    const clearButton=hub.querySelector('#adminClearManualPoints');
    points.disabled=true;
    setButton.disabled=true;
    clearButton.disabled=true;
    summary.textContent=playerId?'Loading current weekly points…':'Choose a player to see their weekly points.';
    status.textContent='';
    hub.dataset.manualPlayerId='';
    hub.dataset.manualHasOverride='0';
    if(!playerId)return;
    try{
      await loadWindow(true);
      const [scoreRes,overrideRes]=await Promise.all([
        sb.from('round_player_results').select('points,counted').eq('round_id',roundCache.id)
          .eq('player_id',playerId).maybeSingle(),
        sb.from('admin_points_overrides').select('points,reason,updated_at').eq('round_id',roundCache.id)
          .eq('player_id',playerId).maybeSingle()
      ]);
      if(scoreRes.error)throw scoreRes.error;
      if(overrideRes.error)throw overrideRes.error;
      if(token!==manualReadSequence||hub.querySelector('#adminChoosePlayer')?.value!==playerId)return;
      const calculated=scoreRes.data;
      const override=overrideRes.data;
      const usable=!!calculated?.counted && windowOpen() && String(roundCache.status)==='completed';
      hub.dataset.manualPlayerId=playerId;
      hub.dataset.manualHasOverride=override?'1':'0';
      if(!calculated){
        summary.textContent='No counted score yet. Enter all six predictions and confirm Paid in Overview first.';
        return;
      }
      summary.textContent=override
        ?'Current points: '+calculated.points+' · Manual override active ('+override.points+' points).'
        :'Current points: '+calculated.points+' · Calculated automatically.';
      points.value=String(override?.points??calculated.points);
      points.disabled=!usable;
      setButton.disabled=!usable;
      clearButton.disabled=!usable||!override;
      if(!usable)status.textContent=windowOpen()
        ?'Only completed rounds with paid, counted entries can be overridden.'
        :'The Admin score correction window is closed.';
    }catch(err){
      if(token!==manualReadSequence)return;
      summary.textContent='Manual points are not available yet.';
      status.textContent=err?.message||'Could not load the points override.';
    }
  }

  async function saveManualOverride(hub,clear){
    const playerId=hub.dataset.manualPlayerId;
    const status=hub.querySelector('#adminManualStatus');
    const raw=hub.querySelector('#adminManualPoints').value;
    const reason=hub.querySelector('#adminManualReason').value.trim();
    const points=Number(raw);
    if(!playerId||playerId!==hub.querySelector('#adminChoosePlayer').value){
      status.textContent='Choose a player first.';
      return;
    }
    if(!windowOpen()){
      status.textContent='The Admin correction window has closed.';
      return;
    }
    if(reason.length<8||reason.length>500){
      status.textContent='Enter an 8–500 character reason for this change.';
      return;
    }
    if(!clear && (raw===''||!Number.isInteger(points)||points<0||points>30)){
      status.textContent='Enter a whole number of points from 0 to 30.';
      return;
    }
    if(clear && hub.dataset.manualHasOverride!=='1'){
      status.textContent='This player has no override to clear.';
      return;
    }
    const setButton=hub.querySelector('#adminSetManualPoints');
    const clearButton=hub.querySelector('#adminClearManualPoints');
    setButton.disabled=true;
    clearButton.disabled=true;
    status.textContent=clear?'Restoring automatic scoring…':'Saving audited manual points…';
    try{
      const {error}=await sb.rpc('admin_set_player_points_override',{
        p_round_id:roundCache.id,
        p_player_id:playerId,
        p_points:clear?null:points,
        p_reason:reason,
        p_clear:clear
      });
      if(error)throw error;
      status.textContent=clear?'Automatic points restored ✓':'Points corrected and results recalculated ✓';
      hub.querySelector('#adminManualReason').value='';
      await refreshManualOverride(hub,playerId);
      setTimeout(()=>location.reload(),900);
    }catch(err){
      status.textContent=err?.message||'Unable to save the manual points correction.';
      setButton.disabled=false;
      clearButton.disabled=hub.dataset.manualHasOverride!=='1';
    }
  }

  async function ensureResultsShortcut(){
    const panel=$('[data-admin-panel="results"]');
    const overview=$('#adminLeaguePanels');
    if(!panel||!overview)return;
    const existing=$('#adminPlayerCorrectionHub');
    if(existing){
      const editButton=existing.querySelector('#adminChoosePlayerEdit');
      if(editButton)editButton.disabled=!windowOpen();
      return;
    }
    if(resultsShortcutLoading||Date.now()<resultsShortcutRetryAt)return;
    resultsShortcutLoading=(async()=>{
      const {data:allowed,error:accessError}=await sb.rpc('is_admin');
      if(accessError||allowed!==true){
        resultsShortcutRetryAt=Date.now()+10000;
        return;
      }
      const {data:players,error:playerError}=await sb.from('profiles')
        .select('id,username').eq('role','player').order('username');
      if(playerError)throw playerError;
      const hub=document.createElement('section');
      hub.className='card';
      hub.id='adminPlayerCorrectionHub';
      hub.innerHTML=[
        '<div class="section-head"><div><div class="kicker">Player corrections</div>',
        '<h3>Add or edit a player’s predictions</h3>',
        '<div class="muted">Enter the six predicted scores and first-goal minute. The app recalculates points automatically for paid entries.</div>',
        '</div></div>',
        '<div class="admin-correction-picker">',
        '<label class="field" for="adminChoosePlayer">Choose a player',
        '<select id="adminChoosePlayer" style="font-size:16px;min-width:0;width:100%">',
        '<option value="">Select a player…</option>',
        (players||[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.username)+'</option>').join(''),
        '</select></label>',
        '<button id="adminChoosePlayerEdit" class="big-action" type="button" '+(windowOpen()?'':'disabled')+'>Add / edit predictions</button>',
        '</div>',
        '<div class="admin48-help">Admin only · '+esc(windowLabel())+' after round cutoff · original predictions must have been received before kickoff. Corrections are audited. Mark payment separately in Overview.</div>',
        '<div id="adminPlayerCorrectionStatus" class="muted" role="status" style="margin-top:8px"></div>',
        '<div id="adminManualOverrideBox" class="admin-manual-box">',
        '<h4>Manual weekly points override</h4>',
        '<div class="admin48-help">Normally points calculate automatically. This separate correction is only for a paid, counted entry; it is audit logged and affects cup results too.</div>',
        '<div id="adminManualCurrent" class="muted" style="margin-top:8px">Choose a player to view their current points.</div>',
        '<label class="field" style="margin-top:8px">Correct weekly points (0–30)<input type="number" inputmode="numeric" min="0" max="30" id="adminManualPoints" style="font-size:16px" disabled></label>',
        '<label class="field">Reason for correcting the points (required)<textarea id="adminManualReason" class="admin48-reason" maxlength="500" placeholder="e.g. Reconciled against Dayle’s spreadsheet."></textarea></label>',
        '<div class="manual-controls"><button type="button" class="big-action" id="adminSetManualPoints" disabled>Save points override</button><button type="button" class="secondary" id="adminClearManualPoints" disabled>Restore automatic points</button></div>',
        '<div id="adminManualStatus" class="muted" role="status" style="margin-top:7px"></div>',
        '</div>'
      ].join('');
      const layout=panel.querySelector('.admin-layout');
      if(layout)panel.insertBefore(hub,layout);
      else panel.appendChild(hub);
      const picker=hub.querySelector('#adminChoosePlayer');
      picker.addEventListener('change',()=>refreshManualOverride(hub,picker.value));
      hub.querySelector('#adminSetManualPoints').addEventListener('click',()=>saveManualOverride(hub,false));
      hub.querySelector('#adminClearManualPoints').addEventListener('click',()=>saveManualOverride(hub,true));
      hub.querySelector('#adminChoosePlayerEdit').addEventListener('click',()=>{
        const selected=hub.querySelector('#adminChoosePlayer').value;
        if(!selected){
          hub.querySelector('#adminPlayerCorrectionStatus').textContent='Choose a player first.';
          return;
        }
        if(!windowOpen()){
          hub.querySelector('#adminPlayerCorrectionStatus').textContent='The Admin correction window has closed.';
          return;
        }
        openEditor(selected);
      });
    })();
    try{await resultsShortcutLoading}
    catch(err){
      resultsShortcutRetryAt=Date.now()+10000;
      console.warn('Could not load Admin player correction shortcut',err);
    }finally{resultsShortcutLoading=null}
  }

  function closeEditor(){
    const modal=$('#admin48EntryModal');
    if(modal) modal.remove();
  }

  async function openEditor(playerId){
    if(!playerId)return;
    try{
      await loadWindow(true);
      if(!windowOpen()){
        alert('The Admin entry grace period for this round has closed.');
        return;
      }

      const [entryRes,profileRes]=await Promise.all([
        B.loadAdminPlayerEntry(roundCache.id,playerId),
        sb.from('profiles').select('id,username').eq('id',playerId).single()
      ]);
      if(profileRes.error) throw profileRes.error;

      const profile=profileRes.data;
      const existing=entryRes?.entry||null;
      const byFixture=new Map((entryRes?.predictions||[]).map(x=>[String(x.fixture_id),x]));
      const fixtures=(roundCache.fixtures||[]).filter(f=>!f.removed);
      const rows=fixtures.map(f=>{
        const p=byFixture.get(String(f.id));
        return `<div class="admin48-row" data-fixture="${esc(f.id)}">
          <span>${esc(f.home_team)} v ${esc(f.away_team)}</span>
          <input data-home type="number" min="0" max="20" inputmode="numeric" value="${p?.home_score??''}" aria-label="${esc(f.home_team)} score">
          <i>–</i>
          <input data-away type="number" min="0" max="20" inputmode="numeric" value="${p?.away_score??''}" aria-label="${esc(f.away_team)} score">
        </div>`;
      }).join('');

      const root=$('#modalRoot')||document.body;
      const wrap=document.createElement('div');
      wrap.className='modal';
      wrap.id='admin48EntryModal';
      wrap.innerHTML=`<div class="modal-card">
        <div class="section-head">
          <div><div class="kicker">Admin-only correction</div><h3>${existing?'Edit':'Add'} ${esc(profile.username)}'s scores</h3>
          <div class="muted">${esc(roundCache.name)} · players themselves are locked at cutoff</div></div>
          <button class="secondary small" id="admin48Close" type="button">Close</button>
        </div>
        <div class="notice"><b>${windowLabel()} Admin grace period.</b> Only enter predictions already received before kickoff. Changes are saved to the player's entry and audit logged.</div>
        <div class="admin48-grid">${rows}</div>
        <label class="field" style="margin-top:12px">First-goal minute (1–90)
          <input id="admin48Minute" type="number" min="1" max="90" inputmode="numeric" value="${existing?.first_goal_minute??''}">
        </label>
        <div class="admin48-help">Enter all six score predictions and the player's first-goal minute exactly as they supplied them.</div>
        <label class="field" style="margin-top:12px">Source / reason for late entry (required)
          <textarea id="admin48Reason" class="admin48-reason" maxlength="500" placeholder="e.g. Scores sent in the WhatsApp group before Saturday cutoff; entering them on Tuesday." aria-required="true"></textarea>
        </label>
        <div class="admin48-help">For fairness, confirm where and when these predictions were originally submitted. This note is retained in the audit log.</div>
        <div id="admin48Status" class="muted" style="margin-top:9px"></div>
        <div class="modal-actions">
          <button class="secondary" id="admin48Cancel" type="button">Cancel</button>
          <button class="big-action" id="admin48Save" style="width:auto" type="button">${existing?'Save correction':'Add scores'}</button>
        </div>
      </div>`;
      root.appendChild(wrap);
      $('#admin48Close').onclick=closeEditor;
      $('#admin48Cancel').onclick=closeEditor;
      wrap.addEventListener('click',e=>{if(e.target===wrap)closeEditor()});

      $('#admin48Save').onclick=async()=>{
        const status=$('#admin48Status'),btn=$('#admin48Save');
        const minute=Number($('#admin48Minute').value);
        const reason=$('#admin48Reason').value.trim();
        if(reason.length<8||reason.length>500){
          status.textContent='Please record an 8–500 character source or reason for this Admin entry.';
          return;
        }
        if(!Number.isInteger(minute)||minute<1||minute>90){
          status.textContent='Enter a first-goal minute between 1 and 90.';
          return;
        }
        const predictions=[];
        let valid=true;
        $$('.admin48-row',wrap).forEach(row=>{
          const h=row.querySelector('[data-home]').value;
          const a=row.querySelector('[data-away]').value;
          if(h===''||a===''){valid=false;return}
          const hs=Number(h),as=Number(a);
          if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||hs>20||as>20){valid=false;return}
          predictions.push({fixture_id:row.dataset.fixture,home_score:hs,away_score:as});
        });
        if(!valid||predictions.length!==fixtures.length){
          status.textContent='Enter both scores for every fixture. Scores must be 0–20.';
          return;
        }
        btn.disabled=true;
        btn.textContent='Saving…';
        status.textContent='Saving Admin correction with audit note…';
        try{
          const {error}=await sb.rpc('admin_upsert_player_entry_with_reason',{
            p_round_id:roundCache.id,
            p_player_id:playerId,
            p_first_goal_minute:minute,
            p_predictions:predictions,
            p_reason:reason
          });
          if(error)throw error;
          status.innerHTML='<span style="color:#176b3a;font-weight:700">Saved ✓</span>';
          setTimeout(()=>location.reload(),500);
        }catch(err){
          status.textContent=err?.message||'Could not save the Admin correction.';
          btn.disabled=false;
          btn.textContent=existing?'Save correction':'Add scores';
        }
      };
    }catch(err){
      alert(err?.message||'Could not open Admin score correction.');
    }
  }

  let scheduled=false;
  function scheduleDecorate(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(async()=>{
      scheduled=false;
      if($('#adminLeaguePanels')) await decorateRows().catch(console.warn);
    },80);
  }

  // Rebuild the Admin-only picker when the signed-in account changes.
  let shortcutAuthUser=null;
  sb.auth.onAuthStateChange((event,session)=>{
    const userId=session?.user?.id||null;
    if(userId===shortcutAuthUser)return;
    shortcutAuthUser=userId;
    resultsShortcutRetryAt=0;
    $('#adminPlayerCorrectionHub')?.remove();
    scheduleDecorate();
  });

  const observer=new MutationObserver(scheduleDecorate);
  observer.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('focus',()=>{loadWindow(true).then(scheduleDecorate).catch(()=>{})});
  setInterval(()=>{loadWindow(true).then(scheduleDecorate).catch(()=>{})},60000);
  scheduleDecorate();
})().catch(err=>console.error('Admin seven-day entry edit patch failed',err));
