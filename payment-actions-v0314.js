// Super 6 v0.32.4 — payment actions: Pay by Monzo + Copy link + simple paid/not-paid confirmation.
(()=>{
  const ROOT_ID='playerPaymentBody';
  const SENTINEL='payment-dual-actions-v0324';
  const ATTEMPT_PREFIX='super6_payment_attempt_';

  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function isMonzo(url){
    try{
      const u=new URL(url,location.href);
      const h=u.hostname.toLowerCase();
      return u.protocol==='https:' && (h==='monzo.me'||h.endsWith('.monzo.me'));
    }catch{return false}
  }

  function extractMonzo(root){
    for(const a of root.querySelectorAll('a[href]')){
      const raw=a.getAttribute('href')||'';
      try{
        const u=new URL(raw,location.href);
        const target=u.searchParams.get('target');
        if(target&&isMonzo(target)) return {url:new URL(target).href,source:a};
        if(isMonzo(u.href)) return {url:u.href,source:a};
      }catch{}
    }
    for(const node of root.querySelectorAll('[data-payment-url],[data-url],[data-href]')){
      for(const key of ['paymentUrl','url','href']){
        const raw=node.dataset?.[key];
        if(raw&&isMonzo(raw)) return {url:new URL(raw).href,source:node};
      }
    }
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

  async function paymentContext(){
    if(window.__SUPER6_BACKEND_READY) await window.__SUPER6_BACKEND_READY;
    const B=window.Super6Backend;
    if(!B) return {B:null,round:null,user:null,key:ATTEMPT_PREFIX+'unknown'};
    let round=null,user=null;
    try{round=await B.loadCurrentRound()}catch{}
    try{user=(await B.client().auth.getUser())?.data?.user||null}catch{}
    return {B,round,user,key:ATTEMPT_PREFIX+(round?.id||'round')+'_'+(user?.id||'user')};
  }

  function hideLegacyLaunchers(root,source){
    if(source){
      const txt=(source.textContent||'').toLowerCase();
      if(txt.includes('pay')||txt.includes('checkout')||txt.includes('monzo')) source.style.display='none';
    }
    root.querySelectorAll('a,button').forEach(node=>{
      const t=(node.textContent||'').trim().toLowerCase();
      if(t.includes('browser checkout')||t==='pay £6'||t==='pay now'){
        if(!t.includes("i've paid")&&!t.includes('paid')) node.style.display='none';
      }
    });
  }

  function buildChoices(direct,onAttempt){
    const wrap=document.createElement('div');
    wrap.className='payment-dual-actions '+SENTINEL;
    wrap.innerHTML=
      '<a class="payment-action payment-action-monzo" href="'+esc(direct)+'" target="_blank" rel="noopener">Pay by Monzo</a>'+
      '<button class="payment-action payment-action-copy" type="button">Copy link</button>'+
      '<div class="payment-action-help">After paying, come back here and confirm it.</div>';

    const monzo=wrap.querySelector('.payment-action-monzo');
    const copy=wrap.querySelector('.payment-action-copy');
    monzo.addEventListener('click',()=>onAttempt('monzo'));

    copy.addEventListener('click',async()=>{
      const old=copy.textContent;
      copy.disabled=true;
      try{
        await copyText(direct);
        copy.textContent='Copied ✓';
        onAttempt('copy');
      }catch(e){
        copy.textContent='Could not copy';
        setTimeout(()=>{copy.textContent=old;copy.disabled=false},1600);
      }
    });
    return wrap;
  }

  function buildConfirmation(ctx,onBack){
    const wrap=document.createElement('div');
    wrap.className='payment-after-check '+SENTINEL;
    wrap.innerHTML=
      '<div class="payment-after-copy"><b>Did you complete the payment?</b><span>Choose yes only once the Monzo payment has gone through.</span></div>'+
      '<div class="payment-after-actions">'+
        '<button class="big-action" type="button" data-payment-done>Yes — I\'ve paid</button>'+
        '<button class="secondary" type="button" data-payment-not-yet>No — not yet</button>'+
      '</div>'+
      '<div class="payment-after-status"></div>';

    wrap.querySelector('[data-payment-not-yet]').addEventListener('click',()=>{
      try{localStorage.removeItem(ctx.key)}catch{}
      onBack();
    });

    wrap.querySelector('[data-payment-done]').addEventListener('click',async e=>{
      const btn=e.currentTarget,status=wrap.querySelector('.payment-after-status');
      btn.disabled=true;btn.textContent='Saving…';
      try{
        if(!ctx.B||!ctx.round?.id||typeof ctx.B.markMyPaymentPending!=='function') throw new Error('Payment confirmation is not ready. Please refresh and try again.');
        await ctx.B.markMyPaymentPending(ctx.round.id);
        try{localStorage.removeItem(ctx.key)}catch{}
        status.innerHTML='<div class="notice good" style="margin-top:10px">Thanks — marked as paid and waiting for Admin confirmation.</div>';
        setTimeout(()=>location.reload(),650);
      }catch(err){
        status.innerHTML='<div class="notice bad" style="margin-top:10px">'+esc(err?.message||'Could not update payment status.')+'</div>';
        btn.disabled=false;btn.textContent="Yes — I've paid";
      }
    });
    return wrap;
  }

  async function enhance(){
    const root=document.getElementById(ROOT_ID);
    if(!root||root.querySelector('.'+SENTINEL)) return;

    const found=extractMonzo(root);
    if(!found) return;

    hideLegacyLaunchers(root,found.source);
    const ctx=await paymentContext();
    if(!document.getElementById(ROOT_ID)||root.querySelector('.'+SENTINEL)) return;

    let attempted=false;
    try{attempted=localStorage.getItem(ctx.key)==='1'}catch{}

    const showChoices=()=>{
      root.querySelector('.'+SENTINEL)?.remove();
      root.prepend(buildChoices(found.url,()=>{
        try{localStorage.setItem(ctx.key,'1')}catch{}
        root.querySelector('.'+SENTINEL)?.remove();
        root.prepend(buildConfirmation(ctx,showChoices));
      }));
    };

    if(attempted) root.prepend(buildConfirmation(ctx,showChoices));
    else showChoices();
  }

  const app=document.getElementById('app')||document.body;
  new MutationObserver(enhance).observe(app,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-player-tab="home"]')) setTimeout(enhance,80);
  });
  window.addEventListener('focus',()=>setTimeout(enhance,80));
  setTimeout(enhance,100);
})();