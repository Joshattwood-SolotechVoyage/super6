// Super 6 v0.33.2 — Admin-only 48-hour player entry correction window.
(async()=>{
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') throw new Error('Super 6 backend is not ready.');
  const sb=B.client();

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const HOURS_FALLBACK=48;
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
      banner.innerHTML=`<b>Admin score corrections are open for 48 hours after cutoff.</b>Players remain locked at the normal cutoff. Admin correction window closes ${esc(fmt(end))}.`;
    }else{
      banner.className='admin-entry-48-banner closed';
      banner.innerHTML='<b>Admin score correction window closed.</b>The 48-hour period after cutoff has ended.';
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
        btn.textContent='Scores';
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
        alert('The 48-hour Admin score correction window has closed.');
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
        <div class="notice"><b>48-hour Admin window.</b> This writes directly to the player's saved Super 6 entry and is audit logged.</div>
        <div class="admin48-grid">${rows}</div>
        <label class="field" style="margin-top:12px">First-goal minute (1–90)
          <input id="admin48Minute" type="number" min="1" max="90" inputmode="numeric" value="${existing?.first_goal_minute??''}">
        </label>
        <div class="admin48-help">Enter all six score predictions and the player's first-goal minute exactly as they supplied them.</div>
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
        status.textContent='Saving Admin correction…';
        try{
          const {error}=await sb.rpc('admin_upsert_player_entry',{
            p_round_id:roundCache.id,
            p_player_id:playerId,
            p_first_goal_minute:minute,
            p_predictions:predictions
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

  const observer=new MutationObserver(scheduleDecorate);
  observer.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('focus',()=>{loadWindow(true).then(scheduleDecorate).catch(()=>{})});
  setInterval(()=>{loadWindow(true).then(scheduleDecorate).catch(()=>{})},60000);
  scheduleDecorate();
})().catch(err=>console.error('Admin 48-hour entry edit patch failed',err));
