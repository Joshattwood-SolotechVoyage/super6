(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const STORAGE='super6_v03_state';
const DEFAULT_PAYMENT_URL='https://monzo.me/daylehodge/6.00?h=GgbX1T&d=Super%206&account_type=personal';
const nowPlus=(h)=>{const d=new Date();d.setHours(d.getHours()+h);return d.toISOString()};
const initialLeagues=[
 {id:'serie',name:'The Serie-As League'},
 {id:'tramp',name:'The Trampionship'},
 {id:'major',name:'Major Losers Syndicate'}
];
const seedPlayers=[
 ['Gavin Staplehurst','serie',42,0,4,11,5,0],['Kye Machin','serie',40,1,4,10,5,0],['Darren Hodge','serie',38,0,2,14,5,0],['Stuart Dawes','serie',37,0,3,11,5,0],['Harry Salmon','serie',36,1,2,13,5,0],['Matt Bezer','serie',36,0,2,13,5,0],['Dayle Hodge','serie',36,1,2,13,5,0],['Adam Cohen','serie',35,1,3,10,5,0],['Dean Kilford','serie',35,1,3,10,5,1],['Scott Dukes','serie',34,1,2,12,5,0],['Matt Smith','serie',34,0,2,12,5,0],['Nick Plumridge','serie',34,0,2,12,5,0],['Ross Dawes','serie',33,0,1,14,5,0],['Dan Wallage','serie',33,0,3,9,5,0],['Luke Street','serie',32,1,2,11,5,0],['Duncan Waugh','serie',32,0,2,11,5,0],['Gavin Cunningham','serie',29,0,1,12,5,1],['Rob Waugh','serie',28,0,2,9,5,0],['Simon Rees','serie',24,0,0,12,5,1],['Joseph Wailes','serie',22,0,0,11,4,0],
 ['Ben Clare','tramp',56,1,6,13,5,0],['Tom Cohen','tramp',50,2,6,10,5,0],['Freddy Marlow','tramp',49,2,5,12,5,0],['Neil Bligh','tramp',47,0,5,11,5,0],['Gary Willoughby','tramp',45,1,5,10,5,0],['Sam Finlay','tramp',42,0,4,11,5,0],['Burnley','tramp',41,0,3,13,5,0],['Dan Hodge','tramp',40,1,4,10,5,0],['Sion Lloyd','tramp',40,0,4,10,5,0],['Paul Saunders','tramp',34,0,2,12,5,0],['Danny Colligan','tramp',34,0,2,12,5,0],['Neil Pizzey','tramp',34,0,2,12,5,1],['Adam Philpott','tramp',32,0,2,11,5,0],['Tim Newman','tramp',31,0,3,8,5,1],['Jake Willson','tramp',30,0,2,10,5,0],['Dan Pizzey','tramp',30,0,2,10,5,0],['Andrew Carter','tramp',28,0,2,9,5,1],['Darren Bailey','tramp',27,0,1,11,5,1],['David Hopkin','tramp',25,0,1,10,5,0],['Jez Hodge','tramp',24,0,0,12,5,0],
 ['Ashley Pollitt','major',46,0,4,13,5,0],['Josh Attwood','major',45,1,3,15,5,0],['Robbie Gibson','major',39,0,3,12,5,0],['Matt Hobbs','major',39,1,3,12,5,0],['Haydan Finlay','major',36,0,2,13,5,0],['Simon Martin','major',35,0,3,10,5,0],['Jack Pizzey','major',34,0,2,12,5,0],['Mikey Waugh','major',34,0,0,17,5,0],['Jonny Phillips','major',32,1,4,6,4,0],['Robbie Upton','major',31,1,1,13,5,0],['Jack Robinson','major',30,0,2,10,5,0],['Reece Duncan','major',30,0,2,10,5,0],['Dave Chesham','major',29,0,1,12,5,0],['Andy Chawe','major',28,1,2,9,5,1],['Dan O’Sullivan','major',26,0,2,8,5,0],['Jacob Clarke','major',26,0,0,13,5,0],['Brian McCann','major',22,0,0,11,4,0],['James Preston','major',21,0,1,8,3,0],['Zach Owen','major',12,0,0,6,4,0]
].map((p,i)=>({id:'p'+i,name:p[0],leagueId:p[1],points:p[2],wins:p[3],exact:p[4],correct:p[5],played:p[6],spoons:p[7]}));
function defaultState(){
 const deadline=new Date();deadline.setDate(deadline.getDate()+2);deadline.setHours(12,0,0,0);
 return {leagues:structuredClone(initialLeagues),players:structuredClone(seedPlayers),admins:[{name:'Admin'},{name:'Admin 2'}],round:{id:'r6',name:'Round 6',cutoff:deadline.toISOString(),fee:6,fixtures:[['Bournemouth','Brentford'],['Aston Villa','Nottingham Forest'],['Chelsea','Hull'],['Crystal Palace','Ipswich'],['Liverpool','Fulham'],['Manchester United','Manchester City']].map((x,i)=>({id:'f'+i,home:x[0],away:x[1],removed:false,result:null})),officialMinute:null,completed:false,completedAt:null,audit:[]},entries:{},history:[]};
}
let state=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE))||defaultState()}catch{return defaultState()}})();
let session={role:null,userId:null};let activeLeague=state.leagues[0]?.id;let activeAdminLeague=state.leagues[0]?.id;let activeAdminTab='overview';let timer=null;let playerDraft=null;let accountManagerLoad=0;
let liveStandings=[];
let liveWeeklyResults=[];
let latestLeagueAwards=[];
let latestLeagueAwardRound=null;
let latestPublishedWeek={round:null,predictions:[]};
let liveRoundExists=false;
let publishedLeaguePredictions=[];
let publishedPredictionRoundId=null;
let publishedPredictionsError='';
let adminRoundOverview={leagues:[],players:[]};
let adminOverviewLastFetch=0;
let adminOverviewFetching=false;
let appSettings={default_entry_fee:6,payment_grace_hours:12,payment_url:DEFAULT_PAYMENT_URL};
let chumpionsState={season:null,members:[],matches:[],players:[],rounds:[],competition:null,finalists:[],knockoutMatches:[]};
let chumpionsError='';
function cleanRoundDraft(){
 return {id:null,name:'',cutoff:'',fee:6,fixtures:Array.from({length:6},(_,i)=>({id:null,home:'',away:'',removed:false,result:null,sortOrder:i+1})),officialMinute:null,completed:false,completedAt:null,chumpionsLeague:false,audit:[]};
}
function mapLiveRound(row){
 if(!row)return cleanRoundDraft();
 return {
  id:row.id,
  name:row.name,
  cutoff:row.cutoff_at,
  fee:Number(row.entry_fee||6),
  fixtures:(row.fixtures||[]).map(f=>({id:f.id,home:f.home_team,away:f.away_team,removed:Boolean(f.removed),result:(f.home_score==null||f.away_score==null)?null:[f.home_score,f.away_score],sortOrder:f.sort_order})),
  officialMinute:row.official_first_goal_minute??null,
  completed:row.status==='completed',
  completedAt:row.completed_at||null,
  chumpionsLeague:Boolean(row.chumpions_league),
  audit:[]
 };
}
async function refreshLiveRound(){
 const previousId=state.round?.id||null;
 const row=await window.Super6Backend.loadCurrentRound();
 liveRoundExists=Boolean(row);
 state.round=mapLiveRound(row);
 if(!row||previousId!==state.round.id){state.entries={};publishedLeaguePredictions=[];publishedPredictionRoundId=null;publishedPredictionsError='';}
 playerDraft=null;
 save();
 return state.round;
}
async function refreshAppSettings(){
 try{
  const loaded=await window.Super6Backend.loadAppSettings();
  appSettings={
   default_entry_fee:Number(loaded?.default_entry_fee??6),
   payment_grace_hours:Number(loaded?.payment_grace_hours??12),
   payment_url:String(loaded?.payment_url||DEFAULT_PAYMENT_URL).trim()
  };
 }catch(err){
  console.warn('Could not load app settings',err);
  appSettings={default_entry_fee:6,payment_grace_hours:12,payment_url:DEFAULT_PAYMENT_URL};
 }
 return appSettings;
}
async function refreshMyLiveEntry(){
 if(session.role!=='player')return null;
 const p=currentUser();
 if(!p)return null;
 if(!liveRoundExists||!state.round?.id){
  state.entries[p.id]=entryFor(p.id);
  playerDraft=null;
  save();
  return null;
 }
 const live=await window.Super6Backend.loadMyRoundEntry(state.round.id);
 const byFixture=new Map((live.predictions||[]).map(x=>[x.fixture_id,x]));
 const scores=state.round.fixtures.map(f=>{const x=byFixture.get(f.id);return x?[Number(x.home_score),Number(x.away_score)]:[null,null]});
 const previous=state.entries[p.id]||{};
 state.entries[p.id]={submitted:Boolean(live.entry),submittedAt:live.entry?.submitted_at||null,scores,minute:live.entry?.first_goal_minute??null,paid:Boolean(live.paid),paymentPending:Boolean(live.paymentPending),paymentClaimedAt:live.paymentClaimedAt||null,paymentStarted:Boolean(previous.paymentStarted)&&!live.paid&&!live.paymentPending,adminEdits:[]};
 playerDraft=null;
 save();
 return state.entries[p.id];
}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function leagueName(id){return state.leagues.find(l=>l.id===id)?.name||'Unknown league'}
function getPlayer(id){return state.players.find(p=>p.id===id)}
function currentUser(){return getPlayer(session.userId)}

async function refreshChumpionsState(){
 try{
  chumpionsState=await window.Super6Backend.loadChumpionsState();
  chumpionsError='';
 }catch(err){
  console.warn('Could not load Chumpions League',err);
  chumpionsState={season:null,members:[],matches:[],players:[],rounds:[],competition:null,finalists:[],knockoutMatches:[]};
  chumpionsError=err?.message||'Could not load Chumpions League.';
 }
 return chumpionsState;
}
function chumpionsPlayerMap(){return new Map((chumpionsState.players||[]).map(p=>[String(p.id),p]))}
function chumpionsMemberMap(){return new Map((chumpionsState.members||[]).map(m=>[String(m.player_id),m]))}
function chumpionsRoundMap(){return new Map((chumpionsState.rounds||[]).map(r=>[String(r.id),r]))}
function chumpionsName(id){return chumpionsPlayerMap().get(String(id))?.username||'Player'}
function chumpionsMembersFor(group){
 const pmap=chumpionsPlayerMap();
 return (chumpionsState.members||[]).filter(m=>m.group_code===group).map(m=>({...m,username:pmap.get(String(m.player_id))?.username||'Player'})).sort((a,b)=>a.username.localeCompare(b.username));
}
function computeChumpionsStandings(){
 const groups={A:[],B:[],C:[],D:[]},pmap=chumpionsPlayerMap();
 for(const m of chumpionsState.members||[]){
  if(!groups[m.group_code])continue;
  groups[m.group_code].push({player_id:m.player_id,username:pmap.get(String(m.player_id))?.username||'Player',played:0,wins:0,draws:0,losses:0,groupPoints:0,super6Points:0,firstGoalAccuracy:0,accuracySamples:0,h2h:0});
 }
 const allRows=new Map();Object.values(groups).flat().forEach(r=>allRows.set(String(r.player_id),r));
 const completed=(chumpionsState.matches||[]).filter(m=>m.status==='completed'&&m.player1_score!=null&&m.player2_score!=null);
 for(const m of completed){
  const a=allRows.get(String(m.player1_id)),b=allRows.get(String(m.player2_id));if(!a||!b)continue;
  a.played++;b.played++;a.super6Points+=Number(m.player1_score||0);b.super6Points+=Number(m.player2_score||0);
  if(m.player1_tiebreak!=null){a.firstGoalAccuracy+=Number(m.player1_tiebreak);a.accuracySamples++}
  if(m.player2_tiebreak!=null){b.firstGoalAccuracy+=Number(m.player2_tiebreak);b.accuracySamples++}
  if(Number(m.player1_score)>Number(m.player2_score)){a.wins++;b.losses++;a.groupPoints+=3}
  else if(Number(m.player2_score)>Number(m.player1_score)){b.wins++;a.losses++;b.groupPoints+=3}
  else{a.draws++;b.draws++;a.groupPoints++;b.groupPoints++}
 }
 for(const group of Object.keys(groups)){
  const rows=groups[group];
  const groupCompleted=completed.filter(x=>x.group_code===group);
  const hasPlayed=groupCompleted.length>0;
  const cohorts=new Map();rows.forEach(r=>{const k=r.groupPoints;if(!cohorts.has(k))cohorts.set(k,[]);cohorts.get(k).push(r)});
  for(const cohort of cohorts.values()){
   if(cohort.length<2)continue;const ids=new Set(cohort.map(r=>String(r.player_id)));
   for(const m of groupCompleted.filter(x=>ids.has(String(x.player1_id))&&ids.has(String(x.player2_id)))){
    const a=allRows.get(String(m.player1_id)),b=allRows.get(String(m.player2_id));
    if(Number(m.player1_score)>Number(m.player2_score))a.h2h+=3;else if(Number(m.player2_score)>Number(m.player1_score))b.h2h+=3;else{a.h2h++;b.h2h++}
   }
  }
  rows.sort((a,b)=>b.groupPoints-a.groupPoints||b.h2h-a.h2h||b.super6Points-a.super6Points||((a.accuracySamples?a.firstGoalAccuracy:999999)-(b.accuracySamples?b.firstGoalAccuracy:999999))||a.username.localeCompare(b.username));
  let lastKey='',position=0;
  rows.forEach((r,i)=>{const acc=r.accuracySamples?r.firstGoalAccuracy:'x';const key=`${r.groupPoints}|${r.h2h}|${r.super6Points}|${acc}`;if(key!==lastKey){position=i+1;lastKey=key}r.position=position;r.tieKey=key;r.preMatch=!hasPlayed;r.qualifying=hasPlayed&&position<=4});
  rows.forEach(r=>{const tied=rows.filter(x=>x.tieKey===r.tieKey);r.adminTie=hasPlayed&&r.played>0&&tied.length>1&&tied.every(x=>x.played>0)});
 }
 return groups;
}
function chumpionsStandingsHTML({compact=false}={}){
 const groups=computeChumpionsStandings();
 return `<div class="chumpions-groups">${['A','B','C','D'].map(group=>{const rows=groups[group]||[];const hasPlayed=rows.some(r=>r.played>0);const qualifierText=rows.length<4?'Top 4 qualify once group is complete':'Top 4 qualify after group stage';return `<section class="chumpions-group-card"><div class="chumpions-group-title"><h4>Group ${group}</h4><span>${qualifierText}</span></div>${rows.length?`<div class="table-wrap"><table class="chumpions-table"><thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>S6</th>${compact?'':'<th>H2H</th>'}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.qualifying?'qualifying':''}"><td>${hasPlayed?`${r.position}${r.adminTie?'*':''}`:'—'}</td><td>${escapeHtml(r.username)}${r.adminTie?'<small class="admin-tie">Admin tie</small>':''}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td><b>${r.groupPoints}</b></td><td>${r.super6Points}</td>${compact?'':`<td>${r.h2h}</td>`}</tr>`).join('')}</tbody></table></div>${!hasPlayed?'<div class="chumpions-prestart-note">Standings begin once the first Chumpions head-to-head result is completed.</div>':''}`:`<div class="notice">No players assigned to Group ${group} yet.</div>`}</section>`}).join('')}</div>`;
}
function chumpionsMatchesForRound(roundId){return (chumpionsState.matches||[]).filter(m=>String(m.round_id)===String(roundId))}
function chumpionsGroupMatchdayTotal(group){const n=chumpionsMembersFor(group).length;return n<2?0:(n%2?n:n-1)}
function chumpionsGroupRoundIds(group){
 const rmap=chumpionsRoundMap();
 return [...new Set((chumpionsState.matches||[]).filter(m=>m.group_code===group).map(m=>String(m.round_id)))].sort((a,b)=>{
  const ra=rmap.get(a),rb=rmap.get(b);return new Date(ra?.created_at||0)-new Date(rb?.created_at||0)
 })
}
function chumpionsGroupMatchdayNumber(group,roundId){const ids=chumpionsGroupRoundIds(group),i=ids.indexOf(String(roundId));return i<0?null:i+1}
function chumpionsGroupByeForRound(group,roundId){
 const matches=chumpionsMatchesForRound(roundId).filter(m=>m.group_code===group);if(!matches.length)return[];
 const used=new Set(matches.flatMap(m=>[String(m.player1_id),String(m.player2_id)]));
 return chumpionsMembersFor(group).filter(m=>!used.has(String(m.player_id)))
}
function chumpionsRotationStarted(){return (chumpionsState.matches||[]).length>0}
function chumpionsMatchRow(m,{admin=false}={}){
 const a=escapeHtml(chumpionsName(m.player1_id)),b=escapeHtml(chumpionsName(m.player2_id));
 let score='<span class="chumpions-vs">vs</span>',state='Scheduled';
 if(m.status==='completed'){score=`<b class="chumpions-score">${Number(m.player1_score)} – ${Number(m.player2_score)}</b>`;state=m.is_draw?'Draw':`${escapeHtml(chumpionsName(m.winner_id))} won`}
 else if(m.status==='review'){score='<b class="chumpions-review">Review</b>';state='One or both normal Super 6 entries did not count'}
 return `<div class="chumpions-match"><div><b>${a}</b><small>${escapeHtml(state)}</small></div>${score}<div class="right"><b>${b}</b>${admin&&m.status!=='completed'?`<button class="link-danger" data-delete-chumpions="${escapeAttr(m.id)}" type="button">Remove</button>`:''}</div></div>`;
}


function chumpionsGroupConfirmed(){return Boolean(chumpionsState.competition?.group_stage_confirmed)}
function chumpionsStageLabel(stage){return stage==='R16'?'Round of 16':stage==='QF'?'Quarter Finals':stage==='SF'?'Semi Finals':stage==='F'?'Final':'Knockout'}
function chumpionsKnockoutForStage(stage){return (chumpionsState.knockoutMatches||[]).filter(m=>m.stage===stage).sort((a,b)=>Number(a.slot_no)-Number(b.slot_no))}
function chumpionsKnockoutForRound(roundId){return (chumpionsState.knockoutMatches||[]).filter(m=>String(m.round_id||'')===String(roundId||''))}
function chumpionsRoundName(roundId){return chumpionsRoundMap().get(String(roundId))?.name||''}
function chumpionsKnockoutMatchHTML(m,{admin=false}={}){
 const a=escapeHtml(chumpionsName(m.player1_id)),b=escapeHtml(chumpionsName(m.player2_id));
 const roundName=m.round_id?chumpionsRoundName(m.round_id):'';
 let middle='<span class="chumpions-vs">vs</span>',note=roundName?escapeHtml(roundName):'Waiting for a Chumpions week';
 if(m.status==='completed'){
  middle=`<b class="chumpions-score">${Number(m.player1_score)} – ${Number(m.player2_score)}</b>`;
  const why=m.decided_by==='first_goal'?' · first-goal tie-break':m.decided_by==='admin'?' · Admin decision':'';
  note=`${escapeHtml(chumpionsName(m.winner_id))} through${why}`;
 }else if(m.status==='review'){
  middle=`<b class="chumpions-review">Decision</b>`;
  note=(m.player1_score!=null&&m.player2_score!=null)?`Level ${Number(m.player1_score)}–${Number(m.player2_score)} · Admin decides`:'Admin review required';
 }else if(m.status==='scheduled') note=roundName?`${escapeHtml(roundName)} · awaiting results`:'Awaiting results';
 const controls=admin&&m.status==='review'?`<div class="chumpions-admin-choice"><small>Who goes through?</small><div><button class="secondary small" data-chumpions-advance="${escapeAttr(m.id)}" data-player="${escapeAttr(m.player1_id)}" type="button">${a}</button><button class="secondary small" data-chumpions-advance="${escapeAttr(m.id)}" data-player="${escapeAttr(m.player2_id)}" type="button">${b}</button></div></div>`:'';
 return `<div class="chumpions-ko-match"><div class="chumpions-ko-line"><div><b>${a}</b><small>${m.player1_score==null?'':`${Number(m.player1_score)} pts`}</small></div>${middle}<div class="right"><b>${b}</b><small>${m.player2_score==null?'':`${Number(m.player2_score)} pts`}</small></div></div><div class="chumpions-ko-note">${note}</div>${controls}</div>`;
}
function chumpionsBracketHTML({admin=false}={}){
 if(!chumpionsGroupConfirmed())return '';
 const champion=chumpionsState.competition?.champion_id;
 const champ=champion?`<div class="chumpions-champion">🏆 <span>Chumpions League Champion</span><strong>${escapeHtml(chumpionsName(champion))}</strong></div>`:'';
 return `${champ}<div class="chumpions-bracket">${['R16','QF','SF','F'].map(stage=>{const ms=chumpionsKnockoutForStage(stage);return `<section class="chumpions-stage"><div class="chumpions-stage-head"><b>${chumpionsStageLabel(stage)}</b><span>${ms.length?`${ms.filter(m=>m.status==='completed').length}/${ms.length} decided`:'Waiting'}</span></div>${ms.length?ms.map(m=>chumpionsKnockoutMatchHTML(m,{admin})).join(''):'<div class="chumpions-stage-wait">Created automatically when the previous stage is complete.</div>'}</section>`}).join('')}</div>`;
}
function chumpionsQualifierPayload(){
 const groups=computeChumpionsStandings(),out={A:[],B:[],C:[],D:[]};
 for(const g of ['A','B','C','D'])out[g]=(groups[g]||[]).slice(0,4).map(r=>r.player_id);
 return out;
}
function chumpionsQualifierProblem(){
 const groups=computeChumpionsStandings();
 for(const g of ['A','B','C','D']){
  const rows=groups[g]||[];
  if(rows.length<4)return `Group ${g} needs at least four players before the group stage can be confirmed.`;
  if(!rows.some(r=>r.played>0))return `Group ${g} has no completed Chumpions matches yet.`;
  const top=rows.slice(0,4);
  if(top.some(r=>r.adminTie))return `Group ${g} still has an exact tie affecting the qualifying order. Leave the group stage open until Admin is ready to decide it.`;
 }
 return '';
}

function cutoff(){return state.round?.cutoff?new Date(state.round.cutoff):null}
function graceEnd(){const c=cutoff();const hours=Number(appSettings.payment_grace_hours||12);return c?new Date(c.getTime()+hours*3600000):null}
function predictionLocked(){const c=cutoff();return !liveRoundExists||Boolean(state.round?.completed)||!c||Number.isNaN(c.getTime())||Date.now()>=c.getTime()}
function paymentLocked(){const g=graceEnd();return !g||Number.isNaN(g.getTime())||Date.now()>=g.getTime()}
function entryFor(pid){return state.entries[pid]||{submitted:false,submittedAt:null,scores:Array(6).fill(null).map(()=>[null,null]),minute:null,paid:false,paymentPending:false,paymentClaimedAt:null,paymentStarted:false,adminEdits:[]}}
function ensureEntry(pid){if(!state.entries[pid])state.entries[pid]=entryFor(pid);return state.entries[pid]}
function fmtDate(d){return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)}
function resultType(ph,pa,ah,aa){if(ph===ah&&pa===aa)return'exact';const pr=Math.sign(ph-pa),ar=Math.sign(ah-aa);return pr===ar?'correct':'wrong'}
function scoreEntry(entry){let points=0,exact=0,correct=0;state.round.fixtures.forEach((f,i)=>{if(f.removed||!f.result)return;const s=entry.scores[i];if(s?.[0]==null||s?.[1]==null)return;const t=resultType(s[0],s[1],f.result[0],f.result[1]);if(t==='exact'){points+=5;exact++}else if(t==='correct'){points+=2;correct++}});return{points,exact,correct}}
function eligiblePlayers(leagueId){return state.players.filter(p=>p.leagueId===leagueId).filter(p=>{const e=entryFor(p.id);return e.submitted&&e.paid})}
function leagueWeeklyOutcome(leagueId){if(!state.round.completed)return null;const rows=eligiblePlayers(leagueId).map(p=>{const e=entryFor(p.id),s=scoreEntry(e);const diff=state.round.officialMinute==null?null:Math.abs(e.minute-state.round.officialMinute);return{p,e,...s,diff}});if(!rows.length)return{rows:[],first:[],second:[],spoons:[]};rows.sort((a,b)=>b.points-a.points||(a.diff??999)-(b.diff??999)||a.p.name.localeCompare(b.p.name));const topPts=rows[0].points;const topGroup=rows.filter(r=>r.points===topPts);let first=[];if(state.round.officialMinute==null){first=topGroup}else{const best=Math.min(...topGroup.map(r=>r.diff));first=topGroup.filter(r=>r.diff===best)}let second=[];if(first.length===1){const remaining=rows.filter(r=>r.p.id!==first[0].p.id);if(remaining.length){const secPts=remaining[0].points;const secGroup=remaining.filter(r=>r.points===secPts);if(state.round.officialMinute==null)second=secGroup;else{const best=Math.min(...secGroup.map(r=>r.diff));second=secGroup.filter(r=>r.diff===best)}}}
 const nonWinners=rows.filter(r=>!first.some(w=>w.p.id===r.p.id));const minPts=nonWinners.length?Math.min(...nonWinners.map(r=>r.points)):null;const spoons=minPts==null?[]:nonWinners.filter(r=>r.points===minPts);return{rows,first,second,spoons}}
function seasonSortedLocal(leagueId){const arr=state.players.filter(p=>p.leagueId===leagueId).slice();arr.sort((a,b)=>b.points-a.points||b.wins-a.wins||b.exact-a.exact||a.name.localeCompare(b.name));let pos=0,lastKey='';return arr.map((p,i)=>{const key=[p.points,p.wins,p.exact].join('|');if(key!==lastKey){pos=i+1;lastKey=key}return{...p,pos}})}
function liveRowsForLeague(leagueId){const name=leagueName(leagueId);return liveStandings.filter(r=>r.league_name===name)}
async function refreshLiveStandings(){liveStandings=await window.Super6Backend.loadSeasonStandings();return liveStandings}
async function refreshLiveWeeklyResults(){
 if(!liveRoundExists||!state.round?.id||!state.round.completed){liveWeeklyResults=[];return liveWeeklyResults}
 liveWeeklyResults=await window.Super6Backend.loadRoundResults(state.round.id);
 return liveWeeklyResults;
}
async function refreshLatestPublishedWeek(){
 publishedPredictionsError='';
 try{
  const data=await window.Super6Backend.loadLatestPublishedPredictions();
  latestPublishedWeek={round:data?.round||null,predictions:Array.isArray(data?.predictions)?data.predictions:[]};
  publishedLeaguePredictions=latestPublishedWeek.predictions;
  publishedPredictionRoundId=latestPublishedWeek.round?.id||null;
  const byPlayer=new Map();
  publishedLeaguePredictions.forEach(row=>{if(row?.player_id&&!byPlayer.has(String(row.player_id)))byPlayer.set(String(row.player_id),row)});
  latestLeagueAwards=[...byPlayer.values()].filter(r=>Boolean(r.is_winner)||Boolean(r.is_second)||Boolean(r.is_wooden_spoon));
  latestLeagueAwardRound=latestPublishedWeek.round;
 }catch(err){
  console.warn('Could not load latest published predictions',err);
  latestPublishedWeek={round:null,predictions:[]};publishedLeaguePredictions=[];publishedPredictionRoundId=null;latestLeagueAwards=[];latestLeagueAwardRound=null;
  publishedPredictionsError=err?.message||'Could not load latest published predictions.';
 }
 return latestPublishedWeek;
}
async function refreshPublishedLeaguePredictions(){return refreshLatestPublishedWeek()}
async function refreshLatestLeagueWinners(){await refreshLatestPublishedWeek();return latestLeagueAwards.filter(r=>Boolean(r.is_winner))}
function latestAwardsForPlayer(playerId,playerName){
 const id=String(playerId||''),name=String(playerName||'').trim().toLowerCase();
 return latestLeagueAwards.find(w=>(id&&String(w.player_id||'')===id)||(name&&String(w.username||'').trim().toLowerCase()===name))||null;
}
function latestAwardMark(playerId,playerName){
 const a=latestAwardsForPlayer(playerId,playerName);if(!a)return'';
 const marks=[];
 if(a.is_winner)marks.push('👑');
 else if(a.is_second)marks.push('🥈');
 if(a.is_wooden_spoon&&!a.is_winner)marks.push('🥄');
 return marks.join(' ');
}
function latestAwardHTML(playerId,playerName){
 const mark=latestAwardMark(playerId,playerName);if(!mark)return'';
 const round=latestLeagueAwardRound?.name?` · ${escapeAttr(latestLeagueAwardRound.name)}`:'';
 return `<span class="league-crown latest-award" title="Latest league-week award${round}" aria-label="Latest league-week award">${mark}</span>`;
}
function playerNameWithCrown(playerId,playerName){return `${escapeHtml(playerName)}${latestAwardHTML(playerId,playerName)}`}
function liveLeagueIdFor(localLeagueId){
 const name=leagueName(localLeagueId);
 return liveStandings.find(r=>r.league_name===name)?.league_id
  ||(adminRoundOverview.leagues||[]).find(l=>l.name===name)?.id
  ||localLeagueId;
}
function liveWeeklyOutcome(leagueId){
 const liveLeagueId=liveLeagueIdFor(leagueId),name=leagueName(leagueId);
 const rows=liveWeeklyResults.filter(r=>r.league_id===liveLeagueId||r.league_name===name).map(r=>{
  const local=state.players.find(p=>p.name.toLowerCase()===String(r.username||'').toLowerCase());
  const p=local?{...local,authId:r.player_id}:{id:r.player_id,authId:r.player_id,name:r.username||'Player',leagueId};
  return {p,e:{minute:null},points:Number(r.points||0),exact:Number(r.exact_scores||0),correct:Number(r.correct_results||0),diff:r.tie_break_difference==null?null:Number(r.tie_break_difference),weekPos:Number(r.position||0),isWinner:Boolean(r.is_winner),isSecond:Boolean(r.is_second),isSpoon:Boolean(r.is_wooden_spoon)};
 }).sort((a,b)=>a.weekPos-b.weekPos||b.points-a.points||a.p.name.localeCompare(b.p.name));
 return {rows,first:rows.filter(r=>r.isWinner),second:rows.filter(r=>r.isSecond),spoons:rows.filter(r=>r.isSpoon)};
}
function weeklyResultForPlayer(playerId){return liveWeeklyResults.find(r=>r.player_id===playerId)||null}
function pointsForScore(prediction,fixture){
 if(!prediction||prediction[0]==null||prediction[1]==null||!fixture?.result||fixture.removed)return{points:0,type:'none',label:fixture?.removed?'Void':'No prediction'};
 const type=resultType(Number(prediction[0]),Number(prediction[1]),Number(fixture.result[0]),Number(fixture.result[1]));
 return type==='exact'?{points:5,type,label:'Correct score'}:type==='correct'?{points:2,type,label:'Correct result'}:{points:0,type,label:'No points'};
}
function scoreBreakdownHTML(scoreGetter){
 let total=0;
 const rows=state.round.fixtures.map((f,i)=>{
  const pred=scoreGetter(f,i);
  if(f.removed)return `<div class="score-breakdown-row void"><div><b>${escapeHtml(f.home)} v ${escapeHtml(f.away)}</b><small>Fixture removed / void</small></div><div class="score-breakdown-score">—</div><span class="score-points zero">VOID</span></div>`;
  const awarded=pointsForScore(pred,f);total+=awarded.points;
  const prediction=pred&&pred[0]!=null&&pred[1]!=null?`${pred[0]} – ${pred[1]}`:'—';
  const actual=f.result&&f.result[0]!=null&&f.result[1]!=null?`${f.result[0]} – ${f.result[1]}`:'—';
  return `<div class="score-breakdown-row"><div><b>${escapeHtml(f.home)} v ${escapeHtml(f.away)}</b><small>${escapeHtml(awarded.label)}</small></div><div class="score-breakdown-score"><span>Pred ${prediction}</span><span>FT ${actual}</span></div><span class="score-points ${awarded.points===5?'five':awarded.points===2?'two':'zero'}">+${awarded.points}</span></div>`;
 }).join('');
 return `<div class="score-breakdown"><div class="score-breakdown-head"><b>Points breakdown</b><span>${total} pts from fixtures</span></div>${rows}</div>`;
}
async function refreshAdminRoundOverview(){
 if(session.role!=='admin'||!liveRoundExists||!state.round?.id){adminRoundOverview={leagues:[],players:[]};adminOverviewLastFetch=Date.now();return adminRoundOverview}
 adminRoundOverview=await window.Super6Backend.loadAdminRoundOverview(state.round.id);
 adminOverviewLastFetch=Date.now();
 return adminRoundOverview;
}
async function maybeRefreshAdminRoundOverview(){
 if(session.role!=='admin'||!liveRoundExists||adminOverviewFetching||Date.now()-adminOverviewLastFetch<15000)return;
 adminOverviewFetching=true;
 try{await refreshAdminRoundOverview();renderAdminHero();renderAdminLeaguePanels()}catch(err){console.warn('Admin overview refresh failed',err)}finally{adminOverviewFetching=false}
}
function currentLiveStanding(){return liveStandings.find(r=>r.player_id===session.authUserId)||null}
function modal(html){$('#modalRoot').innerHTML='<div class="modal" id="activeModal"><div class="modal-card">'+html+'</div></div>';$('#activeModal').addEventListener('click',e=>{if(e.target.id==='activeModal')closeModal()})}
function closeModal(){$('#modalRoot').innerHTML=''}
async function login(name,pin){
 const profile=await window.Super6Backend.pinLogin(name,pin);
 await refreshLiveStandings();
 await refreshLiveRound();
 await refreshAppSettings();
 await refreshLiveWeeklyResults();
 await refreshLatestLeagueWinners();
 if(profile.role==='admin'){
  session={role:'admin',userId:null,authUserId:profile.id};
  playerDraft=null;
  await Promise.all([refreshAdminRoundOverview(),refreshChumpionsState()]);
  showApp();
  return true;
 }
 if(profile.role==='player'){
  const p=state.players.find(x=>x.name.toLowerCase()===profile.username.toLowerCase());
  if(!p){
   await window.Super6Backend.signOut();
   throw new Error('Your login is valid, but your weekly round data has not been migrated into this version yet.');
  }
  session={role:'player',userId:p.id,authUserId:profile.id};
  activeLeague=p.leagueId;
  playerDraft=null;
  await refreshMyLiveEntry();
  await Promise.all([refreshPublishedLeaguePredictions(),refreshChumpionsState()]);
  showApp();
  return true;
 }
 await window.Super6Backend.signOut();
 throw new Error('This Super 6 account has no valid role.');
}
function showApp(){$('#loginScreen').classList.add('hidden');$('#appScreen').classList.remove('hidden');$('#whoBtn').textContent=session.role==='admin'?'Admin':currentUser().name;$('#playerArea').classList.toggle('hidden',session.role!=='player');$('#adminArea').classList.toggle('hidden',session.role!=='admin');renderAll();startTimer()}
async function logout(){await window.Super6Backend.signOut().catch(()=>{});session={role:null,userId:null};playerDraft=null;clearInterval(timer);$('#appScreen').classList.add('hidden');$('#loginScreen').classList.remove('hidden');$('#loginPin').value=''}
function startTimer(){clearInterval(timer);timer=setInterval(()=>{if(session.role==='player')renderCountdown();if(session.role==='admin'){renderAdminHero();maybeRefreshAdminRoundOverview()}},1000)}
function renderAll(){if(session.role==='player')renderPlayer();else if(session.role==='admin')renderAdmin()}
function renderCountdown(){const box=$('#countdownBox');if(!box)return;if(!liveRoundExists||!cutoff()){ $('#countdown').textContent='NO ROUND';$('#cutoffText').textContent='Waiting for the next fixture sheet';box.classList.remove('urgent','soon');return;}let ms=cutoff()-Date.now();let label;if(ms<=0){label='CLOSED';ms=0}else{const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);label=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}$('#countdown').textContent=label;$('#cutoffText').textContent='Cutoff '+fmtDate(cutoff());box.classList.toggle('urgent',ms>0&&ms<=10*60000);box.classList.toggle('soon',ms>10*60000&&ms<=3600000)}
function renderPlayer(){
 const p=currentUser(),e=entryFor(p.id),live=currentLiveStanding();
 if($('#whoBtn'))$('#whoBtn').textContent=p.name;
 const rank=live?.position??seasonSortedLocal(p.leagueId).find(x=>x.id===p.id)?.pos??'-';
 $('#roundHeroName').textContent=liveRoundExists?state.round.name:'No round published';
 $('#playerLeagueName').textContent=live?.league_name||leagueName(p.leagueId);
 const pay=$('#paymentChip'),ent=$('#entryChip');
 if(!liveRoundExists){pay.textContent='Waiting';pay.className='chip';ent.textContent='No round';ent.className='chip';}
 else if(e.paid){pay.textContent='Paid ✓';pay.className='chip good'}
 else if(e.paymentPending){pay.textContent='Payment pending';pay.className='chip warn'}
 else if(e.submitted&&paymentLocked()){pay.textContent='Entry not counted';pay.className='chip bad'}
 else if(e.submitted){pay.textContent=`£${Number(state.round.fee||6).toFixed(0)} unpaid`;pay.className='chip bad'}
 else{pay.textContent='Payment after entry';pay.className='chip'}
 if(liveRoundExists){
  if(!e.submitted){ent.textContent=predictionLocked()?'Not entered':'Not submitted';ent.className='chip bad'}
  else if(predictionLocked()){ent.textContent='Locked ✓';ent.className='chip good'}
  else{ent.textContent='Submitted ✓';ent.className='chip good'}
 }
 $('#playerStats').innerHTML=[['Position',rank],['Points',live?.points??p.points],['Wins',live?.wins??p.wins],['Correct scores',live?.exact_scores??p.exact],['Correct results',live?.correct_results??p.correct]].map(x=>`<div class="stat"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('');
 if(!liveRoundExists){
  $('#entryHelp').textContent='The next Super 6 fixture sheet has not been published yet.';
  const inlineStatus=$('#inlineEntryStatus');inlineStatus.textContent='Waiting';inlineStatus.className='chip';
  $('#playerPredictionPanel').innerHTML='<div class="notice">No current round. Check back when the admin publishes the next six fixtures.</div>';
  $('#playerPredictionActions').innerHTML='';
 }else{
  const inlineStatus=$('#inlineEntryStatus');
  if(e.submitted){inlineStatus.textContent=predictionLocked()?'Locked ✓':'Submitted ✓';inlineStatus.className='chip good';$('#entryHelp').textContent=predictionLocked()?'Your saved predictions are locked for this round.':'Your entry is saved in Super 6. You can edit it until cutoff.';}
  else{inlineStatus.textContent=predictionLocked()?'Closed':'Enter now';inlineStatus.className=predictionLocked()?'chip bad':'chip';$('#entryHelp').textContent=predictionLocked()?'The cutoff has passed and no entry was submitted.':'Complete all six score predictions and the first-goal minute.';}
  renderInlinePredictions();
 }
 renderPlayerPayment();
 $('#historyLeagueName').textContent=live?.league_name||leagueName(p.leagueId);
 renderCountdown();renderLeagueTabs();renderHistory();renderPersonalResult();renderLatestWeekPredictions();renderPlayerChumpions();
}
function renderPlayerPayment(){
 const card=$('#playerPaymentCard'),body=$('#playerPaymentBody');
 if(!card||!body)return;
 const p=currentUser(),e=p?entryFor(p.id):null;
 if(!liveRoundExists||!e?.submitted){card.classList.add('hidden');body.innerHTML='';return}
 card.classList.remove('hidden');
 const fee=Number(state.round.fee||appSettings.default_entry_fee||6);
 const feeText=`£${Number.isInteger(fee)?fee.toFixed(0):fee.toFixed(2)}`;
 if(e.paid){
  body.innerHTML=`<div class="payment-state paid-state"><div class="payment-state-icon">✓</div><div><b>Payment confirmed</b><span>${feeText} received for this round.</span></div></div>`;
  return;
 }
 if(e.paymentPending){
  body.innerHTML=`<div class="payment-state pending-state"><div class="payment-state-icon">…</div><div><b>Payment pending</b><span>You said you have paid ${feeText}. The payment button is hidden while Admin checks it.</span></div></div>`;
  return;
 }
 if(paymentLocked()){
  body.innerHTML=`<div class="payment-state closed-state"><div class="payment-state-icon">!</div><div><b>Payment window closed</b><span>Your payment was not confirmed in time, so this entry is not counted.</span></div></div>`;
  return;
 }
 if(!appSettings.payment_url){
  body.innerHTML=`<div class="payment-state unpaid-state"><div class="payment-copy"><b>${feeText} entry fee</b><span>Payment is still due. Admin has not added the Monzo payment link yet.</span></div></div>`;
  return;
 }
 if(!e.paymentStarted){
  body.innerHTML=`<div class="payment-state unpaid-state"><div class="payment-copy"><b>${feeText} entry fee</b><span>Pay securely using the Super 6 Monzo link. Once you have paid, come back here to confirm it.</span></div><button class="big-action payment-pay-btn" id="payMonzoBtn" type="button">Pay ${feeText} with Monzo</button></div>`;
  $('#payMonzoBtn').onclick=()=>{
   e.paymentStarted=true;save();renderPlayerPayment();
   window.open(appSettings.payment_url,'_blank','noopener,noreferrer');
  };
  return;
 }
 body.innerHTML=`<div class="payment-confirm"><div><div class="kicker">Quick check</div><h3>Did you complete the ${feeText} payment?</h3><div class="muted">Only press yes after the payment has actually gone through.</div></div><div class="payment-confirm-actions"><button class="big-action" id="confirmPaidBtn" type="button">Yes, I've paid</button><button class="secondary" id="notPaidYetBtn" type="button">Not yet</button></div><div id="paymentActionStatus"></div></div>`;
 $('#notPaidYetBtn').onclick=()=>{e.paymentStarted=false;save();renderPlayerPayment()};
 $('#confirmPaidBtn').onclick=async()=>{
  const btn=$('#confirmPaidBtn'),status=$('#paymentActionStatus');
  btn.disabled=true;btn.textContent='Saving…';
  try{
   await window.Super6Backend.markMyPaymentPending(state.round.id);
   await refreshMyLiveEntry();
   renderPlayer();
  }catch(err){
   if(status)status.innerHTML=`<div class="notice bad" style="margin-top:10px">${escapeHtml(err?.message||'Could not update payment status.')}</div>`;
   btn.disabled=false;btn.textContent="Yes, I've paid";
  }
 };
}
function weeklyPositions(rows){let lastKey='',pos=0;return rows.map((r,i)=>{const tieKey=state.round.officialMinute==null?`${r.points}`:`${r.points}|${r.diff}`;if(tieKey!==lastKey){pos=i+1;lastKey=tieKey}return{...r,weekPos:pos}})}
function weeklyAwardMark(out,r){const marks=[];const winner=out.first.some(x=>x.p.id===r.p.id);if(winner)marks.push('👑');else if(out.first.length===1&&out.second.some(x=>x.p.id===r.p.id))marks.push('🥈');if(!winner&&out.spoons.some(x=>x.p.id===r.p.id))marks.push('🥄');return marks.join(' ')}
function weeklyRankingHTML(out,meId=null,options={}){
 const ranked=weeklyPositions(out.rows),showPicks=Boolean(options.showPublishedPredictions&&state.round.completed);
 return `<div class="round-ranking">${ranked.map(r=>{const tie=state.round.officialMinute==null?'':(r.e?.minute!=null?` · Goal ${r.e.minute}'`:(r.diff!=null?` · Tie-break ±${r.diff}`:''));const authId=r.p.authId||r.p.id;const picks=showPicks&&authId&&String(authId)!==String(session.authUserId)?`<button class="picks-btn" data-view-picks="${escapeAttr(authId)}" type="button">View picks</button>`:'';return `<div class="round-rank-row ${r.p.id===meId?'me':''}"><div class="round-pos">${r.weekPos}</div><div class="round-person"><b>${escapeHtml(r.p.name)}<span class="award-mini">${weeklyAwardMark(out,r)}</span></b><small>${r.exact} correct score${r.exact===1?'':'s'} · ${r.correct} correct result${r.correct===1?'':'s'}${tie}</small>${picks}</div><div class="round-points">${r.points}<small style="display:block;font:11px Georgia;color:var(--muted);letter-spacing:.5px">PTS</small></div></div>`}).join('')}</div>`;
}
function publishedPredictionRowsFor(playerId){return publishedLeaguePredictions.filter(x=>String(x.player_id)===String(playerId)).sort((a,b)=>Number(a.fixture_order||0)-Number(b.fixture_order||0))}
function latestPublishedBreakdownHTML(rows){
 let total=0;
 const html=rows.map(x=>{
  if(x.removed)return `<div class="score-breakdown-row void"><div><b>${escapeHtml(x.home_team)} v ${escapeHtml(x.away_team)}</b><small>Fixture removed / void</small></div><div class="score-breakdown-score">—</div><span class="score-points zero">VOID</span></div>`;
  const pred=[Number(x.home_score),Number(x.away_score)],actual=[Number(x.actual_home_score),Number(x.actual_away_score)];
  const type=resultType(pred[0],pred[1],actual[0],actual[1]);const points=type==='exact'?5:type==='correct'?2:0;total+=points;
  const label=type==='exact'?'Correct score':type==='correct'?'Correct result':'No points';
  return `<div class="score-breakdown-row"><div><b>${escapeHtml(x.home_team)} v ${escapeHtml(x.away_team)}</b><small>${label}</small></div><div class="score-breakdown-score"><span>Pred ${pred[0]} – ${pred[1]}</span><span>FT ${actual[0]} – ${actual[1]}</span></div><span class="score-points ${points===5?'five':points===2?'two':'zero'}">+${points}</span></div>`;
 }).join('');
 return `<div class="score-breakdown"><div class="score-breakdown-head"><b>Points breakdown</b><span>${total} pts from fixtures</span></div>${html}</div>`;
}
function showPublishedPredictions(playerId){
 const rows=publishedPredictionRowsFor(playerId);
 if(!rows.length){modal(`<div class="kicker">Latest week predictions</div><h3>Predictions unavailable</h3><div class="notice">These predictions could not be loaded.</div><div class="modal-actions"><button class="secondary" id="closePublishedPicks" type="button">Close</button></div>`);$('#closePublishedPicks').onclick=closeModal;return}
 const first=rows[0],breakdown=latestPublishedBreakdownHTML(rows),official=latestPublishedWeek.round?.official_first_goal_minute;
 const tie=official==null?`No goals were scored across the six fixtures, so the first-goal tiebreak was ignored.`:`First-goal minute: ${first.first_goal_minute??'–'}' · Official ${official}'${first.first_goal_minute!=null?` · Difference ${Math.abs(Number(first.first_goal_minute)-Number(official))} min`:''}`;
 const award=latestAwardMark(first.player_id,first.username);
 modal(`<div class="section-head"><div><div class="kicker">${escapeHtml(latestPublishedWeek.round?.name||'Latest week')}</div><h3>${escapeHtml(first.username||'Player')} ${award}</h3><div class="muted">${escapeHtml(first.league_name||'')} · ${Number(first.points||0)} pts · position ${Number(first.position||0)}</div></div><button class="secondary small" id="closePublishedPicks" type="button">Close</button></div><div class="published-picks-note">Results are final, so this player's six predictions are now visible.</div>${breakdown}<div class="tie-break-summary"><b>Tiebreak:</b> ${escapeHtml(tie)}</div>`);
 $('#closePublishedPicks').onclick=closeModal;
}
function latestPublishedPlayerSummaries(){
 const byPlayer=new Map();
 publishedLeaguePredictions.forEach(row=>{const id=String(row.player_id||'');if(id&&!byPlayer.has(id))byPlayer.set(id,row)});
 return [...byPlayer.values()].sort((a,b)=>Number(a.league_sort_order||99)-Number(b.league_sort_order||99)||Number(a.position||999)-Number(b.position||999)||String(a.username||'').localeCompare(String(b.username||'')));
}
function renderLatestWeekPredictions(){
 const sec=$('#latestWeekPredictionsSection');if(!sec)return;
 if(publishedPredictionsError){sec.classList.remove('hidden');sec.innerHTML=`<div class="kicker">Latest completed week</div><h3>All predictions</h3><div class="notice bad">${escapeHtml(publishedPredictionsError)}</div>`;return}
 const round=latestPublishedWeek.round,players=latestPublishedPlayerSummaries();
 if(!round||!players.length){sec.classList.add('hidden');sec.innerHTML='';return}
 sec.classList.remove('hidden');
 const leagueNames=[...new Set(players.map(p=>p.league_name).filter(Boolean))];
 sec.innerHTML=`<div class="latest-picks-head"><div><div class="kicker">${escapeHtml(round.name||'Latest completed week')}</div><h3>All predictions</h3><div class="muted">Latest completed week only · grouped league by league</div></div><div class="latest-picks-count">${players.length} counted entries</div></div><label class="latest-picks-search"><span>🔎</span><input id="latestPicksSearch" type="search" placeholder="Search player…" autocomplete="off" aria-label="Search player predictions"></label><div id="latestPicksGroups"></div>`;
 const groups=$('#latestPicksGroups'),input=$('#latestPicksSearch');
 const paint=()=>{
  const q=String(input?.value||'').trim().toLowerCase();let visible=0;
  groups.innerHTML=leagueNames.map(league=>{
   const rows=players.filter(p=>p.league_name===league&&(!q||String(p.username||'').toLowerCase().includes(q)));
   if(!rows.length)return'';visible+=rows.length;
   return `<div class="latest-picks-league"><div class="latest-picks-league-head"><h4>${escapeHtml(league)}</h4><span>${rows.length}</span></div><div class="latest-picks-list">${rows.map(r=>`<div class="latest-picks-row ${String(r.player_id)===String(session.authUserId)?'me':''}"><div class="latest-picks-pos">${Number(r.position||0)||'–'}</div><div class="latest-picks-person"><b>${escapeHtml(r.username||'Player')}<span class="award-mini">${latestAwardMark(r.player_id,r.username)}</span></b><small>${Number(r.exact_scores||0)} correct score${Number(r.exact_scores||0)===1?'':'s'} · ${Number(r.correct_results||0)} correct result${Number(r.correct_results||0)===1?'':'s'}</small></div><div class="latest-picks-points"><strong>${Number(r.points||0)}</strong><span>PTS</span></div><button class="picks-btn" data-view-latest-picks="${escapeAttr(r.player_id)}" type="button">View picks</button></div>`).join('')}</div></div>`;
  }).join('');
  if(!visible)groups.innerHTML='<div class="notice">No player names match that search.</div>';
  groups.querySelectorAll('[data-view-latest-picks]').forEach(btn=>btn.onclick=()=>showPublishedPredictions(btn.dataset.viewLatestPicks));
 };
 input.oninput=paint;paint();
}

function renderPersonalResult(){
 const sec=$('#personalResultSection'),p=currentUser(),out=state.round.completed?liveWeeklyOutcome(p.leagueId):null,e=entryFor(p.id);
 if(!state.round.completed){sec.classList.add('hidden');return}
 sec.classList.remove('hidden');
 if(!out||!out.rows.length){sec.innerHTML=`<div class="kicker">${escapeHtml(state.round.name)}</div><h3 style="margin:4px 0">Weekly league results</h3><div class="notice">No paid entries counted in ${escapeHtml(leagueName(p.leagueId))} for this round.</div>`;return}
 const row=out.rows.find(r=>r.p.id===p.id);
 const ranked=weeklyPositions(out.rows),mine=ranked.find(r=>r.p.id===p.id);
 const personal=row?`<div class="stats weekly-personal-stats" style="margin-bottom:14px"><div class="stat"><strong>${row.points}</strong><span>Your points</span></div><div class="stat"><strong>${mine?.weekPos??row.weekPos??'-'}</strong><span>Your finish</span></div><div class="stat"><strong>${row.exact}</strong><span>Correct scores</span></div><div class="stat"><strong>${row.correct}</strong><span>Correct results</span></div></div>${scoreBreakdownHTML((f,i)=>e.scores?.[i]||null)}${state.round.officialMinute!=null?`<div class="tie-break-summary"><b>First-goal tiebreak:</b> You chose ${e.minute??'–'}' · Official ${state.round.officialMinute}'${e.minute!=null?` · Difference ${Math.abs(Number(e.minute)-Number(state.round.officialMinute))} min`:''}</div>`:''}`:`<div class="notice" style="margin-bottom:12px">Your entry did not count this week, but you can still see how your league finished.</div>`;
 const picksReady=false;
 const picksMessage=`<div class="published-picks-hint"><b>Predictions unlocked 🔓</b><span>See every counted player across all three leagues in <b>All predictions</b> below.</span></div>`;
 sec.innerHTML=`<div class="weekly-league-title"><div><div class="kicker">${escapeHtml(state.round.name)}</div><h3>How everyone did</h3><div class="muted">${escapeHtml(leagueName(p.leagueId))} · paid entries only</div></div><div class="muted">${state.round.officialMinute==null?'No goals · tiebreak ignored':`First goal ${state.round.officialMinute}'`}</div></div>${personal}<div class="weekly-full-table-title">Your league this week</div>${picksMessage}${weeklyRankingHTML(out,p.id,{showPublishedPredictions:picksReady})}`;
 sec.querySelectorAll('[data-view-picks]').forEach(btn=>btn.onclick=()=>showPublishedPredictions(btn.dataset.viewPicks));
}

function renderPlayerChumpions(){
 const body=$('#playerChumpionsBody'),status=$('#playerChumpionsStatus');if(!body)return;
 if(chumpionsError){body.innerHTML=`<div class="notice bad">${escapeHtml(chumpionsError)}</div>`;return}
 const member=chumpionsMemberMap().get(String(session.authUserId));
 const confirmed=chumpionsGroupConfirmed();
 if(status){status.textContent=confirmed?'Knockout stage':member?`Group ${member.group_code}`:'View only';status.className=(member||confirmed)?'chip good':'chip'}
 const groupCurrent=state.round?.chumpionsLeague&&state.round?.id?chumpionsMatchesForRound(state.round.id):[];
 const koCurrent=state.round?.chumpionsLeague&&state.round?.id?chumpionsKnockoutForRound(state.round.id):[];
 const myGroupCurrent=member?groupCurrent.find(m=>String(m.player1_id)===String(session.authUserId)||String(m.player2_id)===String(session.authUserId)):null;
 const myKoCurrent=koCurrent.find(m=>String(m.player1_id)===String(session.authUserId)||String(m.player2_id)===String(session.authUserId));
 let top='';
 if(state.round?.chumpionsLeague){
  const stage=koCurrent[0]?.stage;
  top=`<div class="chumpions-week-banner"><b>🏆 ${escapeHtml(state.round.name)} is a Chumpions League week${stage?` · ${escapeHtml(chumpionsStageLabel(stage))}`:''}</b><span>${myKoCurrent?`Your tie: ${escapeHtml(chumpionsName(myKoCurrent.player1_id))} vs ${escapeHtml(chumpionsName(myKoCurrent.player2_id))}`:myGroupCurrent?`Your tie: ${escapeHtml(chumpionsName(myGroupCurrent.player1_id))} vs ${escapeHtml(chumpionsName(myGroupCurrent.player2_id))}`:'You do not have a Chumpions tie in this round.'}</span></div>`;
 }else if(member||confirmed){top='<div class="notice">This Super 6 round is not a Chumpions League week. Competition progress is shown below.</div>'}
 const recentRounds=[...(chumpionsState.rounds||[])].sort((a,b)=>new Date(b.completed_at||b.created_at)-new Date(a.completed_at||a.created_at));
 const latestRound=recentRounds.find(r=>r.status==='completed');
 const latestGroupMatches=latestRound?chumpionsMatchesForRound(latestRound.id):[];
 const latestKoMatches=latestRound?chumpionsKnockoutForRound(latestRound.id):[];
 const latestMatches=latestKoMatches.length?latestKoMatches:latestGroupMatches;
 const latest=`${latestRound&&latestMatches.length?`<div class="chumpions-latest"><div class="kicker">Latest Chumpions results</div><h4>${escapeHtml(latestRound.name)}</h4>${latestKoMatches.length?latestKoMatches.map(m=>chumpionsKnockoutMatchHTML(m)).join(''):latestGroupMatches.map(m=>chumpionsMatchRow(m)).join('')}</div>`:''}`;
 const groupBlock=`${member?`<div class="chumpions-membership"><span>Your group</span><strong>Group ${member.group_code}</strong></div>`:'<div class="notice">You are not currently entered in a Chumpions League group, but you can still view the competition.</div>'}<div class="weekly-full-table-title">Group tables</div>${chumpionsStandingsHTML({compact:true})}`;
 const knockout=confirmed?`<div class="weekly-full-table-title">Knockout bracket</div>${chumpionsBracketHTML()}<div class="chumpions-rule-note">Knockout ties are decided by Super 6 points, then closest first-goal prediction. If both are still level, Admin chooses who progresses.</div>`:'<div class="chumpions-rule-note">Top 4 from each group progress to the Round of 16. Admin will confirm the final group tables when the group stage is ready.</div>';
 body.innerHTML=`${top}${latest}${groupBlock}${knockout}`;
}

function renderLeagueTabs(){const holder=$('#leagueTabs');holder.innerHTML=state.leagues.map(l=>`<button type="button" data-league-tab="${l.id}" class="${activeLeague===l.id?'active':''}">${l.name}</button>`).join('');holder.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeLeague=b.dataset.leagueTab;renderLeagueTabs()});const body=$('#leagueTableBody');const rows=liveRowsForLeague(activeLeague);if(rows.length){body.innerHTML=rows.map(r=>`<tr class="${r.player_id===session.authUserId?'me':''}"><td>${r.position}</td><td>${playerNameWithCrown(r.player_id,r.username)}</td><td>${r.points}</td><td>${r.wins}</td><td>${r.exact_scores}</td><td>${r.correct_results}</td><td>${r.weeks_played}</td><td>${r.wooden_spoons}</td></tr>`).join('');return}const me=currentUser()?.id;body.innerHTML=seasonSortedLocal(activeLeague).map(p=>`<tr class="${p.id===me?'me':''}"><td>${p.pos}</td><td>${playerNameWithCrown(p.id,p.name)}</td><td>${p.points}</td><td>${p.wins}</td><td>${p.exact}</td><td>${p.correct}</td><td>${p.played}</td><td>${p.spoons}</td></tr>`).join('')}
function renderHistory(){const p=currentUser(),list=$('#historyList');const relevant=state.history.filter(h=>h.leagueId===p.leagueId);if(!relevant.length){list.innerHTML='<div class="notice">No completed historical rounds stored in this prototype yet. Once rounds are completed they can appear here.</div>';return}list.innerHTML=relevant.map(h=>`<div class="result-card"><b>${h.roundName}</b><div>${h.playerPoints} pts · ${h.position}</div></div>`).join('')}
function renderInlinePredictions(){const p=currentUser();if(!p)return;const e=ensureEntry(p.id),locked=predictionLocked(),ed=$('#playerPredictionPanel'),actions=$('#playerPredictionActions');if(!ed||!actions)return;if(locked&&!e.submitted){ed.innerHTML='<div class="notice bad">The cutoff has passed. No predictions were submitted for this round.</div>';actions.innerHTML='';return;}if(!playerDraft||playerDraft.playerId!==p.id)playerDraft={...JSON.parse(JSON.stringify(e)),playerId:p.id};const working=playerDraft;ed.innerHTML=state.round.fixtures.map((f,i)=>`<div class="match-card"><div class="match-line"><div class="team" title="${escapeHtml(f.home)}">${escapeHtml(f.home)}</div><div class="scorectl"><button type="button" data-i="${i}" data-side="0" data-d="-1" ${locked?'disabled':''} aria-label="Decrease ${escapeHtml(f.home)} score">−</button><div class="scorebox ${working.scores[i][0]==null?'blank':''}" id="is${i}h">${working.scores[i][0]??'–'}</div><button type="button" data-i="${i}" data-side="0" data-d="1" ${locked?'disabled':''} aria-label="Increase ${escapeHtml(f.home)} score">+</button></div><div class="versus">vs</div><div class="scorectl"><button type="button" data-i="${i}" data-side="1" data-d="-1" ${locked?'disabled':''} aria-label="Decrease ${escapeHtml(f.away)} score">−</button><div class="scorebox ${working.scores[i][1]==null?'blank':''}" id="is${i}a">${working.scores[i][1]??'–'}</div><button type="button" data-i="${i}" data-side="1" data-d="1" ${locked?'disabled':''} aria-label="Increase ${escapeHtml(f.away)} score">+</button></div><div class="team away" title="${escapeHtml(f.away)}">${escapeHtml(f.away)}</div></div></div>`).join('')+`<div class="minute-card"><div><b>First-goal minute</b><div class="muted">Tie-breaker · 1–90</div></div><div class="minctl"><button id="inlineMinMinus" type="button" ${locked?'disabled':''}>−</button><div class="minval" id="inlineMinuteVal">${working.minute??'–'}</div><button id="inlineMinPlus" type="button" ${locked?'disabled':''}>+</button></div></div>`;ed.querySelectorAll('.scorectl button').forEach(btn=>btn.onclick=()=>{const i=+btn.dataset.i,side=+btn.dataset.side,d=+btn.dataset.d;let v=working.scores[i][side];if(v==null)v=0;else v=Math.max(0,Math.min(20,v+d));working.scores[i][side]=v;const el=$(`#is${i}${side?'a':'h'}`);el.textContent=v;el.classList.remove('blank')});if(!locked){$('#inlineMinMinus').onclick=()=>{working.minute=working.minute==null?1:Math.max(1,working.minute-1);$('#inlineMinuteVal').textContent=working.minute};$('#inlineMinPlus').onclick=()=>{working.minute=working.minute==null?1:Math.min(90,working.minute+1);$('#inlineMinuteVal').textContent=working.minute};actions.innerHTML=`<button class="big-action" id="reviewInlinePred" type="button">${e.submitted?'Review changes':'Review & submit'}</button>`;$('#reviewInlinePred').onclick=()=>reviewInlinePrediction(p,working)}else{actions.innerHTML='<div class="locked-note">🔒 These predictions are locked. You can still view them here.</div>'}}
async function reviewInlinePrediction(p,working){const complete=working.scores.every(s=>s[0]!=null&&s[1]!=null)&&working.minute!=null;if(!complete){const a=$('#playerPredictionActions');a.innerHTML='<div class="notice bad" style="margin-bottom:8px">Complete all six scores and the first-goal minute before submitting.</div><button class="big-action" id="reviewInlinePred" type="button">Review & submit</button>';$('#reviewInlinePred').onclick=()=>reviewInlinePrediction(p,working);return}const rows=state.round.fixtures.map((f,i)=>`<div class="review-row"><span>${escapeHtml(f.home)} v ${escapeHtml(f.away)}</span><b>${working.scores[i][0]} – ${working.scores[i][1]}</b></div>`).join('');modal(`<div class="kicker">Final check</div><h3>Review your predictions</h3><div class="review-grid">${rows}<div class="review-row"><span>First-goal minute</span><b>${working.minute}</b></div></div><div id="submitPredError"></div><div class="modal-actions"><button class="secondary" id="backInlinePred" type="button">Back to predictions</button><button class="big-action" style="width:auto" id="confirmInlinePred" type="button">Confirm & Submit</button></div>`);$('#backInlinePred').onclick=closeModal;$('#confirmInlinePred').onclick=async()=>{const btn=$('#confirmInlinePred'),back=$('#backInlinePred');btn.disabled=true;back.disabled=true;btn.textContent='Saving…';try{const predictions=state.round.fixtures.map((f,i)=>({fixture_id:f.id,home_score:working.scores[i][0],away_score:working.scores[i][1]}));await window.Super6Backend.submitMyPredictions(state.round.id,working.minute,predictions);await refreshMyLiveEntry();closeModal();renderPlayer()}catch(err){const box=$('#submitPredError');if(box)box.innerHTML=`<div class="notice bad" style="margin-top:10px">${escapeHtml(err?.message||'Could not submit predictions.')}</div>`;btn.disabled=false;back.disabled=false;btn.textContent='Confirm & Submit'}}}
function setAdminTab(tab){
 activeAdminTab=tab||'overview';
 $$('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===activeAdminTab));
 $$('[data-admin-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.adminPanel!==activeAdminTab));
}
function renderAdmin(){renderAdminHero();renderFixtureEditor();renderPaymentSettings();renderAdminLeaguePanels();renderResultsEditor();renderWeeklyResults();renderAdminTables();renderAdminChumpions();renderLeagueManagement();renderRealAccountManager();setAdminTab(activeAdminTab)}
function renderAdminHero(){
 if(session.role!=='admin')return;
 const rs=$('#roundState');
 if(!liveRoundExists){
  $('#mSubmitted').textContent='0';$('#mPaid').textContent='0';$('#mPending').textContent='0';$('#mUnpaid').textContent='0';$('#mMissing').textContent=liveStandings.length||state.players.length;
  $('#adminCutoff').textContent='No round published · create the next fixture sheet below';
  rs.textContent='New round';rs.className='chip';return;
 }
 const players=adminRoundOverview.players||[];
 $('#mSubmitted').textContent=players.filter(p=>p.submitted).length;
 $('#mPaid').textContent=players.filter(p=>p.paid).length;
 $('#mPending').textContent=players.filter(p=>p.submitted&&!p.paid&&p.payment_pending).length;
 $('#mUnpaid').textContent=players.filter(p=>p.submitted&&!p.paid&&!p.payment_pending).length;
 $('#mMissing').textContent=players.filter(p=>!p.submitted).length;
 $('#adminCutoff').textContent=`${state.round.name} · cutoff ${fmtDate(cutoff())} · payment grace to ${fmtDate(graceEnd())}`;
 if(state.round.completed){rs.textContent='Completed';rs.className='chip good'}
 else if(predictionLocked()){rs.textContent=paymentLocked()?'Locked':'Predictions locked · payment grace';rs.className='chip warn'}
 else{rs.textContent='Open';rs.className='chip good'}
}
function renderPaymentSettings(){
 const input=$('#paymentUrlInput'),status=$('#paymentUrlStatus');
 if(!input)return;
 if(document.activeElement!==input)input.value=appSettings.payment_url||'';
 if(status&&!appSettings.payment_url)status.textContent='Add your £6 Monzo payment link once. Players will only see it while their entry is unpaid.';
 else if(status)status.textContent='Payment link saved. It is only shown to submitted players who still need to pay.';
}
async function savePaymentUrl(){
 const input=$('#paymentUrlInput'),btn=$('#savePaymentUrlBtn'),status=$('#paymentUrlStatus');
 if(!input||!btn)return;
 const value=input.value.trim();
 if(value){
  let parsed;
  try{parsed=new URL(value)}catch{if(status)status.textContent='Paste the full Monzo payment link, including https://';return}
  if(parsed.protocol!=='https:'){if(status)status.textContent='The payment link must start with https://';return}
 }
 btn.disabled=true;const original=btn.textContent;btn.textContent='Saving…';
 try{
  const saved=await window.Super6Backend.savePaymentUrl(value);
  appSettings.payment_url=String(saved?.payment_url||value||DEFAULT_PAYMENT_URL).trim();
  if(status)status.textContent=value?'Payment link saved.':'The default £6 Monzo link remains active.';
 }catch(err){if(status)status.textContent=err?.message||'Could not save the payment link.'}
 finally{btn.disabled=false;btn.textContent=original}
}
function localDT(iso){const d=new Date(iso),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function renderFixtureEditor(){
 $('#adminRoundName').value=state.round.name||'';$('#adminCutoffInput').value=state.round.cutoff?localDT(state.round.cutoff):'';
 const holder=$('#fixtureEditor');const fixtures=state.round.fixtures?.length===6?state.round.fixtures:cleanRoundDraft().fixtures;
 holder.innerHTML=fixtures.map((f,i)=>`<div class="admin-fixture"><input data-fi="${i}" data-k="home" value="${escapeAttr(f.home||'')}" placeholder="Home team" aria-label="Home team"><input data-fi="${i}" data-k="away" value="${escapeAttr(f.away||'')}" placeholder="Away team" aria-label="Away team"></div>`).join('');
 const cupCheck=$('#chumpionsWeekCheckbox');if(cupCheck)cupCheck.checked=Boolean(state.round.chumpionsLeague);
 const locked=liveRoundExists&&predictionLocked();
 holder.querySelectorAll('input').forEach(inp=>inp.disabled=locked);$('#adminRoundName').disabled=locked;$('#adminCutoffInput').disabled=locked;if(cupCheck)cupCheck.disabled=locked;
 const saveBtn=$('#saveRoundBtn'),nextBtn=$('#startNextRoundBtn');
 saveBtn.disabled=locked;saveBtn.style.opacity=locked?.45:1;saveBtn.classList.toggle('hidden',Boolean(state.round.completed));
 if(nextBtn)nextBtn.classList.toggle('hidden',!Boolean(state.round.completed));
}
function startNextRound(){
 state.round=cleanRoundDraft();liveRoundExists=false;liveWeeklyResults=[];adminRoundOverview={leagues:[],players:[]};playerDraft=null;renderAdmin();
 $('#resultValidation').textContent='New blank round ready. Enter six fixtures and a future cutoff, then publish.';
}
async function saveRound(){const locked=liveRoundExists&&predictionLocked();if(locked)return;const btn=$('#saveRoundBtn'),original=btn.textContent;const name=$('#adminRoundName').value.trim();const rawCutoff=$('#adminCutoffInput').value;const d=new Date(rawCutoff);const fixtures=Array.from($('#fixtureEditor').querySelectorAll('.admin-fixture')).map(row=>{const inputs=row.querySelectorAll('input');return{home:inputs[0].value.trim(),away:inputs[1].value.trim()}});if(!name){alert('Enter a round name.');return}if(!rawCutoff||Number.isNaN(d.getTime())||d.getTime()<=Date.now()){alert('Choose a cutoff date and time in the future.');return}if(fixtures.some(f=>!f.home||!f.away)){alert('Enter both teams for all six fixtures.');return}btn.disabled=true;btn.textContent='Publishing…';try{await window.Super6Backend.saveAndPublishRound({roundId:liveRoundExists?state.round.id:null,name,cutoffAt:d.toISOString(),fixtures,chumpionsLeague:Boolean($('#chumpionsWeekCheckbox')?.checked)});await refreshLiveRound();await Promise.all([refreshAdminRoundOverview(),refreshChumpionsState()]);renderAdmin();alert(state.round.chumpionsLeague?'Round saved. This week also counts for Chumpions League.':'Round saved and published to Supabase.')}catch(err){alert(err?.message||'Could not save the round.')}finally{btn.disabled=false;btn.textContent=original;renderFixtureEditor()}}
function renderAdminLeaguePanels(){
 const wrap=$('#adminLeaguePanels');
 if(!liveRoundExists){wrap.innerHTML='<div class="notice">Publish the next round in the <b>Round</b> tab to start tracking submissions and payment.</div>';return;}
 const leagues=adminRoundOverview.leagues||[],players=adminRoundOverview.players||[];
 if(!players.length){wrap.innerHTML='<div class="notice">Loading the live Supabase entry overview…</div>';return;}
 wrap.innerHTML=leagues.map(l=>{
  const ps=players.filter(p=>p.league_id===l.id);
  const sub=ps.filter(p=>p.submitted).length;
  const paid=ps.filter(p=>p.paid).length;
  const pending=ps.filter(p=>p.submitted&&!p.paid&&p.payment_pending).length;
  const unpaid=ps.filter(p=>p.submitted&&!p.paid&&!p.payment_pending).length;
  const miss=ps.filter(p=>!p.submitted).length;
  const counted=ps.filter(p=>p.submitted&&p.paid).length;
  return `<div class="league-panel"><h4>${escapeHtml(l.name)}</h4><div class="status-summary"><span class="status-pill submitted"><b>${sub}</b> Submitted</span><span class="status-pill paid"><b>${paid}</b> Paid</span><span class="status-pill pending"><b>${pending}</b> Pending</span><span class="status-pill unpaid"><b>${unpaid}</b> Unpaid</span><span class="status-pill missing"><b>${miss}</b> Not entered</span></div>${ps.map(p=>{
   const result=state.round.completed?weeklyResultForPlayer(p.id):null;
   const points=result?`<span class="overview-points">${Number(result.points||0)} pts</span>`:'';
   const paymentStatus=p.paid?'<span class="status-pill mini paid">Paid</span>':p.submitted&&p.payment_pending?'<span class="status-pill mini pending">Payment pending</span>':p.submitted?'<span class="status-pill mini unpaid">Unpaid</span>':'';
   return `<div class="player-row"><button class="secondary small name" data-view="${p.id}" type="button" style="text-align:left"><b>${playerNameWithCrown(p.id,p.username)}${points}</b><span class="player-statuses"><span class="status-pill mini ${p.submitted?'submitted':'missing'}">${p.submitted?'Submitted':'Not entered'}</span>${paymentStatus}${state.round.completed&&p.submitted&&p.paid&&!result?'<span class="status-pill mini missing">Not counted</span>':''}</span></button><label class="switch"><input type="checkbox" data-paid="${p.id}" ${p.paid?'checked':''} ${paymentLocked()?'disabled':''}> Paid</label></div>`;
  }).join('')}<div class="money">Pot currently: <strong>£${counted*state.round.fee}</strong></div></div>`;
 }).join('');
 wrap.querySelectorAll('[data-paid]').forEach(x=>x.onchange=async()=>{
  const desired=x.checked,playerId=x.dataset.paid;
  x.disabled=true;
  try{await window.Super6Backend.setAdminPayment(state.round.id,playerId,desired);await refreshAdminRoundOverview();if(state.round.completed){await Promise.all([refreshLiveWeeklyResults(),refreshLiveStandings(),refreshLatestLeagueWinners(),refreshChumpionsState()])}renderAdminHero();renderAdminLeaguePanels();if(state.round.completed){renderWeeklyResults();renderAdminTables();renderAdminChumpions()}}
  catch(err){alert(err?.message||'Could not update payment status.');await refreshAdminRoundOverview().catch(()=>{});renderAdminHero();renderAdminLeaguePanels()}
 });
 wrap.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>adminViewPlayer(x.dataset.view));
}
async function adminViewPlayer(playerId){
 const p=(adminRoundOverview.players||[]).find(x=>x.id===playerId);
 if(!p)return;
 const result=state.round.completed?weeklyResultForPlayer(playerId):null;
 const headline=result?` · ${Number(result.points||0)} points · position ${Number(result.position||0)}`:'';
 const payLabel=p.paid?'Paid':p.payment_pending?'Payment pending':'Unpaid';
 modal(`<div class="section-head"><div><div class="kicker">Admin entry view</div><h3>${escapeHtml(p.username)}</h3><div class="muted">${escapeHtml(p.league_name||'')} · ${payLabel}${headline}</div></div><button class="secondary small" id="closeAdminView">Close</button></div><div id="liveAdminEntry"><div class="muted">Loading live entry…</div></div>`);
 $('#closeAdminView').onclick=closeModal;
 const box=$('#liveAdminEntry');
 try{
  const live=await window.Super6Backend.loadAdminPlayerEntry(state.round.id,playerId);
  if(!live?.entry){box.innerHTML='<div class="notice">No predictions have been submitted for this round.</div>';return;}
  const byFixture=new Map((live.predictions||[]).map(x=>[x.fixture_id,x]));
  const matches=state.round.fixtures.map(f=>{const x=byFixture.get(f.id);return `<div class="review-row"><span>${escapeHtml(f.home)} v ${escapeHtml(f.away)}</span><b>${x?`${x.home_score} – ${x.away_score}`:'–'}</b></div>`}).join('');
  const resultSummary=result?`<div class="admin-result-summary"><div><strong>${Number(result.points||0)}</strong><span>Points</span></div><div><strong>${Number(result.position||0)}</strong><span>Position</span></div><div><strong>${Number(result.exact_scores||0)}</strong><span>Correct scores</span></div><div><strong>${Number(result.correct_results||0)}</strong><span>Correct results</span></div></div>`:'';
  const breakdown=state.round.completed?scoreBreakdownHTML(f=>{const x=byFixture.get(f.id);return x?[Number(x.home_score),Number(x.away_score)]:null}):'';
  const tie=state.round.completed&&state.round.officialMinute!=null?`<div class="tie-break-summary"><b>First-goal tiebreak:</b> Player chose ${live.entry.first_goal_minute??'–'}' · Official ${state.round.officialMinute}'${live.entry.first_goal_minute!=null?` · Difference ${Math.abs(Number(live.entry.first_goal_minute)-Number(state.round.officialMinute))} min`:''}</div>`:'';
  box.innerHTML=`${resultSummary}${matches}<div class="review-row"><span>First-goal minute</span><b>${live.entry.first_goal_minute??'–'}</b></div>${breakdown}${tie}${state.round.completed&&!result?'<div class="notice" style="margin-top:12px">This entry was not counted in the weekly result (for example, payment was not confirmed).</div>':''}`;
 }catch(err){box.innerHTML=`<div class="notice bad">${escapeHtml(err?.message||'Could not load this entry.')}</div>`}
}
function adminEditPrediction(pid){const p=getPlayer(pid),e=ensureEntry(pid);let w=JSON.parse(JSON.stringify(e));modal(`<div class="kicker">Admin edit</div><h3>${p.name}</h3><div id="adminPredEdit"></div><div class="modal-actions"><button class="secondary" id="cancelAdminEdit">Cancel</button><button class="big-action" style="width:auto" id="saveAdminEdit">Save edit</button></div>`);const box=$('#adminPredEdit');box.innerHTML=state.round.fixtures.map((f,i)=>`<div class="review-row"><span>${f.home} v ${f.away}</span><span><input data-i="${i}" data-s="0" type="number" min="0" max="20" value="${w.scores[i][0]??''}" style="width:52px"> – <input data-i="${i}" data-s="1" type="number" min="0" max="20" value="${w.scores[i][1]??''}" style="width:52px"></span></div>`).join('')+`<label class="field">First-goal minute<input id="adminMinuteEdit" type="number" min="1" max="90" value="${w.minute??''}"></label>`;$('#cancelAdminEdit').onclick=closeModal;$('#saveAdminEdit').onclick=()=>{box.querySelectorAll('input[data-i]').forEach(inp=>{w.scores[+inp.dataset.i][+inp.dataset.s]=inp.value===''?null:Math.max(0,Math.min(20,+inp.value))});w.minute=Math.max(1,Math.min(90,+$('#adminMinuteEdit').value||1));e.scores=w.scores;e.minute=w.minute;e.adminEdits.push({time:new Date().toISOString(),text:`Edited by Admin at ${new Date().toLocaleString('en-GB')}`});save();closeModal();renderAdmin()}}
function renderResultsEditor(){const h=$('#resultsEditor');if(!liveRoundExists){h.innerHTML='<div class="notice">No round published yet.</div>';$('#officialMinute').value='';$('#officialMinute').disabled=true;$('#completeRoundBtn').disabled=true;$('#reopenRoundBtn').classList.add('hidden');return;}$('#officialMinute').disabled=false;$('#completeRoundBtn').disabled=false;h.innerHTML=state.round.fixtures.map((f,i)=>`<div class="${f.removed?'result-entry removed':'result-entry'}"><div>${f.home}</div><input data-ri="${i}" data-rs="0" type="number" min="0" max="20" value="${f.result?.[0]??''}"><span>–</span><input data-ri="${i}" data-rs="1" type="number" min="0" max="20" value="${f.result?.[1]??''}"><div class="away">${f.away}<label class="remove-line"><input data-remove="${i}" type="checkbox" ${f.removed?'checked':''}> postponed / abandoned</label></div></div>`).join('');$('#officialMinute').value=state.round.officialMinute??'';$('#reopenRoundBtn').classList.toggle('hidden',!state.round.completed);$('#completeRoundBtn').textContent=state.round.completed?'Save corrections & recalculate':'Complete Round';h.querySelectorAll('[data-remove]').forEach(c=>c.onchange=()=>{state.round.fixtures[+c.dataset.remove].removed=c.checked;renderResultsEditor()})}
async function completeRound(){
 if(!liveRoundExists||!state.round?.id)return;
 let ok=true,totalGoals=0;
 $('#resultsEditor').querySelectorAll('input[data-ri]').forEach(inp=>{
  const f=state.round.fixtures[+inp.dataset.ri];if(f.removed)return;
  if(inp.value===''){ok=false;return}
  f.result=f.result||[0,0];f.result[+inp.dataset.rs]=Math.max(0,Math.min(20,+inp.value));
 });
 state.round.fixtures.filter(f=>!f.removed).forEach(f=>{if(!f.result||f.result[0]==null||f.result[1]==null)ok=false;else totalGoals+=Number(f.result[0])+Number(f.result[1])});
 const rawMinute=$('#officialMinute').value;
 let officialMinute=null;
 if(totalGoals>0){
  if(rawMinute===''||+rawMinute<1||+rawMinute>90)ok=false;else officialMinute=Math.max(1,Math.min(90,+rawMinute));
 }
 if(!ok){$('#resultValidation').textContent=totalGoals>0?'Enter both scores for every active fixture and the official first-goal minute.':'Enter both scores for every active fixture.';return}
 const btn=$('#completeRoundBtn'),original=btn.textContent;btn.disabled=true;btn.textContent=state.round.completed?'Recalculating…':'Calculating…';$('#resultValidation').textContent='Saving results to Supabase…';
 try{
  const updated=await window.Super6Backend.completeRound(state.round.id,state.round.fixtures,officialMinute);
  state.round=mapLiveRound(updated);liveRoundExists=true;save();
  await Promise.all([refreshLiveStandings(),refreshAdminRoundOverview(),refreshLiveWeeklyResults(),refreshLatestLeagueWinners(),refreshChumpionsState()]);
  renderAdmin();
  $('#resultValidation').textContent='Round calculated in Supabase. Payment changes during the grace window will recalculate automatically.';
 }catch(err){$('#resultValidation').textContent=err?.message||'Could not complete the round.'}
 finally{btn.disabled=false;btn.textContent=original;renderResultsEditor()}
}
function applyRoundToDisplayOnly(){save()}
function renderWeeklyResults(){
 const box=$('#weeklyResults'),money=$('#moneySummary');
 if(!liveRoundExists){box.innerHTML='<div class="notice">No round published yet.</div>';money.innerHTML='';$('#posterBtn').disabled=true;return;}
 if(!state.round.completed){box.innerHTML='<div class="notice">Complete the round to calculate league winners.</div>';money.innerHTML='';$('#posterBtn').disabled=true;return}
 $('#posterBtn').disabled=!liveWeeklyResults.length;
 const awardNames=a=>a.map(r=>`<span class="weekly-award-name">${escapeHtml(r.p.name)} <b>${r.points} pts</b></span>`).join('');
 box.innerHTML=state.leagues.map(l=>{
  const o=liveWeeklyOutcome(l.id);
  if(!o.rows.length)return`<div class="result-card weekly-outcome-card"><div class="weekly-outcome-head"><div><div class="kicker">League result</div><h4>${escapeHtml(l.name)}</h4></div><span class="weekly-entry-count">0 counted entries</span></div><div class="notice">No eligible paid entries.</div></div>`;
  const second=o.first.length===1&&o.second.length?`<div class="weekly-award second"><span class="weekly-award-label">🥈 2nd place</span><div class="weekly-award-names">${awardNames(o.second)}</div></div>`:'';
  return`<div class="result-card weekly-outcome-card"><div class="weekly-outcome-head"><div><div class="kicker">League result</div><h4>${escapeHtml(l.name)}</h4></div><span class="weekly-entry-count">${o.rows.length} counted entr${o.rows.length===1?'y':'ies'}</span></div><div class="weekly-outcome-layout"><div class="weekly-awards"><div class="weekly-award winner"><span class="weekly-award-label">👑 1st place</span><div class="weekly-award-names">${awardNames(o.first)}</div></div>${second}<div class="weekly-award spoon"><span class="weekly-award-label">🥄 Wooden spoon</span><div class="weekly-award-names">${awardNames(o.spoons)}</div></div></div><div class="weekly-ranking-panel"><div class="weekly-ranking-title">Full league result</div>${weeklyRankingHTML(o)}</div></div></div>`;
 }).join('');
 const players=adminRoundOverview.players||[];
 money.innerHTML='<div class="money"><b>Admin-only money view</b>'+state.leagues.map(l=>{const leagueId=(adminRoundOverview.leagues||[]).find(x=>x.name===l.name)?.id;const count=players.filter(p=>p.league_id===leagueId&&p.submitted&&p.paid).length;return`<div>${escapeHtml(l.name)}: ${count} paid entries × £${state.round.fee} = <strong>£${count*state.round.fee}</strong></div>`}).join('')+'</div>';
}
function renderAdminTables(){
 const tabs=$('#adminTableLeagueTabs'),body=$('#adminLeagueTableBody'),title=$('#adminLeagueTableTitle');
 if(!tabs||!body)return;
 if(!state.leagues.some(l=>l.id===activeAdminLeague))activeAdminLeague=state.leagues[0]?.id;
 tabs.innerHTML=state.leagues.map(l=>`<button type="button" data-admin-league-table="${l.id}" class="${activeAdminLeague===l.id?'active':''}">${escapeHtml(l.name)}</button>`).join('');
 tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{activeAdminLeague=b.dataset.adminLeagueTable;renderAdminTables()});
 const rows=liveRowsForLeague(activeAdminLeague);
 if(title)title.textContent=leagueName(activeAdminLeague);
 if(!rows.length){body.innerHTML='<tr><td colspan="8">No standings available.</td></tr>';return}
 body.innerHTML=rows.map(r=>`<tr><td>${r.position}</td><td>${playerNameWithCrown(r.player_id,r.username)}</td><td>${r.points}</td><td>${r.wins}</td><td>${r.exact_scores}</td><td>${r.correct_results}</td><td>${r.weeks_played}</td><td>${r.wooden_spoons}</td></tr>`).join('');
}

async function renderRealAccountManager(){
 const list=$('#realPlayerAccountList'),leagueSel=$('#realPlayerLeague'),status=$('#accountManagerStatus'),createBtn=$('#createRealPlayerBtn'),bulkBtn=$('#bulkCreatePendingBtn');
 if(!list||!leagueSel||!status||!createBtn||session.role!=='admin')return;
 const load=++accountManagerLoad;
 list.innerHTML='<div class="muted">Loading accounts…</div>';
 try{
  const data=await window.Super6Backend.listAccountManagerData();
  if(load!==accountManagerLoad||session.role!=='admin')return;
  const leagues=data.leagues||[],players=data.players||[];
  const leagueMap=Object.fromEntries(leagues.map(l=>[l.id,l.name]));
  const previous=leagueSel.value;
  leagueSel.innerHTML=leagues.map(l=>`<option value="${l.id}">${l.name}</option>`).join('');
  if(previous&&leagues.some(l=>l.id===previous))leagueSel.value=previous;
  list.innerHTML=players.length?players.map(p=>`<div class="account-row"><div class="account-person"><b>${escapeHtml(p.username)}</b><small>${escapeHtml(leagueMap[p.league_id]||'No league')}</small></div><button class="secondary small" data-real-reset="${p.id}" data-real-name="${escapeAttr(p.username)}" type="button">Reset PIN</button></div>`).join(''):'<div class="notice">No real player accounts yet.</div>';
  list.querySelectorAll('[data-real-reset]').forEach(b=>b.onclick=()=>showResetPin(b.dataset.realReset,b.dataset.realName));
  createBtn.onclick=createRealPlayer;
  if(bulkBtn)bulkBtn.onclick=bulkCreatePendingPlayers;
 }catch(err){
  if(load!==accountManagerLoad)return;
  list.innerHTML='<div class="notice bad">'+escapeHtml(err?.message||'Could not load real player accounts.')+'</div>';
 }
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(v){return escapeHtml(v)}
async function createRealPlayer(){
 const name=$('#realPlayerName').value.trim(),pin=$('#realPlayerPin').value.trim(),leagueId=$('#realPlayerLeague').value,status=$('#accountManagerStatus'),btn=$('#createRealPlayerBtn');
 if(!name){status.textContent='Enter the player username.';return}
 if(!/^\d{4}$/.test(pin)){status.textContent='PIN must be exactly 4 digits.';return}
 if(!leagueId){status.textContent='Choose a league.';return}
 const localMatch=state.players.find(p=>p.name.toLowerCase()===name.toLowerCase());
 if(!localMatch){
  if(!confirm(`${name} is not in the current prototype season list. Create the secure login anyway? They will not see working weekly data until the Supabase data migration is finished.`))return;
 }
 btn.disabled=true;btn.textContent='Creating…';status.textContent='Creating secure account…';
 try{
  await window.Super6Backend.createPlayerAccount(name,pin,leagueId);
  $('#realPlayerName').value='';$('#realPlayerPin').value='';status.textContent=`${name} created successfully.`;
  await renderRealAccountManager();
 }catch(err){status.textContent=err?.message||'Could not create player.'}
 finally{btn.disabled=false;btn.textContent='Create player login'}
}
async function bulkCreatePendingPlayers(){
 const btn=$('#bulkCreatePendingBtn'),status=$('#accountManagerStatus');
 if(!btn||!status)return;
 if(!confirm('Create secure Supabase accounts for every staged 2026/27 player who does not already exist? No PINs will be assigned, so they cannot log in until you set a PIN for them.'))return;
 btn.disabled=true;btn.textContent='Creating staged accounts…';status.textContent='Creating staged player accounts. This can take a little while…';
 try{
  const result=await window.Super6Backend.bulkCreatePendingPlayers();
  const failed=result.failed_count||0,created=result.created_count||0,skipped=result.skipped_count||0;
  status.textContent=`Bulk setup finished: ${created} created · ${skipped} skipped · ${failed} failed.`;
  await renderRealAccountManager();
  const refreshed=$('#accountManagerStatus');if(refreshed)refreshed.textContent=`Bulk setup finished: ${created} created · ${skipped} skipped · ${failed} failed.`;
 }catch(err){status.textContent=err?.message||'Bulk player setup failed.'}
 finally{btn.disabled=false;btn.textContent='Create staged players (no PIN)'}
}
function showResetPin(userId,name){
 modal(`<div class="kicker">Secure account</div><h3>Reset PIN</h3><div class="muted">${escapeHtml(name)}</div><label class="field">New 4-digit PIN<input id="resetRealPin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="••••" autocomplete="new-password"></label><div id="resetRealStatus" class="muted"></div><div class="modal-actions"><button class="secondary" id="cancelRealReset" type="button">Cancel</button><button class="big-action" style="width:auto" id="confirmRealReset" type="button">Reset PIN</button></div>`);
 $('#cancelRealReset').onclick=closeModal;
 $('#confirmRealReset').onclick=async()=>{const pin=$('#resetRealPin').value.trim(),msg=$('#resetRealStatus'),btn=$('#confirmRealReset');if(!/^\d{4}$/.test(pin)){msg.textContent='PIN must be exactly 4 digits.';return}btn.disabled=true;btn.textContent='Resetting…';try{await window.Super6Backend.resetPlayerPin(userId,pin);closeModal();const status=$('#accountManagerStatus');if(status)status.textContent=`PIN reset for ${name}.`;await renderRealAccountManager()}catch(err){msg.textContent=err?.message||'Could not reset PIN.';btn.disabled=false;btn.textContent='Reset PIN'}}
}
function renderAdminChumpions(){
 const week=$('#adminChumpionsCurrentWeek'),roster=$('#adminChumpionsRoster'),standings=$('#adminChumpionsStandings'),knockout=$('#adminChumpionsKnockout');if(!week||!roster||!standings)return;
 if(chumpionsError){week.innerHTML=`<div class="notice bad">${escapeHtml(chumpionsError)}</div>`;roster.innerHTML='';standings.innerHTML='';if(knockout)knockout.innerHTML='';return}
 const members=chumpionsMemberMap(),players=chumpionsState.players||[],confirmed=chumpionsGroupConfirmed();
 const currentMatches=state.round?.id?chumpionsMatchesForRound(state.round.id):[];
 const currentKo=state.round?.id?chumpionsKnockoutForRound(state.round.id):[];
 if(!liveRoundExists){
  const nextStage=['R16','QF','SF','F'].find(st=>chumpionsKnockoutForStage(st).some(m=>m.status!=='completed'));
  week.innerHTML=`<div class="notice">Create the next Super 6 round first. ${confirmed&&nextStage?`When you are ready for the <b>${escapeHtml(chumpionsStageLabel(nextStage))}</b>, tick <b>Chumpions League week</b> on that round.`:'Tick <b>Chumpions League week</b> whenever you want a normal Super 6 round to count for this competition.'}</div>`;
 }else if(!state.round.chumpionsLeague){
  const nextStage=confirmed?['R16','QF','SF','F'].find(st=>chumpionsKnockoutForStage(st).some(m=>m.status!=='completed')):null;
  week.innerHTML=`<div class="notice">${escapeHtml(state.round.name)} is a normal league week only.${nextStage?` When you are ready to play the <b>${escapeHtml(chumpionsStageLabel(nextStage))}</b>, tick the Chumpions checkbox in <b>Round</b> before the cutoff.`:' To use it for Chumpions League, tick the checkbox in <b>Round</b> before the cutoff.'}</div>`;
 }else if(confirmed){
  if(currentKo.length){
   const stage=currentKo[0].stage;
   week.innerHTML=`<div class="chumpions-week-banner"><b>🏆 ${escapeHtml(state.round.name)} · ${escapeHtml(chumpionsStageLabel(stage))}</b><span>This stage was attached automatically because you manually ticked this round as a Chumpions League week.</span></div><div class="chumpions-current-ko">${currentKo.map(m=>chumpionsKnockoutMatchHTML(m,{admin:true})).join('')}</div>`;
  }else week.innerHTML=`<div class="notice">${escapeHtml(state.round.name)} is marked as a Chumpions League week, but there is no knockout stage waiting to be attached.</div>`;
 }else{
  const groupEditors=['A','B','C','D'].map(group=>{
   const gm=chumpionsMembersFor(group),matches=currentMatches.filter(m=>m.group_code===group),bye=chumpionsGroupByeForRound(group,state.round.id),matchday=chumpionsGroupMatchdayNumber(group,state.round.id),total=chumpionsGroupMatchdayTotal(group),playedDays=chumpionsGroupRoundIds(group).length;
   const head=`<div class="chumpions-group-title"><h4>Group ${group}</h4><span>${matchday?`Matchday ${matchday}${total?` / ${total}`:''}`:playedDays>=total&&total?`Schedule complete`:`${gm.length} players`}</span></div>`;
   let body='';
   if(matches.length){
    body=matches.map(m=>chumpionsMatchRow(m)).join('');
    if(bye.length)body+=`<div class="chumpions-bye"><span>BYE</span><b>${bye.map(x=>escapeHtml(x.username)).join(', ')}</b></div>`;
   }else if(total&&playedDays>=total){body='<div class="notice good">All group-stage pairings for this group have been played or scheduled.</div>'}
   else if(gm.length<2){body='<div class="notice">Assign at least two players to this group before using a Chumpions week.</div>'}
   else{body='<div class="notice bad">Automatic fixtures are not present yet. Go to Round and press Save again to generate this Chumpions matchday.</div>'}
   return `<div class="chumpions-fixture-group">${head}${body}</div>`
  }).join('');
  week.innerHTML=`<div class="chumpions-week-banner"><b>🏆 ${escapeHtml(state.round.name)} counts for Chumpions League</b><span>The app has generated the next round-robin matchday automatically. Every player meets every other player once; odd-sized groups rotate one bye each matchday.</span></div><div class="chumpions-auto-note"><b>No manual pairing needed.</b> Untick this round before results are completed if you do not want this week to count; the generated fixtures will be removed and the same matchday will be used next time.</div><div class="chumpions-fixture-grid">${groupEditors}</div>`;
 }
 const rotationStarted=chumpionsRotationStarted(),groupsLocked=confirmed||rotationStarted;
 const renderRoster=(q='')=>{const term=String(q||'').trim().toLowerCase();const rows=players.filter(p=>!term||String(p.username||'').toLowerCase().includes(term));const lockNote=confirmed?'<div class="notice good">Group stage confirmed. Player groups are now locked for this Chumpions League.</div>':rotationStarted?'<div class="notice"><b>Group rotation has started.</b> Groups are locked so the automatic schedule cannot miss or repeat a player. If this is only the first unplayed matchday, untick that Chumpions week first to amend the groups.</div>':'<div class="notice">Finish assigning the groups before saving the first Chumpions League week. Once the automatic rotation starts, the group roster locks.</div>';roster.innerHTML=`${lockNote}<div class="chumpions-roster">${rows.map(p=>{const m=members.get(String(p.id));return `<div class="chumpions-roster-row"><b>${escapeHtml(p.username)}</b><select data-chumpions-member="${escapeAttr(p.id)}" data-last="${escapeAttr(m?.group_code||'')}" ${groupsLocked?'disabled':''}><option value="" ${!m?'selected':''}>Not entered</option>${['A','B','C','D'].map(g=>`<option value="${g}" ${m?.group_code===g?'selected':''}>Group ${g}</option>`).join('')}</select></div>`}).join('')}</div>`;if(!groupsLocked)roster.querySelectorAll('[data-chumpions-member]').forEach(sel=>sel.onchange=async()=>{const before=sel.dataset.last??'';sel.disabled=true;try{await window.Super6Backend.setChumpionsMember(sel.dataset.chumpionsMember,sel.value||null);await refreshChumpionsState();renderAdminChumpions()}catch(err){alert(err?.message||'Could not update the group.');sel.value=before}finally{sel.disabled=false}})};
 const search=$('#chumpionsPlayerSearch');if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',()=>renderRoster(search.value))}renderRoster(search?.value||'');
 standings.innerHTML=chumpionsStandingsHTML();
 if(knockout){
  if(!confirmed){
   const problem=chumpionsQualifierProblem();
   knockout.innerHTML=`<div class="chumpions-confirm-box"><div><div class="kicker">When the group stage is finished</div><h4>Confirm final standings & build the Round of 16</h4><p>The app will take the top four from Groups A–D and seed A1 v B4, B1 v A4, C1 v D4, D1 v C4, A2 v B3, B2 v A3, C2 v D3 and D2 v C3.</p>${problem?`<div class="notice">${escapeHtml(problem)}</div>`:'<div class="notice good">The displayed top four in every group are ready to be confirmed.</div>'}</div><button class="big-action" id="confirmChumpionsGroupsBtn" type="button" ${problem?'disabled':''}>Confirm groups & create Round of 16</button></div>`;
   const btn=$('#confirmChumpionsGroupsBtn');if(btn&&!problem)btn.onclick=async()=>{if(!confirm('Lock the final group standings and create the Round of 16? Group membership will be locked after this.'))return;btn.disabled=true;btn.textContent='Building bracket…';try{await window.Super6Backend.confirmChumpionsGroups(chumpionsQualifierPayload());await refreshChumpionsState();renderAdminChumpions()}catch(err){alert(err?.message||'Could not build the Round of 16.');btn.disabled=false;btn.textContent='Confirm groups & create Round of 16'}};
  }else{
   const finalists=(chumpionsState.finalists||[]).map(f=>`<span>Group ${f.group_code}${f.position}: <b>${escapeHtml(chumpionsName(f.player_id))}</b></span>`).join('');
   knockout.innerHTML=`<div class="notice good"><b>Group stage confirmed.</b> The knockout bracket is now locked. To play each stage, simply tick a future Super 6 round as a Chumpions League week.</div><div class="chumpions-finalists">${finalists}</div>${chumpionsBracketHTML({admin:true})}`;
   knockout.querySelectorAll('[data-chumpions-advance]').forEach(btn=>btn.onclick=async()=>{const matchId=btn.dataset.chumpionsAdvance,playerId=btn.dataset.player,name=chumpionsName(playerId);if(!confirm(`Advance ${name} from this tied Chumpions match?`))return;btn.disabled=true;try{await window.Super6Backend.chooseChumpionsKnockoutWinner(matchId,playerId);await refreshChumpionsState();renderAdminChumpions()}catch(err){alert(err?.message||'Could not save the Admin decision.')}finally{btn.disabled=false}});
  }
 }
}

function renderLeagueManagement(){const list=$('#leagueManageList');list.innerHTML=state.leagues.map(l=>`<div class="inline" style="margin-bottom:7px"><input data-lname="${l.id}" value="${l.name}" style="flex:1"><button data-rename="${l.id}" class="secondary small" type="button">Rename</button></div>`).join('');list.querySelectorAll('[data-rename]').forEach(b=>b.onclick=()=>{const id=b.dataset.rename,v=list.querySelector(`[data-lname="${id}"]`).value.trim();if(v){state.leagues.find(l=>l.id===id).name=v;save();renderAdmin()}});$('#movePlayerSelect').innerHTML=state.players.map(p=>`<option value="${p.id}">${p.name} — ${leagueName(p.leagueId)}</option>`).join('');$('#moveLeagueSelect').innerHTML=state.leagues.map(l=>`<option value="${l.id}">${l.name}</option>`).join('')}
function addLeague(){const n=$('#newLeagueName').value.trim();if(!n)return;state.leagues.push({id:'l'+Date.now(),name:n});$('#newLeagueName').value='';save();renderAdmin()}
function movePlayer(){const p=getPlayer($('#movePlayerSelect').value),lid=$('#moveLeagueSelect').value;if(!p||p.leagueId===lid)return;const from=leagueName(p.leagueId);p.leagueId=lid;const txt=`${p.name} moved from ${from} to ${leagueName(lid)}. Season points and stats moved with them.`;$('#moveAudit').textContent=txt;state.round.audit.push({time:new Date().toISOString(),text:txt});save();renderAdmin()}
function posterData(){return state.leagues.map(l=>({league:l.name,out:state.round.completed?liveWeeklyOutcome(l.id):null}))}
function showPoster(){const fixtures=state.round.fixtures.filter(f=>!f.removed);const pdata=posterData();modal(`<div class="section-head"><div><div class="kicker">WhatsApp export</div><h3>Retro weekly summary</h3><div class="muted">Styled like an old football programme, using the live round data.</div></div><button class="secondary small" id="closePoster">Close</button></div><div class="poster-preview" id="posterPreview"><div class="sub">SIX GAMES · ONE PASSION</div><h2>SUPER 6</h2><div class="poster-week">${state.round.name.toUpperCase()} RESULTS</div><div class="poster-ribbon">REAL MATCHES · REAL DRAMA · FIRST GOAL ${state.round.officialMinute}'</div><div class="poster-box" style="margin-top:14px"><h4>THIS WEEK'S MATCH RESULTS</h4>${fixtures.map(f=>`<div class="poster-match"><span>${f.home}</span><b>${f.result[0]} – ${f.result[1]}</b><span>${f.away}</span></div>`).join('')}</div><div class="poster-grid">${pdata.map(x=>{const o=x.out,n=a=>a.map(r=>`${r.p.name} · ${r.points} pts`).join('<br>');return`<div class="poster-box"><h4>${x.league}</h4>${o&&o.rows.length?`<div class="award"><span class="award-label">👑 1st place</span><b>${n(o.first)}</b></div>${o.first.length===1&&o.second.length?`<div class="award"><span class="award-label">🥈 2nd Place</span><b>${n(o.second)}</b></div>`:''}<div class="award"><span class="award-label">🥄 Wooden Spoon</span><b>${n(o.spoons)}</b></div>`:'No eligible entries'}</div>`}).join('')}</div><div class="sub" style="margin-top:14px">PREDICTIONS · RIVALRY · BANTER · GLORY</div></div><div class="modal-actions"><button class="big-action" style="width:auto" id="downloadPoster">Download PNG</button></div>`);$('#closePoster').onclick=closeModal;$('#downloadPoster').onclick=downloadPosterPNG}
function escapeXml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function downloadPosterPNG(){const W=1080,H=1620,cream='#efe2bd',paper='#f5e9c8',green='#17462d',deep='#103421',red='#8d3b2d',ink='#193322',gold='#c9a45d',black='#1d211b';const fixtures=state.round.fixtures.filter(f=>!f.removed),data=posterData(),safe=escapeXml;const roundLabel=safe(state.round.name.toUpperCase());let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="8" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g"><feFuncA type="table" tableValues="0 .16"/></feComponentTransfer></filter><filter id="rough"><feTurbulence baseFrequency=".025" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2"/></filter></defs><rect width="1080" height="1620" fill="${green}"/><rect width="1080" height="1620" filter="url(#grain)" opacity=".8"/><rect x="24" y="24" width="1032" height="1572" rx="8" fill="none" stroke="${cream}" stroke-width="5" filter="url(#rough)"/><text x="58" y="68" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">SIX</text><text x="58" y="95" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">GAMES</text><text x="58" y="122" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">ONE</text><text x="58" y="149" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">PASSION</text><text x="540" y="145" text-anchor="middle" fill="${cream}" stroke="#3e241b" stroke-width="3" paint-order="stroke" font-family="Impact,Arial Black" font-size="118" letter-spacing="3">SUPER 6</text><text x="540" y="210" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="54" letter-spacing="2">${roundLabel} RESULTS</text><path d="M265 228H815L790 274H290Z" fill="${red}"/><text x="540" y="258" text-anchor="middle" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="18" letter-spacing="2">REAL MATCHES · REAL DRAMA · FIRST GOAL ${state.round.officialMinute}'</text>`;svg+=`<g transform="translate(108 145) rotate(-12)" fill="${black}" opacity=".88"><circle cx="0" cy="-42" r="18"/><path d="M-12 -24L18 -18L38 18L20 28L7 5L-4 40L-22 82L-43 76L-24 32L-20 -8Z"/><path d="M17 -10L55 -28L61 -18L31 6Z"/><path d="M-1 37L31 69L18 82L-14 54Z"/></g><g transform="translate(935 145)" fill="none" stroke="${cream}" stroke-width="4" opacity=".9"><circle cx="0" cy="0" r="54"/><path d="M0 -25L24 -8L15 20H-15L-24 -8Z"/><path d="M0 -25L0 -54M24 -8L51 -18M15 20L31 46M-15 20L-31 46M-24 -8L-51 -18"/></g>`;svg+=`<rect x="120" y="300" width="840" height="350" rx="6" fill="${paper}" stroke="${cream}" stroke-width="5"/><text x="540" y="345" text-anchor="middle" fill="${ink}" font-family="Impact,Arial Black" font-size="35">THIS WEEK'S MATCH RESULTS</text><line x1="145" x2="935" y1="365" y2="365" stroke="#9b8c69" stroke-width="2"/><text x="155" y="397" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">HOME TEAM</text><text x="540" y="397" text-anchor="middle" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">SCORE</text><text x="925" y="397" text-anchor="end" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">AWAY TEAM</text>`;let y=435;fixtures.forEach((f,i)=>{svg+=`<rect x="145" y="${y-25}" width="790" height="38" fill="${i%2?'#eadbb4':'#f6ebcc'}"/><text x="155" y="${y}" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="23">${safe(f.home)}</text><rect x="483" y="${y-28}" width="114" height="36" rx="4" fill="${deep}"/><text x="540" y="${y-2}" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="25">${f.result[0]} – ${f.result[1]}</text><text x="925" y="${y}" text-anchor="end" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="23">${safe(f.away)}</text>`;y+=45});const cols=Math.min(3,Math.max(1,data.length)),gap=18,areaX=50,areaW=980,cardW=(areaW-gap*(cols-1))/cols,rows=Math.ceil(data.length/cols),cardH=rows>1?205:330,baseY=690;data.forEach((x,idx)=>{const col=idx%cols,row=Math.floor(idx/cols),x0=areaX+col*(cardW+gap),y0=baseY+row*(cardH+18),o=x.out;svg+=`<rect x="${x0}" y="${y0}" width="${cardW}" height="${cardH}" rx="5" fill="${paper}" stroke="${cream}" stroke-width="4"/><text x="${x0+cardW/2}" y="${y0+48}" text-anchor="middle" fill="${ink}" font-family="Impact,Arial Black" font-size="${data.length<=3?31:24}">${safe(x.league.toUpperCase())}</text><line x1="${x0+20}" x2="${x0+cardW-20}" y1="${y0+62}" y2="${y0+62}" stroke="#b19f77"/>`;if(o&&o.rows.length){const drawAward=(label,mark,arr,yy,accent)=>{const names=arr.map(r=>`${r.p.name} · ${r.points} PTS`).join(' + ');svg+=`<text x="${x0+28}" y="${yy}" fill="${accent}" font-family="Arial" font-weight="700" font-size="14" letter-spacing="1">${mark} ${label}</text><text x="${x0+28}" y="${yy+30}" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="20">${safe(names)}</text>`};drawAward('1ST PLACE','★',o.first,y0+95,red);if(o.first.length===1&&o.second.length)drawAward('2ND PLACE','●',o.second,y0+160,'#59606c');drawAward('WOODEN SPOON','◆',o.spoons,y0+(o.first.length===1&&o.second.length?225:170),'#8b4a2d')}else{svg+=`<text x="${x0+28}" y="${y0+105}" fill="${ink}" font-family="Arial" font-size="18">No eligible paid entries</text>`}});const crowdY=rows>1?baseY+rows*(cardH+18)+20:1050;svg+=`<rect x="0" y="${crowdY}" width="1080" height="${1620-crowdY}" fill="#14251a" opacity=".94"/>`;for(let i=0;i<36;i++){const cx=18+i*31+(i%3)*4,cy=crowdY+85+(i%5)*8;svg+=`<circle cx="${cx}" cy="${cy}" r="11" fill="#0b1710"/><rect x="${cx-8}" y="${cy+8}" width="16" height="45" rx="6" fill="#0b1710"/>`;if(i%4===0)svg+=`<path d="M${cx-4} ${cy+20}L${cx-22} ${cy-15}M${cx+4} ${cy+20}L${cx+25} ${cy-18}" stroke="#0b1710" stroke-width="8" stroke-linecap="round"/>`}svg+=`<text x="540" y="${crowdY+185}" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="34" letter-spacing="2">SAME AGAIN NEXT WEEK?</text><text x="540" y="${crowdY+230}" text-anchor="middle" fill="${gold}" font-family="Georgia" font-style="italic" font-size="26">Different week. Same dreams.</text><line x1="100" x2="980" y1="1542" y2="1542" stroke="${cream}" opacity=".45"/><text x="540" y="1580" text-anchor="middle" fill="${cream}" font-family="Arial" font-weight="700" font-size="18" letter-spacing="5">PREDICTIONS · RIVALRY · BANTER · GLORY</text></svg>`;const img=new Image(),blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);img.onload=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);URL.revokeObjectURL(url);c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`Super-6-${state.round.name.replace(/\s+/g,'-')}-Results.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)},'image/png')};img.src=url}
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const btn=e.currentTarget.querySelector('button[type="submit"]');
 const original=btn.textContent;
 btn.disabled=true;
 btn.textContent='Signing in…';
 try{
  await login($('#loginName').value.trim(),$('#loginPin').value.trim());
  $('#loginPin').value='';
 }catch(err){
  alert(err?.message||'Username or PIN not recognised.');
 }finally{
  btn.disabled=false;
  btn.textContent=original;
 }
});$('#logoutBtn').onclick=logout;$('#whoBtn').onclick=logout;$$('[data-admin-tab]').forEach(b=>b.onclick=()=>setAdminTab(b.dataset.adminTab));$$('[data-player-tab]').forEach(b=>b.onclick=()=>{$$('[data-player-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#playerHome').classList.toggle('hidden',b.dataset.playerTab!=='home');$('#playerTables').classList.toggle('hidden',b.dataset.playerTab!=='tables');$('#playerChumpions').classList.toggle('hidden',b.dataset.playerTab!=='chumpions');$('#playerHistory').classList.toggle('hidden',b.dataset.playerTab!=='history');if(b.dataset.playerTab==='tables')renderLeagueTabs();if(b.dataset.playerTab==='chumpions')renderPlayerChumpions()});$('#saveRoundBtn').onclick=saveRound;const savePayBtn=$('#savePaymentUrlBtn');if(savePayBtn)savePayBtn.onclick=savePaymentUrl;const nextRoundBtn=$('#startNextRoundBtn');if(nextRoundBtn)nextRoundBtn.onclick=startNextRound;$('#completeRoundBtn').onclick=completeRound;$('#reopenRoundBtn').onclick=()=>{$('#resultValidation').textContent='You can correct the results above, then press “Save corrections & recalculate”.'};$('#posterBtn').onclick=showPoster;$('#addLeagueBtn').onclick=addLeague;$('#movePlayerBtn').onclick=movePlayer;
})();
