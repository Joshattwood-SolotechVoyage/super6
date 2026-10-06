// Super 6 v0.31.5 SHART loader
(async()=>{
  const files=['shart-v0315-part-01.txt','shart-v0315-part-02.txt','shart-v0315-part-03.txt','shart-v0315-part-04.txt','shart-v0315-part-05.txt','shart-v0315-part-06.txt'];
  const parts=await Promise.all(files.map(async f=>{const r=await fetch(f+'?v=0.31.5',{cache:'force-cache'});if(!r.ok)throw new Error('Could not load '+f);return r.text();}));
  (0,eval)(parts.join(''));
})().catch(err=>{console.error(err);const el=document.getElementById('playerShartBody')||document.getElementById('app')||document.body;if(el){const d=document.createElement('div');d.className='notice bad';d.textContent='SHART v0.31.5 failed to load: '+(err?.message||err);el.prepend(d);}});
