(async()=>{
if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
if(typeof DecompressionStream==='undefined') throw new Error('This browser needs updating before this Super 6 version can load.');

function ensureShartUI(){
  if(!document.querySelector('link[href*="shart-v031.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='shart-v031.css?v=0.31.0';
    document.head.appendChild(link);
  }

  const playerNav=document.querySelector('.player-nav');
  if(playerNav&&!playerNav.querySelector('[data-player-tab="shart"]')){
    const historyBtn=playerNav.querySelector('[data-player-tab="history"]');
    const btn=document.createElement('button');
    btn.type='button';
    btn.dataset.playerTab='shart';
    btn.textContent='SHART';
    if(historyBtn) playerNav.insertBefore(btn,historyBtn); else playerNav.appendChild(btn);
  }

  if(!document.getElementById('playerShart')){
    const history=document.getElementById('playerHistory');
    const html='<div class="screen hidden" id="playerShart"><section class="card shart-hero"><div class="section-head"><div><div class="kicker">Straight knockout</div><h3>💨 SHART</h3><div class="muted">32 players · random draw · head-to-head all the way to the Final. Normal Super 6 points decide each tie, then first-goal accuracy, then Admin if still level.</div></div><span class="chip" id="playerShartStatus">Waiting</span></div><div id="playerShartBody"><div class="muted">Loading SHART…</div></div></section></div>';
    if(history) history.insertAdjacentHTML('beforebegin',html);
  }

  const adminTabs=document.getElementById('adminTabs');
  if(adminTabs&&!adminTabs.querySelector('[data-admin-tab="shart"]')){
    const playersBtn=adminTabs.querySelector('[data-admin-tab="players"]');
    const btn=document.createElement('button');
    btn.type='button';
    btn.dataset.adminTab='shart';
    btn.innerHTML='<b>SHART</b><small>Straight knockout</small>';
    if(playersBtn) adminTabs.insertBefore(btn,playersBtn); else adminTabs.appendChild(btn);
  }

  if(!document.getElementById('shartWeekCheckbox')){
    const chumpions=document.getElementById('chumpionsWeekCheckbox');
    const label=chumpions&&chumpions.closest('label');
    if(label) label.insertAdjacentHTML('afterend','<label class="shart-toggle"><input id="shartWeekCheckbox" type="checkbox" /><span><b>💨 SHART week</b><small>Tick this when this normal Super 6 round should play the next ready SHART knockout stage.</small></span></label>');
  }

  if(!document.querySelector('[data-admin-panel="shart"]')){
    const playersPanel=document.querySelector('[data-admin-panel="players"]');
    const html='<div class="admin-tab-panel hidden" data-admin-panel="shart"><section class="card"><div class="section-head"><div><div class="kicker">Competition control</div><h3>💨 SHART</h3><div class="muted">Straight head-to-head knockout: Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final.</div></div><span class="chip">32 players</span></div><div class="notice">Higher normal Super 6 score advances. If level, closest first-goal-minute prediction advances. If that is still level, Admin chooses the winner.</div><div id="adminShartCurrentWeek"></div></section><section class="card"><div class="section-head"><div><div class="kicker">Knockout bracket</div><h3>Road to the SHART Final</h3><div class="muted">The Round-of-32 draw is random. Winners automatically feed the next bracket slot.</div></div></div><div id="adminShartBracket"></div></section><section class="card"><div class="section-head"><div><div class="kicker">Before the draw</div><h3>Choose the 32 entrants</h3><div class="muted">Select exactly 32 players. Once the random draw is generated, the entrant list locks.</div></div><span class="chip" id="shartEntrantCount">0 / 32</span></div><label class="latest-picks-search"><span>🔎</span><input id="shartPlayerSearch" type="search" placeholder="Search player…" autocomplete="off" /></label><div id="adminShartRoster"></div></section></div>';
    if(playersPanel) playersPanel.insertAdjacentHTML('beforebegin',html);
  }
}

ensureShartUI();
const files=['app-v031-payload-01.txt','app-v031-payload-02.txt','app-v031-payload-03.txt','app-v031-payload-04.txt','app-v031-payload-05.txt','app-v031-payload-06.txt','app-v031-payload-07.txt','app-v031-payload-08.txt','app-v031-payload-09.txt'];
const parts=await Promise.all(files.map(async f=>{const r=await fetch(f+'?v=0.31.0',{cache:'force-cache'});if(!r.ok) throw new Error('Could not load '+f);return r.text();}));
const b64=parts.join('');
const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
let source=await new Response(stream).text();
// v0.33.6 — keep Admin payment rows mounted while saving individual Paid checkboxes.
// The original handler rebuilt all league panels after each tick, moving the list
// and recreating every checkbox. Preserve backend writes and completed-round recalculation.
const adminPaymentHelper = [
"let adminPaymentSaveQueue=Promise.resolve();",
"function syncAdminPaymentRowUI(){",
" const wrap=$('#adminLeaguePanels');if(!wrap)return;",
" const leagues=adminRoundOverview.leagues||[],players=adminRoundOverview.players||[];",
" const byId=new Map(players.map(p=>[String(p.id),p]));",
" wrap.querySelectorAll('.league-panel').forEach((panel,index)=>{",
"  const league=leagues[index];if(!league)return;",
"  const ps=players.filter(p=>String(p.league_id)===String(league.id));",
"  const numbers={submitted:ps.filter(p=>p.submitted).length,paid:ps.filter(p=>p.paid).length,pending:ps.filter(p=>p.submitted&&!p.paid&&p.payment_pending).length,unpaid:ps.filter(p=>p.submitted&&!p.paid&&!p.payment_pending).length,missing:ps.filter(p=>!p.submitted).length};",
"  for(const [name,num] of Object.entries(numbers)){const node=panel.querySelector('.status-summary .status-pill.'+name+' b');if(node&&node.textContent!==String(num))node.textContent=String(num)}",
"  const pot=panel.querySelector('.money strong');const amount='£'+(ps.filter(p=>p.submitted&&p.paid).length*Number(state.round?.fee||0));if(pot&&pot.textContent!==amount)pot.textContent=amount;",
" });",
" wrap.querySelectorAll('input[data-paid]').forEach(input=>{",
"  if(input.dataset.paymentSaving==='1')return;",
"  const p=byId.get(String(input.dataset.paid));if(!p)return;",
"  if(input.checked!==Boolean(p.paid))input.checked=Boolean(p.paid);",
"  const badges=input.closest('.player-row')?.querySelector('.player-statuses');if(!badges)return;",
"  const old=badges.querySelector('.status-pill.mini.paid,.status-pill.mini.pending,.status-pill.mini.unpaid');",
"  const klass=p.paid?'paid':p.submitted?(p.payment_pending?'pending':'unpaid'):null;",
"  const label=klass==='paid'?'Paid':klass==='pending'?'Payment pending':'Unpaid';",
"  if(!klass){old?.remove()}else if(old){const next='status-pill mini '+klass;if(old.className!==next)old.className=next;if(old.textContent!==label)old.textContent=label}else{const chip=document.createElement('span');chip.className='status-pill mini '+klass;chip.textContent=label;badges.appendChild(chip)}",
"  if(state.round?.completed){const marker=[...badges.querySelectorAll('.status-pill.mini.missing')].find(el=>el.textContent==='Not counted');const needed=Boolean(p.submitted&&p.paid&&!weeklyResultForPlayer(p.id));if(needed&&!marker){const el=document.createElement('span');el.className='status-pill mini missing';el.textContent='Not counted';badges.appendChild(el)}else if(!needed&&marker)marker.remove()}",
" });",
"}"
].join('\n');
const paymentStart=" wrap.querySelectorAll('[data-paid]').forEach(x=>x.onchange=async()=>{";
const paymentEnd=" wrap.querySelectorAll('[data-view]').forEach(x=>x.onclick=";
const begin=source.indexOf(paymentStart);
const end=begin<0?-1:source.indexOf(paymentEnd,begin);
if(begin!==-1&&end>begin&&source.includes('function renderAdminLeaguePanels(){')){
  const handler=[
  " wrap.querySelectorAll('[data-paid]').forEach(x=>x.onchange=()=>{",
  "  const desired=Boolean(x.checked),playerId=String(x.dataset.paid||''),roundId=state.round?.id;",
  "  if(!playerId||!roundId){x.checked=!desired;return}",
  "  x.disabled=true;x.dataset.paymentSaving='1';x.closest('.player-row')?.classList.add('payment-saving');",
  "  adminPaymentSaveQueue=adminPaymentSaveQueue.catch(()=>{}).then(async()=>{",
  "   try{",
  "    await window.Super6Backend.setAdminPayment(roundId,playerId,desired);",
  "    if(state.round?.id!==roundId)return;",
  "    await refreshAdminRoundOverview();",
  "    if(state.round.completed){await Promise.all([refreshLiveWeeklyResults(),refreshLiveStandings(),refreshLatestLeagueWinners(),refreshChumpionsState(),refreshShartState(),refreshAdminMoneyHistory()])}",
  "    renderAdminHero();syncAdminPaymentRowUI();",
  "    if(state.round.completed){renderWeeklyResults();renderAdminTables();renderAdminChumpions();renderAdminShart()}",
  "   }catch(err){",
  "    alert(err?.message||'Could not update payment status.');",
  "    if(state.round?.id===roundId){await refreshAdminRoundOverview().catch(()=>{});renderAdminHero();x.checked=!desired}",
  "   }finally{",
  "    delete x.dataset.paymentSaving;x.closest('.player-row')?.classList.remove('payment-saving');",
  "    if(state.round?.id===roundId){syncAdminPaymentRowUI();x.disabled=false}",
  "   }",
  "  });",
  " });",
  ""
  ].join('\n');
  source=source.slice(0,begin)+handler+source.slice(end);
  source=source.replace('function renderAdminLeaguePanels(){',adminPaymentHelper+'\nfunction renderAdminLeaguePanels(){');
  const oldRefresh="try{await refreshAdminRoundOverview();renderAdminHero();renderAdminLeaguePanels()}";
  const newRefresh="try{await refreshAdminRoundOverview();renderAdminHero();if($('#adminLeaguePanels')?.querySelector('.player-row'))syncAdminPaymentRowUI();else renderAdminLeaguePanels()}";
  if(source.includes(oldRefresh))source=source.replace(oldRefresh,newRefresh);
  else console.warn('Super 6: background payment refresh update not found');
}else console.warn('Super 6: original payment handler not found; original implementation kept');
// v0.34.8 — Restore a verified Supabase browser session after reopening the app.
// The bundled app previously always created an empty in-memory session, leaving users on
// the PIN screen even when Supabase had kept their refresh token securely in browser storage.
const originalLoginHeader=[
"async function login(name,pin){",
" const canonicalName=canonicalPlayerLoginName(name);",
" const profile=await window.Super6Backend.pinLogin(canonicalName,pin);",
" await refreshLiveStandings();"
].join('\n');
const persistentLoginHeader=[
"async function login(name,pin){",
" const canonicalName=canonicalPlayerLoginName(name);",
" const profile=await window.Super6Backend.pinLogin(canonicalName,pin);",
" return finishLoginWithProfile(profile);",
"}",
"async function finishLoginWithProfile(profile){",
" await refreshLiveStandings();"
].join('\n');
if(!source.includes(originalLoginHeader)) throw new Error('Could not install Super 6 session restore: login entry point changed.');
source=source.replace(originalLoginHeader,persistentLoginHeader);

const oldAccountHeaderBinding="$('#logoutBtn').onclick=logout;$('#whoBtn').onclick=logout;";
const oldAdminLoginSession="session={role:'admin',userId:null,authUserId:profile.id};";
const oldAccountDisplay="$('#whoBtn').textContent=session.role==='admin'?'Admin':currentUser().name;";
if(!source.includes(oldAccountHeaderBinding) || !source.includes(oldAdminLoginSession) || !source.includes(oldAccountDisplay)){
  throw new Error('Could not install Super 6 top-bar account layout: login implementation changed.');
}
source=source.replace(oldAccountHeaderBinding,"$('#logoutBtn').onclick=logout;");
source=source.replace(oldAdminLoginSession,"session={role:'admin',userId:null,authUserId:profile.id,username:profile.username};");
source=source.replace(oldAccountDisplay,"$('#whoBtn').textContent=session.role==='admin'?(session.username||'Admin'):currentUser().name;");
// v0.35.0 — enforce 30-minute fixed login expiry for players and admins.
const oldSessionWindowLogin=" const profile=await window.Super6Backend.pinLogin(canonicalName,pin);\n return finishLoginWithProfile(profile);\n}";
const newSessionWindowLogin=" const profile=await window.Super6Backend.pinLogin(canonicalName,pin);\n openThirtyMinuteSession(profile.id);\n try{return await finishLoginWithProfile(profile)}\n catch(error){\n  clearThirtyMinuteSession();\n  await window.Super6Backend.signOut().catch(()=>{});\n  throw error;\n }\n}";
const oldSessionWindowLogout="async function logout(){await window.Super6Backend.signOut().catch(()=>{});";
const newSessionWindowLogout="async function logout(){clearThirtyMinuteSession();clearInterval(timer);await window.Super6Backend.signOut().catch(()=>{});";
const oldSessionWindowTimer="function startTimer(){clearInterval(timer);timer=setInterval(()=>{if(session.role==='player')renderCountdown();";
const newSessionWindowTimer="function startTimer(){clearInterval(timer);timer=setInterval(()=>{if(!hasValidThirtyMinuteSession(session.authUserId)){checkThirtyMinuteSession();return;}if(session.role==='player')renderCountdown();";
if(!source.includes(oldSessionWindowLogin)||!source.includes(oldSessionWindowLogout)||!source.includes(oldSessionWindowTimer)) throw new Error('Super 6 session window patch: bundled app login, logout or timer changed.');
source=source.replace(oldSessionWindowLogin,newSessionWindowLogin);
source=source.replace(oldSessionWindowLogout,newSessionWindowLogout);
source=source.replace(oldSessionWindowTimer,newSessionWindowTimer);
const thirtyMinuteSessionHelpers="// A fixed 30-minute PIN session; Supabase token refresh does not extend this window.\nconst SUPER6_LOGIN_TTL_MS=30*60*1000;\nconst SUPER6_LOGIN_WINDOW_KEY='super6_login_window_v1';\nlet sessionWindowMemory=null;\nlet expiryLogoutInProgress=false;\nfunction getThirtyMinuteSession(){\n try{const value=localStorage.getItem(SUPER6_LOGIN_WINDOW_KEY);return value?JSON.parse(value):sessionWindowMemory}\n catch(error){return sessionWindowMemory}\n}\nfunction hasValidThirtyMinuteSession(authUserId){\n const windowInfo=getThirtyMinuteSession();\n return Boolean(authUserId&&windowInfo&&String(windowInfo.userId)===String(authUserId)&&\n  Number.isFinite(windowInfo.expiresAt)&&windowInfo.expiresAt>Date.now()&&\n  windowInfo.expiresAt<=Date.now()+SUPER6_LOGIN_TTL_MS);\n}\nfunction openThirtyMinuteSession(authUserId){\n sessionWindowMemory={userId:String(authUserId),expiresAt:Date.now()+SUPER6_LOGIN_TTL_MS};\n try{localStorage.setItem(SUPER6_LOGIN_WINDOW_KEY,JSON.stringify(sessionWindowMemory))}\n catch(error){console.warn('Super 6: 30-minute session cannot be remembered on this device.',error)}\n}\nfunction clearThirtyMinuteSession(){\n sessionWindowMemory=null;\n try{localStorage.removeItem(SUPER6_LOGIN_WINDOW_KEY)}catch(error){}\n}\nfunction checkThirtyMinuteSession(){\n if(!session.role||expiryLogoutInProgress)return;\n if(hasValidThirtyMinuteSession(session.authUserId))return;\n expiryLogoutInProgress=true;\n void logout().finally(()=>{expiryLogoutInProgress=false});\n}\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)checkThirtyMinuteSession()});\nwindow.addEventListener('focus',checkThirtyMinuteSession);\nwindow.addEventListener('pageshow',checkThirtyMinuteSession);\nwindow.addEventListener('storage',event=>{if(event.key===SUPER6_LOGIN_WINDOW_KEY)checkThirtyMinuteSession()});";
const persistentRestore=[
"// Supabase persists and refreshes tokens; never store the PIN locally.",
"async function restoreSavedLogin(){",
" const btn=$('#loginForm')?.querySelector('button[type=\"submit\"]');",
" const previousLabel=btn?.textContent;",
" if(btn){btn.disabled=true;btn.textContent='Restoring your login…';}",
" try{",
"  const sb=window.Super6Backend.client();",
"  const {data:existing,error:sessionError}=await sb.auth.getSession();",
"  if(sessionError||!existing?.session?.access_token)return;",
"  if(!hasValidThirtyMinuteSession(existing.session.user?.id)){",
"   clearThirtyMinuteSession();",
"   await window.Super6Backend.signOut().catch(()=>{});",
"   return;",
"  }",
"  // Validate with Auth before loading a role from the protected profiles table.",
"  const {data:verified,error:userError}=await sb.auth.getUser();",
"  if(userError||!verified?.user?.id)return;",
"  const {data:profile,error:profileError}=await sb.from('profiles')",
"   .select('id, username, role, league_id')",
"   .eq('id',verified.user.id).single();",
"  if(profileError||!profile||!['player','admin'].includes(profile.role))return;",
"  await finishLoginWithProfile(profile);",
" }catch(error){",
"  console.warn('Super 6 could not restore the saved session:',error);",
"  session={role:null,userId:null};",
"  $('#appScreen')?.classList.add('hidden');",
"  $('#loginScreen')?.classList.remove('hidden');",
" }finally{",
"  if(btn){btn.disabled=false;btn.textContent=previousLabel||'Enter Super 6';}",
" }",
"}",
"void restoreSavedLogin();"
].join('\n');
if(!source.trimEnd().endsWith('})();')) throw new Error('Could not install Super 6 session restore: boot structure changed.');
source=source.replace(/\}\)\(\);\s*$/,thirtyMinuteSessionHelpers+'\n'+persistentRestore+'\n})();');
(0,eval)(source);
})().catch(err=>{console.error(err);const el=document.getElementById('app')||document.body;if(el){const d=document.createElement('div');d.style.cssText='margin:16px;padding:14px;border:1px solid #b44;background:#fff4f2;color:#6b1d1d;border-radius:10px;font:14px Arial';d.textContent='Super 6 failed to load: '+(err?.message||err);el.prepend(d);}});
