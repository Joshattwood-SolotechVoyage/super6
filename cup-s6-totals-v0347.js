/* v0.34.7 — cumulative Super 6 points in Chumpions group standings.
 * Includes the player and admin table renders without changing their group positions.
 * Reads the existing cup-standings view; does not count unrelated league rounds. */
(async function(){
  'use strict';
  if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
  const B=window.Super6Backend;
  if(!B||typeof B.client!=='function') return;
  const sb=B.client();
  const norm=x=>String(x||'').trim().replace(/\s+/g,' ').replace(/[\u2018\u2019]/g,"'").toLocaleLowerCase('en-GB');
  let totals=new Map(),lastLoaded=0,inFlight=null;
  function tables(){return document.querySelectorAll('.chumpions-table')}
  function paint(){
    for(const table of tables()){
      const head=table.tHead?.rows?.[0],body=table.tBodies?.[0];
      if(!head||!body||head.cells.length<7)continue;
      const last=head.cells[head.cells.length-1];
      if(!/\b(pts|points)\b/i.test(last.textContent||''))continue;
      if(!head.querySelector('.cup-s6-cell')){
        const th=document.createElement('th');
        th.className='cup-s6-cell';
        th.textContent='S6';
        th.title='Total Super 6 points earned in Chumpions cup fixtures';
        head.insertBefore(th,last);
      }
      for(const row of body.rows){
        if(row.cells.length<7)continue;
        const player=norm(row.cells[1]?.querySelector('b,strong')?.textContent||row.cells[1]?.textContent||'');
        let value=totals.get(player);
        if(value===undefined) {
          const test=[...totals.entries()].find(([name])=>player.startsWith(name));
          if(test)value=test[1];
        }
        let cell=row.querySelector('.cup-s6-cell');
        if(!cell){
          cell=document.createElement('td');cell.className='cup-s6-cell';
          row.insertBefore(cell,row.cells[row.cells.length-1]);
        }
        const rendered=value===undefined?'—':String(value);
        if(cell.textContent!==rendered)cell.textContent=rendered;
      }
    }
  }
  async function reload(force=false){
    if(inFlight)return inFlight;
    if(!tables().length)return;
    if(!force&&lastLoaded&&Date.now()-lastLoaded<30000)return;
    inFlight=(async()=>{
      const user=await sb.auth.getUser();
      if(user.error||!user.data?.user)return;
      const season=await sb.from('seasons').select('id').eq('status','active').limit(1).maybeSingle();
      if(season.error||!season.data?.id)return;
      const res=await sb.from('chumpions_group_standings')
        .select('player_name,chumpions_score').eq('season_id',season.data.id);
      if(res.error){console.warn('Chumpions S6 totals:',res.error.message);return}
      const next=new Map();
      for(const r of res.data||[])next.set(norm(r.player_name),Number(r.chumpions_score||0));
      totals=next;lastLoaded=Date.now();paint();
    })().catch(e=>console.warn('Chumpions S6 totals:',e)).finally(()=>{inFlight=null});
    return inFlight;
  }
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;paint();void reload()});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  paint();
  void reload();
  window.addEventListener('focus',()=>void reload(true));
})();