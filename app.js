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
const source=await new Response(stream).text();
(0,eval)(source);
})().catch(err=>{console.error(err);const el=document.getElementById('app')||document.body;if(el){const d=document.createElement('div');d.style.cssText='margin:16px;padding:14px;border:1px solid #b44;background:#fff4f2;color:#6b1d1d;border-radius:10px;font:14px Arial';d.textContent='Super 6 failed to load: '+(err?.message||err);el.prepend(d);}});
