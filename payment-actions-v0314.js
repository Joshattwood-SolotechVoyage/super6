// Super 6 v0.32.3 — payment actions: Pay by Monzo + Copy link.
(()=>{
  const ROOT_ID='playerPaymentBody';
  const SENTINEL='payment-dual-actions-v0314';

  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function isMonzo(url){
    try{
      const u=new URL(url,location.href);
      const h=u.hostname.toLowerCase();
      return u.protocol==='https:' && (h==='monzo.me'||h.endsWith('.monzo.me'));
    }catch{return false}
  }

  function extractMonzo(root){
    // Existing Super 6 payment flow normally points to pay.html?target=<monzo.me URL>.
    for(const a of root.querySelectorAll('a[href]')){
      const raw=a.getAttribute('href')||'';
      try{
        const u=new URL(raw,location.href);
        const target=u.searchParams.get('target');
        if(target&&isMonzo(target)) return {url:new URL(target).href,source:a};
        if(isMonzo(u.href)) return {url:u.href,source:a};
      }catch{}
    }

    // Fallback for future UI variants that store the payment URL on an element.
    for(const node of root.querySelectorAll('[data-payment-url],[data-url],[data-href]')){
      for(const key of ['paymentUrl','url','href']){
        const raw=node.dataset?.[key];
        if(raw&&isMonzo(raw)) return {url:new URL(raw).href,source:node};
      }
    }

    // Last fallback: inspect visible/hidden text for a monzo.me URL.
    const m=(root.textContent||'').match(/https:\/\/monzo\.me\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]+/i);
    if(m&&isMonzo(m[0])) return {url:new URL(m[0]).href,source:null};
    return null;
  }

  async function copyText(text){
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand('copy');
    ta.remove();
    if(!ok) throw new Error('Copy failed');
  }

  function enhance(){
    const root=document.getElementById(ROOT_ID);
    if(!root||root.querySelector('.'+SENTINEL)) return;

    const found=extractMonzo(root);
    if(!found) return;

    const direct=found.url;
    const source=found.source;

    // Hide only the old payment-launch control. Leave "Yes, I've paid" and other
    // confirmation/status controls exactly as they are.
    if(source){
      const txt=(source.textContent||'').toLowerCase();
      if(txt.includes('pay')||txt.includes('checkout')||txt.includes('monzo')){
        source.style.display='none';
      }
    }

    // Also hide a nearby legacy launcher if it explicitly says browser checkout.
    root.querySelectorAll('a,button').forEach(node=>{
      const t=(node.textContent||'').trim().toLowerCase();
      if(t.includes('browser checkout')||t==='pay £6'||t==='pay now'){
        if(!t.includes("i've paid")&&!t.includes('paid')) node.style.display='none';
      }
    });

    const row=document.createElement('div');
    row.className='payment-dual-actions '+SENTINEL;
    row.innerHTML=
      '<a class="payment-action payment-action-monzo" href="'+esc(direct)+'">Pay by Monzo</a>'+
      '<button class="payment-action payment-action-copy" type="button">Copy payment link</button>';

    const copyBtn=row.querySelector('.payment-action-copy');
    copyBtn.addEventListener('click',async()=>{
      const old=copyBtn.textContent;
      copyBtn.disabled=true;
      try{
        await copyText(direct);
        copyBtn.textContent='Copied ✓';
      }catch(e){
        copyBtn.textContent='Could not copy';
      }
      setTimeout(()=>{copyBtn.textContent=old;copyBtn.disabled=false},1600);
    });

    // Put the choices at the top of the payment action area.
    root.prepend(row);
  }

  const root=document.getElementById('app')||document.body;
  new MutationObserver(enhance).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-player-tab="home"]')) setTimeout(enhance,80);
  });
  setTimeout(enhance,100);
})();