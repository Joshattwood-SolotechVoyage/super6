// Super 6 v0.36.0. One entry point for all competition shootouts.
(async () => {
  if (window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const db = window.Super6Backend.client();
  const cups = { shart: 'SHART', chumpions: 'Chumpions League', nohope: 'No Hope' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}) + ' UK';
  const rows = response => { if (response.error) throw Error(response.error.message); return response.data || []; };
  const rootFor = (cup,admin) => admin ? document.querySelector('[data-admin-panel="'+cup+'"]') : document.getElementById('player'+cup[0].toUpperCase()+cup.slice(1));
  let generation = 0, identity = '', model = [], busy = false, pending = false;
  function clear() {
    document.querySelectorAll('.cup-shootouts').forEach(el => el.remove());
    model = [];
    identity = '';
    generation++;
  }
  async function refresh() {
    if (busy) { pending = true; return; }
    busy = true;
    const version = generation;
    try {
      const {data:{session}} = await db.auth.getSession();
      if (!session || version !== generation) return;
      const admin = !document.getElementById('adminArea')?.classList.contains('hidden');
      const uid = session.user.id;
      if (document.getElementById('appScreen')?.classList.contains('hidden')) return;
      const season = rows(await db.from('seasons').select('id').eq('status','active').order('created_at',{ascending:false}).limit(1))[0];
      if (!season) return;
      let parents = db.from('shootout_parents').select('*').eq('season_id',season.id);
      if (!admin) parents = parents.or('player1_id.eq.'+uid+',player2_id.eq.'+uid);
      const [matches, attempts] = (await Promise.all([parents, db.from('shart_shootouts').select('*').eq('season_id',season.id).order('attempt_no',{ascending:false})])).map(rows);
      const ties = matches.map(m => ({...m, so: attempts.find(s => (s.match_id || s.chumpions_match_id || s.nohope_match_id) === m.id)})).filter(m => m.is_tie || ['walkover','completed'].includes(m.so?.status));
      const ids = ties.map(m => m.so?.id).filter(Boolean);
      const people = [...new Set(ties.flatMap(m => [m.player1_id,m.player2_id]))];
      const [preds,names] = await Promise.all([
        ids.length ? db.from('shart_shootout_predictions').select('shootout_id,player_id,home_score,away_score,first_goal_minute').in('shootout_id',ids).then(rows) : [],
        people.length ? db.from('profiles').select('id,username').in('id',people).then(rows) : []
      ]);
      if (version !== generation) return;
      identity = uid;
      model = ties.map(m => ({...m, admin, picks:preds.filter(p=>p.shootout_id===m.so?.id), name:id=>names.find(n=>n.id===id)?.username || 'Player'}));
      render();
    } catch (error) {
      console.error('Competition shootouts',error.message);
      const root = document.querySelector('[data-admin-panel]:not(.hidden)') || document.querySelector('#playerArea:not(.hidden) .screen:not(.hidden)');
      if (root && !root.querySelector('.shootout-error')) {
        const el=document.createElement('button'); el.className='secondary shootout-error'; el.textContent='Retry loading shootouts'; el.onclick=()=>{el.remove();refresh();}; root.prepend(el);
      }
    } finally { busy=false; if(pending){ pending=false; refresh(); } }
  }
  function field(label,name,type,value='',extra='') {
    return '<label class="field">'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
  }
  function scoreFields(s,pick,result) {
    const attrs='min="0" step="1" inputmode="numeric" required';
    return field(s.home_team,'h','number',pick?.home_score,attrs)+field(s.away_team,'a','number',pick?.away_score,attrs)+
      field(result?'Actual first goal (blank for 0–0)':'First-goal minute','minute','number',pick?.first_goal_minute,'min="1" max="120" step="1" inputmode="numeric" '+(result?'':'required'));
  }
  function card(m) {
    const s=m.so, locked=s && Date.now()>=Date.parse(s.cutoff_at);
    const pick=m.picks.find(p=>p.player_id===identity);
    let note='',fields='',action='',button='';
    if (s?.status==='walkover') note=esc(m.name(s.winner_id))+' advances by walkover.';
    else if (s?.status==='completed') note=esc(m.name(s.winner_id))+' advances. Final '+s.actual_home+'–'+s.actual_away+' · Shootout points '+s.player1_points+'–'+s.player2_points+(s.actual_first_goal_minute?' · First goal '+s.actual_first_goal_minute+'′':'');
    else if (!s || s.status!=='open') {
      note=s?.status==='review'?'Neither player submitted. Admin review required.':s?.status==='tied'?'Still tied. Another shootout is required.':'Waiting for the shootout fixture.';
      if(m.admin && m.is_tie){
        fields=field('Home team','home','text','','required maxlength="100"')+field('Away team','away','text','','required maxlength="100"')+field('Deadline (your local time)','deadline','datetime-local','','required');
        action='open';button=s?'Set replay fixture':'Set shootout fixture';
      }
    } else if (m.admin) {
      note=m.picks.length+' of 2 predictions received.';
      if(locked && m.picks.length===2){fields=scoreFields(s,null,true);action='result';button='Confirm result';}
      else if(locked) note+=' Checking the deadline outcome.';
    } else if(locked) note=pick?'Predictions locked. Your score '+pick.home_score+'–'+pick.away_score+' · first goal '+pick.first_goal_minute+'′.':'The deadline has passed.';
    else {
      note=pick?'Prediction saved. You can update it until the deadline.':'Predict the score and first-goal minute.';
      fields=scoreFields(s,pick,false);action='predict';button=pick?'Update prediction':'Save prediction';
    }
    return '<article><div class="kicker">'+cups[m.cup]+' · '+esc(m.stage)+' · Tie '+m.slot_no+'</div><h3>'+esc(m.name(m.player1_id))+' v '+esc(m.name(m.player2_id))+'</h3>'+
      (s?'<b>'+esc(s.home_team)+' v '+esc(s.away_team)+'</b><div class="muted">Attempt '+s.attempt_no+' · '+date(s.cutoff_at)+'</div>':'')+
      '<p>'+note+'</p>'+(action?'<form data-action="'+action+'" data-match="'+m.id+'">'+fields+'<button class="secondary" type="submit">'+button+'</button><span role="status" aria-live="polite"></span></form>':'')+'</article>';
  }
  function mount(root,items) {
    if(!root)return;
    let panel=root.querySelector(':scope > .cup-shootouts');
    if(!items.length){panel?.remove();return;}
    const html='<div class="kicker">Competition shootouts</div>'+items.map(card).join('');
    if(panel?.dataset.render===html)return;
    if(panel?.contains(document.activeElement) && panel.querySelector('form:focus-within'))return;
    if(!panel){panel=document.createElement('section');panel.className='card cup-shootouts';root.prepend(panel);}
    panel.dataset.render=html;panel.innerHTML=html;
  }
  function render() {
    for(const cup of Object.keys(cups)) for(const admin of [true,false]) {
      mount(rootFor(cup,admin),model.filter(m=>m.cup===cup && m.admin===admin));
    }
    mount(document.getElementById('playerHome'),model.filter(m=>!m.admin && m.is_tie && m.so?.status==='open'));
    for(const el of document.querySelectorAll('[data-chumpions-advance],[data-nohope-winner]')){
      const mid=el.dataset.chumpionsAdvance||el.dataset.nohopeMatch;
      const m=model.find(x=>x.id===mid);
      el.closest('.chumpions-admin-choice,.nohope-admin-decision')?.classList.toggle('shootout-managed',!!m?.is_tie && m.so?.status!=='review');
    }
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!form.closest('.cup-shootouts'))return;
    event.preventDefault();
    const m=model.find(x=>x.id===form.dataset.match);
    if(!m)return;
    const data=new FormData(form), action=form.dataset.action, button=form.querySelector('button'), status=form.querySelector('[role=status]');
    button.disabled=true;
    try {
      let response;
      if(action==='open') response=await db.rpc('admin_open_shootout',{c:m.cup,mid:m.id,home:data.get('home'),away:data.get('away'),deadline:new Date(data.get('deadline')).toISOString()});
      else {
        const h=Number(data.get('h')),a=Number(data.get('a')),minute=data.get('minute')===''?null:Number(data.get('minute'));
        response=action==='predict'?await db.rpc('submit_shart_shootout_prediction',{p_shootout_id:m.so.id,p_home_score:h,p_away_score:a,p_first_goal_minute:minute}):await db.rpc('admin_complete_shart_shootout',{p_shootout_id:m.so.id,p_actual_home:h,p_actual_away:a,p_actual_first_goal_minute:minute});
      }
      if(response.error)throw Error(response.error.message);
      status.textContent='Saved';document.activeElement?.blur();await refresh();
      if(action==='result') window.location.reload();
    } catch(error){status.textContent=error.message;} finally {button.disabled=false;}
  });
  db.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT' || (identity && identity!==session?.user?.id)) clear();
    if(session)setTimeout(refresh,100);
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-admin-tab],[data-player-tab]'))setTimeout(refresh,100);});
  new MutationObserver(()=>render()).observe(document.getElementById('appScreen'),{subtree:true,childList:true});
  new MutationObserver(()=>{if(!document.getElementById('appScreen').classList.contains('hidden')) refresh(); else clear();}).observe(document.getElementById('appScreen'),{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  refresh();
})();
