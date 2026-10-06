// Super 6 v0.31.7 — robust weekly poster PNG export.
// The existing poster preview is still used for the data, but PNG generation is
// replaced so long league names and tied award names can never spill out of a card.
(()=>{
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const textOf=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();

  function brLines(el){
    if(!el)return[];
    const out=[]; let buf='';
    [...el.childNodes].forEach(n=>{
      if(n.nodeName==='BR'){ if(buf.trim())out.push(buf.trim()); buf=''; }
      else buf+=n.textContent||'';
    });
    if(buf.trim())out.push(buf.trim());
    if(!out.length){
      const t=(el.innerText||el.textContent||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
      return t;
    }
    return out;
  }

  const measureCtx=(()=>{const c=document.createElement('canvas');return c.getContext('2d')})();
  function fitSize(text,maxWidth,start=20,min=11,family='Arial Narrow,Arial'){
    let size=start;
    while(size>min){
      measureCtx.font='700 '+size+'px '+family;
      if(measureCtx.measureText(String(text)).width<=maxWidth)return size;
      size--;
    }
    return min;
  }

  function parsePreview(){
    const p=document.getElementById('posterPreview');
    if(!p)throw new Error('Open the weekly poster preview first.');
    const round=textOf(p.querySelector('.poster-week'))||'SUPER 6 RESULTS';
    const ribbon=textOf(p.querySelector('.poster-ribbon'))||'REAL MATCHES · REAL DRAMA';
    const matchBox=[...p.querySelectorAll('.poster-box')].find(x=>!x.closest('.poster-grid'));
    const fixtures=[...(matchBox?.querySelectorAll('.poster-match')||[])].map(row=>{
      const spans=row.querySelectorAll('span');
      return {home:textOf(spans[0]),score:textOf(row.querySelector('b')),away:textOf(spans[spans.length-1])};
    });
    const leagues=[...(p.querySelectorAll('.poster-grid .poster-box')||[])].map(card=>({
      league:textOf(card.querySelector('h4')),
      awards:[...card.querySelectorAll('.award')].map(a=>({
        label:textOf(a.querySelector('.award-label')),
        names:brLines(a.querySelector('b'))
      }))
    }));
    return {round,ribbon,fixtures,leagues};
  }

  function awardColour(label){
    const l=label.toLowerCase();
    if(l.includes('1st'))return '#8d3b2d';
    if(l.includes('2nd'))return '#59606c';
    return '#8b4a2d';
  }
  function awardMark(label){
    const l=label.toLowerCase();
    if(l.includes('1st'))return '★';
    if(l.includes('2nd'))return '●';
    return '◆';
  }
  function cleanAwardLabel(label){
    return label.replace(/^[^A-Za-z0-9]+/,'').toUpperCase();
  }

  function makeSvg(data){
    const W=1080,H=1620,cream='#efe2bd',paper='#f5e9c8',green='#17462d',deep='#103421',red='#8d3b2d',ink='#193322',gold='#c9a45d',black='#1d211b';
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="8" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g"><feFuncA type="table" tableValues="0 .16"/></feComponentTransfer></filter><filter id="rough"><feTurbulence baseFrequency=".025" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2"/></filter></defs><rect width="1080" height="1620" fill="${green}"/><rect width="1080" height="1620" filter="url(#grain)" opacity=".8"/><rect x="24" y="24" width="1032" height="1572" rx="8" fill="none" stroke="${cream}" stroke-width="5" filter="url(#rough)"/>`;
    svg+=`<text x="58" y="68" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">SIX</text><text x="58" y="95" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">GAMES</text><text x="58" y="122" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">ONE</text><text x="58" y="149" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="22" letter-spacing="3">PASSION</text>`;
    svg+=`<text x="540" y="145" text-anchor="middle" fill="${cream}" stroke="#3e241b" stroke-width="3" paint-order="stroke" font-family="Impact,Arial Black" font-size="118" letter-spacing="3">SUPER 6</text>`;
    const titleSize=fitSize(data.round,760,54,34,'Impact,Arial Black');
    svg+=`<text x="540" y="210" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="${titleSize}" letter-spacing="2">${safe(data.round)}</text><path d="M265 228H815L790 274H290Z" fill="${red}"/><text x="540" y="258" text-anchor="middle" fill="${cream}" font-family="Arial Narrow,Arial" font-weight="700" font-size="18" letter-spacing="2">${safe(data.ribbon)}</text>`;
    svg+=`<g transform="translate(108 145) rotate(-12)" fill="${black}" opacity=".88"><circle cx="0" cy="-42" r="18"/><path d="M-12 -24L18 -18L38 18L20 28L7 5L-4 40L-22 82L-43 76L-24 32L-20 -8Z"/><path d="M17 -10L55 -28L61 -18L31 6Z"/><path d="M-1 37L31 69L18 82L-14 54Z"/></g><g transform="translate(935 145)" fill="none" stroke="${cream}" stroke-width="4" opacity=".9"><circle cx="0" cy="0" r="54"/><path d="M0 -25L24 -8L15 20H-15L-24 -8Z"/><path d="M0 -25L0 -54M24 -8L51 -18M15 20L31 46M-15 20L-31 46M-24 -8L-51 -18"/></g>`;
    svg+=`<rect x="120" y="300" width="840" height="350" rx="6" fill="${paper}" stroke="${cream}" stroke-width="5"/><text x="540" y="345" text-anchor="middle" fill="${ink}" font-family="Impact,Arial Black" font-size="35">THIS WEEK'S MATCH RESULTS</text><line x1="145" x2="935" y1="365" y2="365" stroke="#9b8c69" stroke-width="2"/><text x="155" y="397" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">HOME TEAM</text><text x="540" y="397" text-anchor="middle" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">SCORE</text><text x="925" y="397" text-anchor="end" fill="${ink}" font-family="Arial" font-size="16" font-weight="700">AWAY TEAM</text>`;
    let y=435;
    data.fixtures.slice(0,6).forEach((f,i)=>{
      const homeSize=fitSize(f.home,285,23,15),awaySize=fitSize(f.away,285,23,15);
      svg+=`<rect x="145" y="${y-25}" width="790" height="38" fill="${i%2?'#eadbb4':'#f6ebcc'}"/><text x="155" y="${y}" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="${homeSize}">${safe(f.home)}</text><rect x="483" y="${y-28}" width="114" height="36" rx="4" fill="${deep}"/><text x="540" y="${y-2}" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="25">${safe(f.score)}</text><text x="925" y="${y}" text-anchor="end" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="${awaySize}">${safe(f.away)}</text>`;
      y+=45;
    });

    const cols=Math.min(3,Math.max(1,data.leagues.length)),gap=18,areaX=50,areaW=980,cardW=(areaW-gap*(cols-1))/cols,baseY=690,cardH=330;
    data.leagues.forEach((x,idx)=>{
      const x0=areaX+(idx%cols)*(cardW+gap),y0=baseY+Math.floor(idx/cols)*(cardH+18);
      svg+=`<rect x="${x0}" y="${y0}" width="${cardW}" height="${cardH}" rx="5" fill="${paper}" stroke="${cream}" stroke-width="4"/>`;
      const headSize=fitSize(x.league.toUpperCase(),cardW-40,31,19,'Impact,Arial Black');
      svg+=`<text x="${x0+cardW/2}" y="${y0+48}" text-anchor="middle" fill="${ink}" font-family="Impact,Arial Black" font-size="${headSize}">${safe(x.league.toUpperCase())}</text><line x1="${x0+20}" x2="${x0+cardW-20}" y1="${y0+62}" y2="${y0+62}" stroke="#b19f77"/>`;
      if(!x.awards.length){
        svg+=`<text x="${x0+28}" y="${y0+105}" fill="${ink}" font-family="Arial" font-size="18">No eligible entries</text>`;
        return;
      }
      let yy=y0+95;
      x.awards.forEach(a=>{
        const colour=awardColour(a.label),label=cleanAwardLabel(a.label),mark=awardMark(a.label);
        svg+=`<text x="${x0+28}" y="${yy}" fill="${colour}" font-family="Arial" font-weight="700" font-size="14" letter-spacing="1">${mark} ${safe(label)}</text>`;
        let nameY=yy+30;
        (a.names.length?a.names:['—']).forEach(line=>{
          const fs=fitSize(line,cardW-56,20,13,'Arial Narrow,Arial');
          svg+=`<text x="${x0+28}" y="${nameY}" fill="${ink}" font-family="Arial Narrow,Arial" font-weight="700" font-size="${fs}">${safe(line)}</text>`;
          nameY+=22;
        });
        yy=nameY+18;
      });
    });

    const rows=Math.ceil(data.leagues.length/cols),crowdY=rows>1?baseY+rows*(cardH+18)+20:1050;
    svg+=`<rect x="0" y="${crowdY}" width="1080" height="${1620-crowdY}" fill="#14251a" opacity=".94"/>`;
    for(let i=0;i<36;i++){const cx=18+i*31+(i%3)*4,cy=crowdY+85+(i%5)*8;svg+=`<circle cx="${cx}" cy="${cy}" r="11" fill="#0b1710"/><rect x="${cx-8}" y="${cy+8}" width="16" height="45" rx="6" fill="#0b1710"/>`;if(i%4===0)svg+=`<path d="M${cx-4} ${cy+20}L${cx-22} ${cy-15}M${cx+4} ${cy+20}L${cx+25} ${cy-18}" stroke="#0b1710" stroke-width="8" stroke-linecap="round"/>`}
    svg+=`<text x="540" y="${crowdY+185}" text-anchor="middle" fill="${cream}" font-family="Impact,Arial Black" font-size="34" letter-spacing="2">SAME AGAIN NEXT WEEK?</text><text x="540" y="${crowdY+230}" text-anchor="middle" fill="${gold}" font-family="Georgia" font-style="italic" font-size="26">Different week. Same dreams.</text><line x1="100" x2="980" y1="1542" y2="1542" stroke="${cream}" opacity=".45"/><text x="540" y="1580" text-anchor="middle" fill="${cream}" font-family="Arial" font-weight="700" font-size="18" letter-spacing="5">PREDICTIONS · RIVALRY · BANTER · GLORY</text></svg>`;
    return svg;
  }

  function download(){
    const data=parsePreview(),W=1080,H=1620,svg=makeSvg(data);
    const img=new Image(),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
    img.onload=()=>{
      const c=document.createElement('canvas');c.width=W;c.height=H;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url);
      c.toBlob(b=>{
        const a=document.createElement('a'),slug=data.round.replace(/\s+/g,'-').replace(/[^A-Za-z0-9-]/g,'');
        a.href=URL.createObjectURL(b);a.download='Super-6-'+(slug||'Weekly')+'.png';a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      },'image/png');
    };
    img.onerror=()=>{URL.revokeObjectURL(url);alert('Could not build the poster PNG.');};
    img.src=url;
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('#downloadPoster');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    download();
  },true);
})();