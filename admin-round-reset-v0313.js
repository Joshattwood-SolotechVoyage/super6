// Super 6 v0.31.3 — clean Results tab when Admin starts a new round.
(()=>{
  const ids={
    start:'startNextRoundBtn',
    save:'saveRoundBtn',
    editor:'resultsEditor',
    minute:'officialMinute',
    weekly:'weeklyResults',
    money:'moneySummary',
    pot:'seasonPotHistory',
    validation:'resultValidation',
    complete:'completeRoundBtn',
    reopen:'reopenRoundBtn',
    poster:'posterBtn'
  };

  let resetWindowUntil=0;
  let pendingNewRound=false;

  const el=id=>document.getElementById(id);

  function cleanOutcome(){
    const weekly=el(ids.weekly);
    if(weekly){
      weekly.innerHTML='<div class="notice admin-round-reset-note"><b>New round — no results yet.</b><br>Weekly winners and spoons will appear here after this round is completed.</div>';
    }
    const money=el(ids.money); if(money) money.innerHTML='';
    const pot=el(ids.pot); if(pot) pot.innerHTML='';
    const validation=el(ids.validation); if(validation) validation.textContent='';
    const minute=el(ids.minute); if(minute) minute.value='';
    const reopen=el(ids.reopen); if(reopen) reopen.classList.add('hidden');
    const poster=el(ids.poster); if(poster) poster.disabled=true;
  }

  function cleanEditor(showMessage=true){
    const editor=el(ids.editor);
    if(!editor)return;
    if(showMessage){
      editor.innerHTML='<div class="notice admin-round-reset-note"><b>Results cleared for the new round.</b><br>Save & publish the new fixtures first. The Results page will then be ready for this week only.</div>';
    }else{
      editor.querySelectorAll('.result-entry input').forEach(input=>{
        input.value='';
        input.removeAttribute('value');
      });
    }
  }

  function beginNewRoundReset(){
    pendingNewRound=true;
    resetWindowUntil=Date.now()+2500;
    cleanEditor(true);
    cleanOutcome();
    const complete=el(ids.complete); if(complete) complete.disabled=true;
    // The main app re-renders during new-round creation. Re-apply the clean state
    // briefly so the previous week's result DOM cannot flash back in.
    [60,180,420,850,1400].forEach(ms=>setTimeout(()=>{
      if(Date.now()<=resetWindowUntil){
        cleanEditor(true);
        cleanOutcome();
      }
    },ms));
  }

  function afterRoundSaved(){
    // Allow the main app to build the new round's result rows, then make sure
    // every score/minute field starts blank and old outcome cards are gone.
    resetWindowUntil=Date.now()+1400;
    [180,450,900].forEach(ms=>setTimeout(()=>{
      if(Date.now()>resetWindowUntil)return;
      cleanEditor(false);
      cleanOutcome();
      const editor=el(ids.editor);
      const complete=el(ids.complete);
      if(complete && editor?.querySelector('.result-entry')) complete.disabled=false;
    },ms));
  }

  document.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target)return;
    if(target.id===ids.start){
      // Run after the app's own click handler has begun the new-round flow.
      setTimeout(beginNewRoundReset,0);
    }
    if(target.id===ids.save && pendingNewRound){
      pendingNewRound=false;
      setTimeout(afterRoundSaved,0);
    }
  },true);

  // If the app redraws the Results panel inside the short reset window,
  // immediately replace any stale previous-week content.
  const root=document.getElementById('app')||document.body;
  const observer=new MutationObserver(()=>{
    if(Date.now()>resetWindowUntil)return;
    cleanOutcome();
    const editor=el(ids.editor);
    if(editor && !editor.querySelector('.admin-round-reset-note')) cleanEditor(true);
  });
  observer.observe(root,{childList:true,subtree:true});
})();