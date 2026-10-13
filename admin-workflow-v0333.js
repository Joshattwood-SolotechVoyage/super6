// Super 6 v0.33.3 — safer Admin workflow: 48h payment corrections, clean new rounds, ordered tabs.
(async()=>{
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') throw new Error('Super 6 backend is not ready.');
  const sb=B.client();

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const COMP_IDS=['shartWeekCheckbox','chumpionsWeekCheckbox','nohopeWeekCheckbox','fallWeekCheckbox'];
  const LABELS={
    shartWeekCheckbox:'SHART',
    chumpionsWeekCheckbox:'Chumpions',
    nohopeWeekCheckbox:'No-Hope-A',
    fallWeekCheckbox:'F-All'
  };

  let roundCache=null;
  let adminHours=48;
  let loadPromise=null;
  let drafting=false;
  let draftChoices=Object.fromEntries(COMP_IDS.map(id=>[id,false]));
  let draftTimer=null;
  let saveReleaseTimer=null;

  function injectStyle(){
    if(q('#adminWorkflow0333Style')) return;
    const st=document.createElement('style');
    st.id='adminWorkflow0333Style';
    st.textContent=`
      .competition-switch-group{margin:14px 0 16px;padding:12px;border:1px solid var(--line);border-radius:13px;background:#fffaf0}
      .competition-switch-group-head{margin-bottom:9px}
      .competition-switch-group-head b{display:block;color:var(--green);font-size:14px}
      .competition-switch-group-head small{display:block;margin-top:3px;color:var(--muted);line-height:1.35}
      .competition-switch-group>label{margin:8px 0}
      .admin-correction-note{margin:0 0 12px;padding:11px 12px;border:1px solid #cbbd8c;border-radius:11px;background:#fff7dd;color:#173f2a;font-size:12px;line-height:1.4}
      .admin-correction-note b{display:block;margin-bottom:2px}
      .admin-correction-note.closed{background:#f2eee4;color:#686256;border-color:#d8d0bf}
      .admin-correction-note.good{background:#e5efe1;border-color:#a9c49f}
      .admin-draft-badge{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#efe4c8;color:#173f2a;font-size:10px;font-weight:800}
    `;
    document.head.appendChild(st);
  }

  async function loadAdminWindow(force=false){
    if(loadPromise&&!force) return loadPromise;
    loadPromise=(async()=>{
      const [roundRes,settingRes]=await Promise.all([
        B.loadCurrentRound().catch(()=>null),
        sb.from('app_settings').select('admin_entry_edit_hours').eq('id',1).maybeSingle()
      ]);
      roundCache=roundRes||null;
      adminHours=Number(settingRes?.data?.admin_entry_edit_hours??48)||48;
      return {round:roundCache,hours:adminHours};
    })();
    try{return await loadPromise}finally{loadPromise=null}
  }

  function correctionEnd(){
    if(!roundCache?.cutoff_at)return null;
    const d=new Date(roundCache.cutoff_at);
    if(Number.isNaN(d.getTime()))return null;
    return new Date(d.getTime()+adminHours*3600000);
  }

  function correctionOpen(){
    const end=correctionEnd();
    return !!end&&Date.now()<end.getTime();
  }

  function fmt(d){
    if(!d)return '';
    return new Intl.DateTimeFormat('en-GB',{
      weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'
    }).format(d);
  }

  function reorderButtons(nav,attr,order,rename={}){
    if(!nav)return;
    for(const key of order){
      const btn=q(`button[${attr}="${key}"]`,nav);
      if(!btn)continue;
      if(rename[key]){
        if(attr==='data-admin-tab'){
          const b=q('b',btn);if(b)b.textContent=rename[key].label;
          const small=q('small',btn);if(small)small.textContent=rename[key].small||'';
        }else btn.textContent=rename[key].label;
      }
      nav.appendChild(btn);
    }
  }

  function orderTabs(){
    reorderButtons(
      q('.player-nav'),
      'data-player-tab',
      ['home','tables','shart','chumpions','nohope','fall','history'],
      {tables:{label:'Main League'}}
    );
    reorderButtons(
      q('#adminTabs'),
      'data-admin-tab',
      ['overview','round','results','tables','shart','chumpions','nohope','fall','players'],
      {tables:{label:'Main League',small:'Standings'}}
    );
  }

  function ensureCompetitionGroup(){
    const panel=q('[data-admin-panel="round"]');
    if(!panel)return;
    let group=q('#competitionSwitchGroup',panel);
    if(!group){
      group=document.createElement('div');
      group.id='competitionSwitchGroup';
      group.className='competition-switch-group';
      group.innerHTML='<div class="competition-switch-group-head"><b>Round counts for</b><small>Main League always counts. Extra competitions are OFF by default on every new round — tick only the ones you want this week.</small></div>';
      const editor=q('#fixtureEditor',panel);
      editor?.parentNode?.insertBefore(group,editor);
    }
    const selectors=['.shart-toggle','.chumpions-toggle','.nohope-toggle','.fall-toggle'];
    for(const selector of selectors){
      const label=q(selector,panel);
      if(label&&label.parentNode!==group)group.appendChild(label);
    }
    // Reorder again because dynamic competition scripts may insert labels relative to one another.
    for(const selector of selectors){
      const label=q(selector,group);
      if(label)group.appendChild(label);
    }
  }

  function setDraftHelp(id){
    const map={
      shartWeekCheckbox:'#shartWeekHelp',
      chumpionsWeekCheckbox:'#chumpionsWeekHelp',
      nohopeWeekCheckbox:'#nohopeWeekHelp',
      fallWeekCheckbox:'#fallWeekHelp'
    };
    const el=q(map[id]||'');
    if(el&&drafting&&!draftChoices[id]) el.textContent=`${LABELS[id]} is off for this new round. Tick it only if you want this week to count.`;
  }

  function applyDraftChoices(){
    if(!drafting)return;
    for(const id of COMP_IDS){
      const cb=q('#'+id);
      if(!cb)continue;
      if(cb.checked!==Boolean(draftChoices[id])) cb.checked=Boolean(draftChoices[id]);
      setDraftHelp(id);
    }
  }

  function beginDraft(){
    drafting=true;
    draftChoices=Object.fromEntries(COMP_IDS.map(id=>[id,false]));
    clearInterval(draftTimer);
    clearTimeout(saveReleaseTimer);
    const enforce=()=>{
      ensureCompetitionGroup();
      applyDraftChoices();
    };
    enforce();
    draftTimer=setInterval(enforce,180);
    setTimeout(enforce,40);
    setTimeout(enforce,120);
    setTimeout(enforce,400);
  }

  function releaseDraftAfterSave(){
    clearTimeout(saveReleaseTimer);
    // Keep guarding the checkboxes while the core save and competition add-ons
    // resolve the newly-created database round.
    saveReleaseTimer=setTimeout(()=>{
      drafting=false;
      clearInterval(draftTimer);
      draftTimer=null;
      setTimeout(()=>loadAdminWindow(true).then(syncAll).catch(()=>{}),400);
    },2600);
  }

  function bindNewRoundGuard(){
    if(document.documentElement.dataset.adminWorkflow0333Bound)return;
    document.documentElement.dataset.adminWorkflow0333Bound='1';

    document.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn)return;
      if(btn.id==='startNextRoundBtn'){
        // Capture before the old round's competition scripts get another chance
        // to re-apply their database flags.
        beginDraft();
      }
      if(btn.id==='saveRoundBtn'&&drafting){
        applyDraftChoices();
        releaseDraftAfterSave();
      }
    },true);

    document.addEventListener('change',e=>{
      const el=e.target;
      if(!drafting||!el?.id||!COMP_IDS.includes(el.id))return;
      draftChoices[el.id]=Boolean(el.checked);
      setDraftHelp(el.id);
    },true);
  }

  async function syncAdminPaymentControls(){
    const overview=q('[data-admin-panel="overview"]');
    if(!overview)return;
    await loadAdminWindow(false).catch(()=>{});
    const open=correctionOpen();
    const end=correctionEnd();

    // The legacy UI disables these at the 12-hour PLAYER payment deadline.
    // Admin now has its own 48-hour correction window.
    qa('input[data-paid]',overview).forEach(input=>{
      if(open&&input.disabled)input.disabled=false;
      if(!open&&!input.disabled)input.disabled=true;
      input.title=open?`Admin payment correction open until ${fmt(end)}`:'Admin payment correction window closed';
    });

    const head=q('.section-head .muted',overview);
    if(head)head.textContent='Tap a player to inspect their entry. Admin can correct scores and payment status for 48 hours after cutoff.';

    let note=q('#adminPaymentCorrectionNote',overview);
    if(!note){
      note=document.createElement('div');
      note.id='adminPaymentCorrectionNote';
      const panels=q('#adminLeaguePanels',overview);
      panels?.parentNode?.insertBefore(note,panels);
    }
    if(!note)return;
    if(!roundCache||!end){
      note.className='admin-correction-note closed';
      note.innerHTML='<b>Admin corrections</b>No round is available.';
    }else if(open){
      note.className='admin-correction-note good';
      note.innerHTML=`<b>Admin corrections stay open after Complete Round.</b>Scores and payment status can be corrected until ${esc(fmt(end))}. Any completed-round payment change is recalculated automatically.`;
    }else{
      note.className='admin-correction-note closed';
      note.innerHTML='<b>Admin correction window closed.</b>The 48-hour period after cutoff has ended.';
    }
  }

  async function syncResultsMessage(){
    const panel=q('[data-admin-panel="results"]');
    if(!panel)return;
    await loadAdminWindow(false).catch(()=>{});
    const end=correctionEnd(),open=correctionOpen();
    const card=q('section.card',panel);
    if(!card)return;
    let note=q('#adminResultsCorrectionNote',card);
    if(!note){
      note=document.createElement('div');
      note.id='adminResultsCorrectionNote';
      const head=q('.section-head',card);
      head?.insertAdjacentElement('afterend',note);
    }
    if(!note)return;

    if(!roundCache||!end){
      note.className='admin-correction-note closed';
      note.innerHTML='<b>Admin corrections</b>No round is available.';
      return;
    }
    if(open&&String(roundCache.status)==='completed'){
      note.className='admin-correction-note good';
      note.innerHTML=`<b>Results calculated — this is not irreversible.</b>Admin can still correct player scores and payments until ${esc(fmt(end))}. Changes recalculate the round automatically.`;
    }else if(open){
      note.className='admin-correction-note';
      note.innerHTML=`<b>Complete Round does not close Admin editing.</b>After results are calculated, Admin corrections remain available until ${esc(fmt(end))}.`;
    }else{
      note.className='admin-correction-note closed';
      note.innerHTML='<b>Round is final for Admin corrections.</b>The 48-hour correction window has ended.';
    }
  }

  async function syncAll(){
    injectStyle();
    orderTabs();
    ensureCompetitionGroup();
    if(drafting)applyDraftChoices();
    await Promise.all([
      syncAdminPaymentControls().catch(()=>{}),
      syncResultsMessage().catch(()=>{})
    ]);
  }

  bindNewRoundGuard();
  await loadAdminWindow(false).catch(()=>{});
  await syncAll();

  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    setTimeout(async()=>{
      scheduled=false;
      await syncAll().catch(()=>{});
    },80);
  };

  const root=q('#app')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  window.addEventListener('focus',()=>loadAdminWindow(true).then(syncAll).catch(()=>{}));
  setInterval(()=>loadAdminWindow(true).then(syncAll).catch(()=>{}),60000);
})().catch(err=>console.error('Admin workflow v0.33.3 failed',err));
