/* Super 6 v0.34.1 — read-only Admin competition round navigator with full fixture accordions.
   Keeps master fixtures/results in Supabase; no round mutation or score overrides.
   Works with dynamically mounted F-All/No-Hope-A panels. */
(function(){
  'use strict';
  const cups={
    chumpions:{title:'Chumpions League',groups:true,count:10,total:12,stages:['R16','QF','SF','F']},
    nohope:{title:'No-Hope-A League',groups:true,count:10,total:8,stages:['R16','QF','SF','F']},
    fall:{title:'F-All Cup',groups:false,count:15,total:7,stages:[]},
    shart:{title:'SHART',groups:false,count:0,total:0,stages:['R1','R32','R16','QF','SF','F']}
  };
  const labels={R1:'Round 1',R32:'Round of 32',R16:'Round of 16',QF:'Quarter-finals',SF:'Semi-finals',F:'Final'};
  const cache={};
  const selected={};
  const allOpen={},expanded={};
  const epochs={};
  const esc=v=>String(v===null||v===undefined?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const elem=(s,p=document)=>p.querySelector(s);
  const pair=m=>[String(m.player1_id||''),String(m.player2_id||'')].sort().join('|');
  const humanDate=x=>{
    if(!x)return '';
    const d=new Date(x);return isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(d);
  };
  const styles=[
    '.comp-round-card{min-width:0;border:1px solid #d3c49f}',
    '.comp-round-card .section-head{align-items:center;gap:10px}',
    '.comp-round-intro{font-size:12px;line-height:1.5;color:var(--muted)}',
    '.comp-round-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
    '.comp-round-refresh{font-size:11px;font-weight:800;border:1px solid #cabb9a;background:#f7efdb;color:var(--green);border-radius:9px;padding:9px 12px;cursor:pointer}',
    '.comp-round-refresh:disabled{opacity:.5}',
    '.comp-round-tabs{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-x:contain;max-width:100%;min-width:0;padding:6px 2px 12px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}',
    '.comp-round-tabs button{flex:0 0 auto;min-width:91px;max-width:138px;border:1px solid #cabf9f;border-radius:11px;padding:9px 10px;background:#f9f3e6;color:var(--green);text-align:left;cursor:pointer;line-height:1.2}',
    '.comp-round-tabs button strong{display:block;font-size:12px;white-space:nowrap}',
    '.comp-round-tabs button small{display:block;font-size:10px;color:#776e5b;margin-top:4px;white-space:nowrap}',
    '.comp-round-tabs button.active{background:var(--green);border-color:var(--green);color:#fff8e9;box-shadow:0 3px 9px #173f2a27}',
    '.comp-round-tabs button.active small{color:#e9dcc2}',
    '.comp-round-tabs button.needs-review:not(.active){border-color:#b76b34;background:#fff0df}',
    '.comp-round-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #e4dac4;padding:13px 0 11px}',
    '.comp-round-summary h4{margin:0;color:var(--green);font-size:17px}',
    '.comp-round-summary p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.45}',
    '.comp-round-progress{font-size:11px;font-weight:900;padding:6px 9px;border:1px solid #bfcbb7;border-radius:99px;background:#ecf3e8;color:#24472f;white-space:nowrap}',
    '.comp-round-progress.waiting{background:#eee9da;border-color:#ded3ba;color:#776e5b}',
    '.comp-round-progress.review{background:#fff0df;border-color:#e1b68e;color:#895026}',
    '.comp-round-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}',
    '.comp-round-group{min-width:0;overflow:hidden;border:1px solid #e0d5bb;border-radius:12px;background:#fffaf0}',
    '.comp-round-group h5{padding:10px 12px;margin:0;border-bottom:1px solid #e8dfc9;background:#f0e7d2;color:var(--green);font-size:12px}',
    '.comp-round-match{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid #ede4d3}',
    '.comp-round-match:last-child{border-bottom:0}',
    '.comp-round-name{font-size:12px;font-weight:800;min-width:0;overflow-wrap:anywhere;line-height:1.25}',
    '.comp-round-name.right{text-align:right}',
    '.comp-round-score{font-size:14px;font-weight:900;color:var(--green);white-space:nowrap}',
    '.comp-round-score.pending{font-size:10px;color:#817761}',
    '.comp-round-match.review{background:#fff0df}',
    '.comp-round-bye{padding:9px 12px;border-top:1px dashed #dbcbab;font-size:11px;color:#665d4b}',
    '.comp-round-empty{padding:16px;border-radius:10px;background:#f7efdc;color:#655b48;font-size:12px;line-height:1.5}',
    '.comp-round-empty strong{color:var(--green)}',
    '.comp-round-hint{font-size:11px;color:var(--muted);padding-top:12px}',
    '.comp-round-arrows{display:flex;gap:5px}',
    '.comp-round-arrows button{padding:6px 10px;border:1px solid #c5b795;border-radius:8px;background:#faf3e6;color:var(--green);cursor:pointer;font-size:16px}',
    '.comp-round-arrows button:disabled{opacity:.32;cursor:default}',
    '.comp-round-ready #adminFallBody>.fall-block:last-child{display:none}',
    '@media(max-width:700px){.comp-round-grid{grid-template-columns:minmax(0,1fr)}.comp-round-match{padding:10px 8px;gap:6px}.comp-round-name{font-size:11px}.comp-round-tabs button{min-width:88px}.comp-round-summary h4{font-size:15px}}'
  ].join('\n');

  function buildCard(cup){
    const panel=elem('[data-admin-panel="'+cup+'"]');
    if(!panel)return null;
    let card=elem('[data-comp-round-card]',panel);
    if(card)return card;
    const first=panel.querySelector('section.card');
    if(!first)return null;
    card=document.createElement('section');
    card.className='card comp-round-card';
    card.dataset.compRoundCard=cup;
    card.innerHTML='<div class="section-head"><div><div class="kicker">Round-by-round overview</div><h3>Fixtures & results</h3><div class="comp-round-intro">Choose a round to see every opponent, result and outstanding fixture.</div></div><div class="comp-round-actions"><button type="button" class="comp-round-refresh" data-comp-refresh>↻ Refresh</button></div></div><div class="comp-round-tabs" role="tablist" aria-label="'+esc(cups[cup].title)+' rounds"></div><div class="comp-round-body" aria-live="polite"><div class="muted">Loading rounds…</div></div>';
    first.insertAdjacentElement('afterend',card);
    card.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button)return;
      if(button.matches('[data-comp-refresh]')){loadCup(cup,true);return;}
      if(button.matches('[data-comp-round]')){
        selected[cup]=button.dataset.compRound;
        paint(cup);
        button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
        return;
      }
      if(button.matches('[data-comp-offset]')){
        const tabs=roundKeys(cup),old=Math.max(0,tabs.indexOf(selected[cup])),next=Math.max(0,Math.min(tabs.length-1,old+Number(button.dataset.compOffset)));
        selected[cup]=tabs[next];paint(cup);
        const newButton=elem('[data-comp-round="'+selected[cup]+'"]',card);
        if(newButton)newButton.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
      }
    });
    card.addEventListener('toggle',e=>{
      if(!card.contains(e.target))return;
      if(e.target.matches('[data-admin-full-cup]'))allOpen[cup]=e.target.open;
      if(e.target.matches('[data-admin-fixture-round]'))expanded[cup]=e.target.open?e.target.dataset.adminFixtureRound:'';
    },true);
    return card;
  }

  function roundKeys(cup){
    const cfg=cups[cup];
    return Array.from({length:cfg.count},(_,n)=>'G'+(n+1)).concat(cfg.stages);
  }
  function roundLabel(key){
    return key.charAt(0)==='G'?'Round '+key.slice(1):(labels[key]||key);
  }

  async function fetchState(cup){
    if(window.__SUPER6_BACKEND_READY)await window.__SUPER6_BACKEND_READY;
    const B=window.Super6Backend;
    if(!B||typeof B.client!=='function')throw Error('Supabase connection is not ready.');
    const sb=B.client();
    const ur=await sb.auth.getUser();
    if(ur.error)throw ur.error;
    if(!ur.data?.user)throw Error('Sign in as Admin to view the cup rounds.');
    const [pr,sr]=await Promise.all([
      sb.from('profiles').select('id,role').eq('id',ur.data.user.id).maybeSingle(),
      sb.from('seasons').select('id,status').eq('status','active').limit(1).maybeSingle()
    ]);
    if(pr.error)throw pr.error;
    if(pr.data?.role!=='admin')throw Error('Only Super 6 admins can view this page.');
    if(sr.error)throw sr.error;
    if(!sr.data?.id)return {players:[],rounds:[],schedule:[],matches:[],knockout:[],members:[],roundMap:new Map(),playerMap:new Map()};
    const season=sr.data.id;
    const requests=[
      sb.from('profiles').select('id,username').order('username'),
      sb.from('rounds').select('id,name,status,cutoff_at,completed_at').eq('season_id',season),
    ];
    if(cup==='chumpions'){
      requests.push(sb.from('chumpions_group_schedule').select('group_code,matchday,slot_no,player1_id,player2_id').eq('season_id',season).order('matchday').order('group_code').order('slot_no'));
      requests.push(sb.from('chumpions_matches').select('id,round_id,group_code,player1_id,player2_id,player1_score,player2_score,status,winner_id,is_draw').eq('season_id',season));
      requests.push(sb.from('chumpions_knockout_matches').select('id,round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status,winner_id').eq('season_id',season));
    }else if(cup==='nohope'){
      requests.push(sb.from('nohope_group_schedule').select('group_code,matchday,slot_no,player1_id,player2_id').eq('season_id',season).order('matchday').order('group_code').order('slot_no'));
      requests.push(sb.from('nohope_matches').select('id,round_id,group_code,matchday,slot_no,player1_id,player2_id,player1_score,player2_score,status,winner_id,is_draw').eq('season_id',season));
      requests.push(sb.from('nohope_knockout_matches').select('id,round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status,winner_id').eq('season_id',season));
      requests.push(sb.from('nohope_members').select('player_id,group_code').eq('season_id',season));
    }else if(cup==='fall'){
      requests.push(sb.from('fall_matches').select('id,round_id,round_name,matchday,slot_no,player1_id,player2_id,player1_score,player2_score,status').eq('season_id',season).order('matchday').order('slot_no'));
      requests.push(sb.from('fall_members').select('player_id').eq('season_id',season));
    }else{
      requests.push(sb.from('shart_matches').select('id,round_id,stage,slot_no,player1_id,player2_id,player1_score,player2_score,status,winner_id').eq('season_id',season));
    }
    const rs=await Promise.all(requests);
    rs.forEach(x=>{if(x.error)throw x.error;});
    const out={players:rs[0].data||[],rounds:rs[1].data||[],schedule:[],matches:[],knockout:[],members:[]};
    if(cup==='chumpions'||cup==='nohope'){
      out.schedule=rs[2].data||[];
      out.matches=rs[3].data||[];
      out.knockout=rs[4].data||[];
      if(cup==='nohope')out.members=rs[5].data||[];
    }else if(cup==='fall'){out.matches=rs[2].data||[];out.members=rs[3].data||[];}
    else out.knockout=rs[2].data||[];
    out.roundMap=new Map(out.rounds.map(r=>[String(r.id),r]));
    out.playerMap=new Map(out.players.map(p=>[String(p.id),p.username]));
    if(cup==='chumpions'){
      const ids=[...new Set(out.matches.map(x=>String(x.round_id)).filter(x=>x&&x!=='null'))];
      ids.sort((a,b)=>{
        const ra=out.roundMap.get(a),rb=out.roundMap.get(b);
        return String(ra?.cutoff_at||'').localeCompare(String(rb?.cutoff_at||''));
      });
      out.assigned=ids;
    }
    return out;
  }

  function games(cup,key){
    const state=cache[cup];if(!state)return [];
    if(key.charAt(0)!=='G' || cup==='shart'){
      return [...state.knockout.filter(m=>m.stage===key)].sort((a,b)=>(a.slot_no||0)-(b.slot_no||0));
    }
    const day=Number(key.slice(1));
    if(cup==='fall')return state.matches.filter(m=>Number(m.matchday)===day);
    if(cup==='nohope'){
      return state.schedule.filter(m=>Number(m.matchday)===day).map(schedule=>{
        const current=state.matches.find(m=>Number(m.matchday)===day&&m.group_code===schedule.group_code&&m.slot_no===schedule.slot_no);
        return {...schedule,...(current||{}),group_code:schedule.group_code,slot_no:schedule.slot_no};
      });
    }
    const round=state.assigned?.[day-1];
    return state.schedule.filter(m=>Number(m.matchday)===day).map(schedule=>{
      const current=round&&state.matches.find(m=>String(m.round_id)===String(round)&&m.group_code===schedule.group_code&&pair(m)===pair(schedule));
      return {...schedule,...(current||{}),group_code:schedule.group_code,slot_no:schedule.slot_no};
    });
  }

  function progress(cup,key){
    const gg=games(cup,key);
    const finished=gg.filter(m=>m.status==='completed').length;
    const review=gg.filter(m=>m.status==='review'||m.status==='shootout').length;
    const total=gg.length;
    const planned=cups[cup].total;
    return {finished,review,total,planned};
  }
  function activeRound(cup,key){
    const state=cache[cup];const gg=games(cup,key);
    if(cup==='chumpions' && key.charAt(0)==='G'){
      const round=state.assigned?.[Number(key.slice(1))-1];return state.roundMap.get(String(round))||null;
    }
    const first=gg.find(m=>m.round_id)?.round_id;
    return state.roundMap.get(String(first))||null;
  }
  function defaultRound(cup){
    let last=null;
    for(const key of roundKeys(cup))if(progress(cup,key).finished>0)last=key;
    if(last)return last;
    const inPlay=roundKeys(cup).find(key=>games(cup,key).some(m=>m.status==='scheduled'||m.status==='review'||m.status==='shootout'));
    return inPlay||roundKeys(cup)[0];
  }
  function gameHTML(cup,m){
    const state=cache[cup],p1=state.playerMap.get(String(m.player1_id))||'TBD',p2=state.playerMap.get(String(m.player2_id))||'TBD';
    const finished=m.status==='completed'&&m.player1_score!==null&&m.player1_score!==undefined&&m.player2_score!==null&&m.player2_score!==undefined;
    const score=finished?esc(m.player1_score)+' – '+esc(m.player2_score):'vs';
    const status=m.status==='review'||m.status==='shootout';
    const title=finished?'Result: '+p1+' '+score+' '+p2:status?'Needs admin review':'Not yet played';
    return '<div class="comp-round-match'+(status?' review':'')+'" title="'+esc(title)+'"><span class="comp-round-name">'+esc(p1)+'</span><span class="comp-round-score'+(finished?'':' pending')+'">'+(status?'Review':score)+'</span><span class="comp-round-name right">'+esc(p2)+'</span></div>';
  }
  function byeFor(cup,group,fixtures){
    const state=cache[cup],members=state.members||[];
    const entered=members.filter(m=>cup==='fall'||m.group_code===group).map(m=>String(m.player_id));
    const appearing=new Set(fixtures.flatMap(m=>[String(m.player1_id),String(m.player2_id)]));
    const byes=entered.filter(id=>!appearing.has(id));
    return byes.length?'<div class="comp-round-bye"><b>Bye:</b> '+byes.map(id=>esc(state.playerMap.get(id)||'Player')).join(', ')+'</div>':'';
  }
  function content(cup,key){
    const state=cache[cup],gg=games(cup,key),details=progress(cup,key),related=activeRound(cup,key);
    const title=roundLabel(key),preview=key.charAt(0)==='G'?cups[cup].total:0;
    const subtitle=related?'<b>Super 6:</b> '+esc(related.name)+(related.cutoff_at?' · '+esc(humanDate(related.cutoff_at)):''):'Awaiting assignment to a Super 6 week';
    const status=details.review?'Needs review':details.total&&details.finished===details.total?'Complete':details.finished?'In progress':related?'Scheduled':'Not started';
    const style=details.review?'review':details.finished===details.total&&details.total?'':'waiting';
    let body='';
    if(!gg.length){
      body='<div class="comp-round-empty"><strong>'+esc(title)+' is not drawn yet.</strong><div>'+(cup==='shart'?'The SHART draw can be generated when the competition starts.':'Fixtures will appear when this stage is ready.')+'</div></div>';
    }else if(cups[cup].groups&&key.charAt(0)==='G'){
      body='<div class="comp-round-grid">'+['A','B','C','D'].map(g=>{
        const gm=gg.filter(m=>m.group_code===g).sort((a,b)=>(a.slot_no||0)-(b.slot_no||0));
        return '<div class="comp-round-group"><h5>Group '+g+' · '+gm.filter(m=>m.status==='completed').length+'/'+gm.length+' completed</h5>'+gm.map(m=>gameHTML(cup,m)).join('')+byeFor(cup,g,gm)+'</div>';
      }).join('')+'</div>';
    }else{
      body='<div class="comp-round-grid">'+[0,1].map(parity=>{
        const side=gg.filter((m,i)=>i%2===parity);
        return '<div class="comp-round-group"><h5>'+(cup==='fall'?'Fixtures':title)+' · '+(parity===0?'A':'B')+'</h5>'+(side.length?side.map(m=>gameHTML(cup,m)).join(''):'<div class="comp-round-bye">No further ties</div>')+'</div>';
      }).join('')+'</div>'+(cup==='fall'?byeFor(cup,null,gg):'');
    }
    const hint=cup==='fall'?'7 matches per round · one player has a bye.':'These tabs are an overview. Use the existing competition controls below to manage qualification and results.';
    return '<div class="comp-round-summary"><div><h4>'+esc(title)+'</h4><p>'+subtitle+'</p></div><div class="comp-round-actions"><span class="comp-round-progress '+style+'">'+(details.total?details.finished+'/'+details.total+' · ':'')+esc(status)+'</span><div class="comp-round-arrows"><button type="button" data-comp-offset="-1" aria-label="Previous round">‹</button><button type="button" data-comp-offset="1" aria-label="Next round">›</button></div></div></div>'+body+'<div class="comp-round-hint">'+esc(hint)+'</div>';
  }


  // Match the F-All full-round accordion on other Admin cup pages.
  // This is an additional read-only view of the existing Supabase schedule.
  function fullSeasonHTML(cup){
    const keys=roundKeys(cup),short=cup==='shart'?'Every knockout stage':'All 10 group rounds and knockouts';
    const roundHTML=keys.map(key=>{
      const rows=games(cup,key),p=progress(cup,key),stage=key.charAt(0)!=='G';
      if(stage&&!rows.length&&cup!=='shart')return '';
      const complete=p.total&&p.finished===p.total;
      const status=p.review?'Review needed':complete?'Complete':p.finished?'In progress':rows.length?'Upcoming':'Not drawn';
      let fixtures='';
      if(!rows.length){
        fixtures='<div class="comp-round-empty">Fixtures will appear once this stage is drawn.</div>';
      }else if(!stage&&cups[cup].groups){
        fixtures='<div class="comp-round-grid">'+['A','B','C','D'].map(g=>{
          const matches=rows.filter(m=>m.group_code===g);
          return '<div class="comp-round-group"><h5>Group '+g+'</h5>'+
            matches.map(m=>gameHTML(cup,m)).join('')+byeFor(cup,g,matches)+'</div>';
        }).join('')+'</div>';
      }else{
        fixtures='<div class="comp-round-group">'+rows.map(m=>gameHTML(cup,m)).join('')+'</div>';
      }
      const defaultKey=cup==='shart'?'R1':(() =>{
        for(let i=1;i<=10;i++){
          if(progress(cup,'G'+i).finished<cups[cup].total)return 'G'+i;
        }
        return 'G10';
      })();
      const open=(expanded[cup]===undefined?defaultKey:expanded[cup])===key;
      return '<details class="fall-round" data-admin-fixture-round="'+esc(key)+'"'+(open?' open':'')+'>'+
        '<summary><span>'+esc(roundLabel(key))+'</span><small>'+esc(status)+' · '+p.finished+'/'+p.total+'</small></summary>'+
        '<div class="cup-full-round-content">'+fixtures+'</div></details>';
    }).join('');
    return '<details class="cup-all-fixtures admin-full-cup" data-admin-full-cup'+(allOpen[cup]?' open':'')+'>'+
      '<summary><span><b>View all fixtures</b><small>'+esc(short)+' · full season view</small></span><span class="cup-full-count">'+(cup==='shart'?'SHART draw':'10 rounds')+' <span aria-hidden="true">⌄</span></span></summary>'+
      '<div class="cup-full-body"><p class="cup-full-intro">Expand a round for fixtures and played results. Unplayed matches do not have scores.</p>'+
      '<div class="fall-rounds cup-full-rounds">'+roundHTML+'</div></div></details>';
  }

  function paint(cup){
    const card=buildCard(cup),state=cache[cup];if(!card||!state)return;
    const keys=roundKeys(cup);
    if(!selected[cup]||!keys.includes(selected[cup]))selected[cup]=defaultRound(cup);
    const selectedKey=selected[cup],list=elem('.comp-round-tabs',card),body=elem('.comp-round-body',card);
    list.innerHTML=keys.map(key=>{
      const p=progress(cup,key);
      const tiny=p.total?p.finished+'/'+p.total:(key.charAt(0)==='G'?'Waiting':'Not drawn');
      const active=selectedKey===key;
      return '<button type="button" role="tab" data-comp-round="'+esc(key)+'" aria-selected="'+active+'" class="'+(active?'active ':'')+(p.review?'needs-review':'')+'"><strong>'+esc(roundLabel(key))+'</strong><small>'+(p.review?'Review needed':p.total&&p.finished===p.total?'✓ Complete':tiny)+'</small></button>';
    }).join('');
    body.innerHTML=content(cup,selectedKey)+(cup==='fall'?'':fullSeasonHTML(cup));
    const prev=elem('[data-comp-offset="-1"]',body),next=elem('[data-comp-offset="1"]',body),index=keys.indexOf(selectedKey);
    if(prev)prev.disabled=index===0;
    if(next)next.disabled=index===keys.length-1;
    const panel=card.closest('[data-admin-panel]');
    if(cup==='fall')panel?.classList.add('comp-round-ready');
  }

  async function loadCup(cup,force){
    if(!cups[cup])return;
    const panel=elem('[data-admin-panel="'+cup+'"]'),admin=elem('#adminArea');
    if(!panel||!admin||admin.classList.contains('hidden')||panel.classList.contains('hidden'))return;
    const card=buildCard(cup);if(!card)return;
    if(cache[cup]&&!force){paint(cup);return;}
    const token=epochs[cup]=(epochs[cup]||0)+1;
    const btn=elem('[data-comp-refresh]',card);
    if(btn)btn.disabled=true;
    elem('.comp-round-body',card).innerHTML='<div class="muted">Loading fixtures & results…</div>';
    try{
      const data=await fetchState(cup);
      if(epochs[cup]!==token)return;
      cache[cup]=data;
      paint(cup);
    }catch(err){
      if(epochs[cup]!==token)return;
      elem('.comp-round-body',card).innerHTML='<div class="comp-round-empty"><strong>Unable to load rounds.</strong><div>'+esc(err.message||err)+'</div></div>';
    }finally{
      if(epochs[cup]===token&&btn)btn.disabled=false;
    }
  }

  function activeCup(){
    if(elem('#adminArea')?.classList.contains('hidden'))return null;
    const panel=elem('#adminArea [data-admin-panel]:not(.hidden)');
    return cups[panel?.dataset.adminPanel]?panel.dataset.adminPanel:null;
  }

  function boot(){
    if(!elem('#adminArea'))return;
    const css=document.createElement('style');css.dataset.compRoundStyle='1';css.textContent=styles;document.head.appendChild(css);
    document.addEventListener('click',e=>{
      const tab=e.target.closest('#adminTabs [data-admin-tab]');if(!tab||!cups[tab.dataset.adminTab])return;
      const cup=tab.dataset.adminTab;
      Promise.resolve().then(()=>loadCup(cup,true));
    },true);
    const admin=elem('#adminArea');
    const obs=new MutationObserver(()=>{const cup=activeCup();if(cup)loadCup(cup,true);});
    obs.observe(admin,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){const cup=activeCup();if(cup)loadCup(cup,true);}});
    const cup=activeCup();if(cup)loadCup(cup,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
