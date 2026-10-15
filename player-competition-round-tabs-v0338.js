/* Super 6 v0.33.8 — player-side past and future Chumpions / No-Hope-A rounds.
   Displays Dayle's stored season schedule, without edits or unplayed score predictions. */
(async function(){
  'use strict';
  if(window.__SUPER6_BACKEND_READY)await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function')return;
  const sb=B.client();
  const configs={
    chumpions:{title:'Chumpions League',label:'Chumpions',prefix:'chumpions',number:10,per:12},
    nohope:{title:'No-Hope-A League',label:'No-Hope-A',prefix:'nohope',number:10,per:8}
  };
  const groupLetters=['A','B','C','D'];
  const stages=['R16','QF','SF','F'];
  const stageNames={R16:'Round of 16',QF:'Quarter-finals',SF:'Semi-finals',F:'Final'};
  const store={},current={};
  const escaping={ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>escaping[c]);
  const safeId=x=>String(x||'');
  const pair=x=>[safeId(x.player1_id),safeId(x.player2_id)].sort().join('|');
  const $=s=>document.querySelector(s);
  const shown=c=>!$('#playerArea')?.classList.contains('hidden')&&!$('#player'+(c==='chumpions'?'Chumpions':'Nohope'))?.classList.contains('hidden');
  const section=c=>document.querySelector(c==='chumpions'?'#playerChumpionsBody':'#playerNohopeBody');
  const keys=()=>Array.from({length:10},(_,n)=>'R'+(n+1)).concat(stages);
  const keyLabel=k=>stageNames[k]||('Round '+k.slice(1));
  let userId=null,loading=null;
  const dateLabel=iso=>{
    if(!iso)return '';
    const dt=new Date(iso);if(isNaN(dt.getTime()))return '';
    return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(dt);
  };

  async function fetchState(c,force=false){
    const previous=store[c];
    if(previous&&!force)return previous;
    const conf=configs[c];
    const res=await Promise.all([
      sb.auth.getUser(),
      sb.from('seasons').select('id').eq('status','active').limit(1).maybeSingle()
    ]);
    for(const r of res)if(r.error)throw r.error;
    userId=res[0].data?.user?.id||null;
    if(!userId)throw Error('Sign in to view the competition fixtures.');
    const season=res[1].data?.id;
    if(!season)throw Error('No active Super 6 season.');
    const ps=[
      sb.from('profiles').select('id,username').order('username'),
      sb.from('rounds').select('id,name,cutoff_at,status').eq('season_id',season).order('cutoff_at'),
      sb.from(conf.prefix+'_members').select('player_id,group_code').eq('season_id',season),
      sb.from(conf.prefix+'_group_schedule').select('group_code,matchday,slot_no,player1_id,player2_id').eq('season_id',season).order('matchday').order('group_code').order('slot_no'),
      sb.from(conf.prefix+'_matches').select(c==='chumpions'?'id,round_id,group_code,player1_id,player2_id,player1_score,player2_score,status':'id,round_id,group_code,matchday,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',season),
      sb.from(conf.prefix+'_knockout_matches').select('id,round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',season)
    ];
    const results=await Promise.all(ps);
    for(const r of results)if(r.error)throw r.error;
    const [players,rounds,members,schedule,matches,knockout]=results.map(r=>r.data||[]);
    const map=new Map(players.map(x=>[safeId(x.id),x.username]));
    const roundMap=new Map(rounds.map(x=>[safeId(x.id),x]));
    const assigned=[...new Set(matches.map(m=>safeId(m.round_id)).filter(Boolean))];
    assigned.sort((a,b)=>String(roundMap.get(a)?.cutoff_at||'').localeCompare(String(roundMap.get(b)?.cutoff_at||'')));
    const mine=members.find(x=>safeId(x.player_id)===userId)?.group_code||'all';
    const result={players,rounds,members,schedule,matches,knockout,map,roundMap,assigned,mine};
    store[c]=result;
    return result;
  }

  function gameSet(c,key){
    const s=store[c];if(!s)return [];
    if(stages.includes(key))return s.knockout.filter(x=>x.stage===key).sort((a,b)=>Number(a.slot_no)-Number(b.slot_no));
    const day=Number(key.slice(1));
    const selected=s.schedule.filter(x=>Number(x.matchday)===day);
    return selected.map(x=>{
      const found=c==='nohope'?
        s.matches.find(m=>Number(m.matchday)===day&&m.group_code===x.group_code&&Number(m.slot_no)===Number(x.slot_no)):
        s.matches.find(m=>safeId(m.round_id)===safeId(s.assigned[day-1])&&m.group_code===x.group_code&&pair(m)===pair(x));
      return {...x,...(found||{}),matchday:day,group_code:x.group_code,slot_no:x.slot_no};
    });
  }
  function roundRecord(c,key){
    const s=store[c];if(!s)return null;
    const game=gameSet(c,key).find(x=>x.round_id);
    const id=game?.round_id||(c==='chumpions'&&!stages.includes(key)?s.assigned[Number(key.slice(1))-1]:null);
    return s.roundMap.get(safeId(id))||null;
  }
  function progress(c,key){
    const game=gameSet(c,key);
    return {total:game.length,completed:game.filter(x=>x.status==='completed').length,
      review:game.filter(x=>x.status==='review').length};
  }
  function defaultKey(c){
    // Open on the latest actual results, not a future empty fixture list.
    // Players can move forward to see their next opponent.
    const activeKnockout=stages.find(k=>{
      const p=progress(c,k);
      return p.total>0&&p.completed<p.total;
    });
    if(activeKnockout)return activeKnockout;
    let latestPlayed=null;
    for(let n=1;n<=10;n++){
      if(progress(c,'R'+n).completed>0)latestPlayed='R'+n;
    }
    return latestPlayed||'R1';
  }
  function gameHTML(s,match){
    const p1=s.map.get(safeId(match.player1_id))||'To be confirmed';
    const p2=s.map.get(safeId(match.player2_id))||'To be confirmed';
    const mine=userId&&(safeId(match.player1_id)===userId||safeId(match.player2_id)===userId);
    const done=match.status==='completed'&&match.player1_score!=null&&match.player2_score!=null;
    const score=done?match.player1_score+' – '+match.player2_score:'vs';
    return '<div class="cup-round-game'+(mine?' mine':'')+'"><span class="team">'+esc(p1)+'</span><strong class="score'+(done?'':' future')+'">'+esc(score)+'</strong><span class="team">'+esc(p2)+'</span></div>';
  }
  function groupHTML(c,g,allGames){
    const s=store[c],gm=allGames.filter(m=>m.group_code===g);
    const done=gm.filter(m=>m.status==='completed').length;
    const participants=s.members.filter(x=>x.group_code===g).map(x=>safeId(x.player_id));
    const inGames=new Set(gm.flatMap(x=>[safeId(x.player1_id),safeId(x.player2_id)]));
    const byes=participants.filter(x=>!inGames.has(x));
    return '<article class="cup-round-group"><h4>Group '+g+'<span>'+done+'/'+gm.length+' played</span></h4>'+
      (gm.length?gm.map(m=>gameHTML(s,m)).join(''):'<div class="cup-round-empty">Fixtures not assigned yet.</div>')+
      (byes.length&&gm.length?'<div class="cup-round-bye">Bye: '+byes.map(id=>esc(s.map.get(id)||'Player')).join(', ')+'</div>':'')+
      '</article>';
  }
  function panelHTML(c){
    const state=store[c],sel=current[c]||{},key=sel.round||defaultKey(c);
    const thisWeek=gameSet(c,key),stats=progress(c,key),related=roundRecord(c,key);
    const filter=sel.group||state.mine;
    const groupOptions=[{id:'all',name:'All groups'},...groupLetters.map(g=>({id:g,name:'Group '+g}))];
    const show=filter==='all'?groupLetters:[filter];
    const status=stats.total&&stats.completed===stats.total?'Complete':stats.completed?'In progress':'Upcoming';
    const meta=related?(' · '+esc(related.name)+' · '+esc(dateLabel(related.cutoff_at))):' · Date to be confirmed';
    const tabs=keys().map(k=>{
      const p=progress(c,k),active=k===key;
      const short=p.total&&p.completed===p.total?'✓ Played':p.total&&p.completed?'Part played':p.total?'Upcoming':'Not drawn';
      return '<button type="button" class="'+(active?'active':'')+'" data-player-round="'+esc(k)+'" aria-pressed="'+active+'"><b>'+esc(keyLabel(k))+'</b><small>'+esc(short)+'</small></button>';
    }).join('');
    let content='';
    if(!thisWeek.length){
      content='<div class="cup-round-empty">This knockout round is waiting for the previous stage to finish. The fixtures will appear here when it is drawn.</div>';
    }else if(stages.includes(key)){
      content='<div class="cup-round-fixtures"><article class="cup-round-group"><h4>'+esc(keyLabel(key))+'<span>'+stats.completed+'/'+stats.total+' played</span></h4>'+thisWeek.map(m=>gameHTML(state,m)).join('')+'</article></div>';
    }else content='<div class="cup-round-fixtures">'+show.map(g=>groupHTML(c,g,thisWeek)).join('')+'</div>';
    return '<div class="kicker">Season fixtures</div><h3>Previous & upcoming rounds</h3><div class="cup-round-help">Tap any round to review results or see who plays next. Completed results come from Super 6; future matches show no scores.</div>'+
      '<div class="cup-round-nav" aria-label="'+esc(configs[c].title)+' rounds">'+tabs+'</div>'+
      '<div class="cup-round-meta"><div><strong>'+esc(keyLabel(key))+' · '+esc(status)+'</strong><small>'+esc(stats.completed)+' of '+esc(stats.total)+' ties completed'+meta+'</small></div>'+
      (!stages.includes(key)?'<div class="cup-group-filter"><label for="player-cup-filter-'+c+'">Group</label><select id="player-cup-filter-'+c+'" data-player-group="'+c+'">'+groupOptions.map(o=>'<option value="'+esc(o.id)+'"'+(o.id===filter?' selected':'')+'>'+esc(o.name)+'</option>').join('')+'</select></div>':'')+'</div>'+
      content+
      '<div class="cup-round-status">Scoring: <strong>3 league points for a win · 1 for a draw.</strong> Future fixtures may move if the Admin corrects a draw.</div>';
  }
  function mount(c){
    if(!shown(c))return;
    const host=section(c);if(!host)return;
    let block=host.querySelector('[data-player-cup-rounds="'+c+'"]');
    if(!block){
      block=document.createElement('section');
      block.className='player-cup-rounds';
      block.dataset.playerCupRounds=c;
      block.innerHTML='<div class="muted">Loading previous & upcoming rounds…</div>';
      // Keep completed and upcoming fixtures visible above the lengthy
      // standings and knockout tables, especially on an iPhone.
      const firstTable=host.querySelector('.nohope-block,.chumpions-block,.chumpions-groups,.chumpions-latest,.chumpions-bracket');
      host.insertBefore(block,firstTable||host.firstChild);
      block.addEventListener('click',e=>{
        const btn=e.target.closest('[data-player-round]');
        if(btn){current[c]=current[c]||{};current[c].round=btn.dataset.playerRound;paint(c,true);return;}
      });
      block.addEventListener('change',e=>{
        if(e.target.matches('[data-player-group]')){current[c]=current[c]||{};current[c].group=e.target.value;paint(c,false);}
      });
    }
    // Paint only when creating a new widget. Painting an existing widget
    // from a MutationObserver would create an infinite render loop.
    if(block.dataset.playerCupInitialized!=='1'){
      block.dataset.playerCupInitialized='1';
      if(store[c])paint(c,false);
      else if(!loading||loading.c!==c)load(c,false);
    }
  }
  function paint(c,scrollToSelected=false){
    const host=section(c),target=host?.querySelector('[data-player-cup-rounds="'+c+'"]');
    if(!target||!store[c])return;
    const previous=target.querySelector('.cup-round-nav')?.scrollLeft||0;
    target.innerHTML=panelHTML(c);
    const tabs=target.querySelector('.cup-round-nav');
    if(tabs)tabs.scrollLeft=previous;
    if(scrollToSelected){
      const selected=target.querySelector('.cup-round-nav button.active');
      selected?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }
  async function load(c,force){
    if(!shown(c))return;
    if(loading&&loading.c===c)return loading.promise;
    const runner=(async()=>{
      const host=section(c);
      const target=host?.querySelector('[data-player-cup-rounds="'+c+'"]');
      if(target&&!store[c])target.innerHTML='<div class="muted">Loading fixtures…</div>';
      try{
        await fetchState(c,force);
        paint(c);
      }catch(e){
        if(target)target.innerHTML='<div class="cup-round-empty">Could not load '+esc(configs[c].label)+' rounds: '+esc(e.message||e)+'. Please try opening the competition again.</div>';
      }
    })();
    loading={c,promise:runner};
    try{await runner}finally{if(loading?.promise===runner)loading=null;}
  }
  function boot(){
    const area=$('#playerArea');if(!area)return;
    let scheduled=false;
    const scheduleMount=()=>{
      if(scheduled)return;scheduled=true;
      queueMicrotask(()=>{scheduled=false;for(const c of Object.keys(configs))mount(c);});
    };
    const observer=new MutationObserver(scheduleMount);
    observer.observe(area,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-player-tab="chumpions"],[data-player-tab="nohope"]');
      if(nav)queueMicrotask(()=>{const c=nav.dataset.playerTab;mount(c);load(c,true);});
    },true);
    window.addEventListener('focus',()=>{
      for(const c of Object.keys(configs))if(shown(c))load(c,true);
    });
    scheduleMount();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();