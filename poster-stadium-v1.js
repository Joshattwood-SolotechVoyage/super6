// Super 6 Stadium Edition: dynamic preview and PNG, no scoring/database mutations.
(()=>{
'use strict';
const W=1122,H=1402;
const P={cream:'#f5e9c7',paper:'#f2e3bc',ink:'#183226',gold:'#e9bb50',red:'#ae3033',green:'#0a2e20',blue:'#183e5f',grey:'#667389'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text=e=>(e?.textContent||'').replace(/\s+/g,' ').trim();
const $=(s,p=document)=>p.querySelector(s);
let active=null,busy=false,serial=0,scheduled=false;
function lines(el){
 if(!el)return[];
 const out=[];let b='';
 for(const n of el.childNodes){if(n.nodeName==='BR'){if(b.trim())out.push(b.trim());b='';}else b+=n.textContent||'';}
 if(b.trim())out.push(b.trim());
 return out.length?out:(el.innerText||el.textContent||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
}
function parse(){
 const p=$('#posterPreview');if(!p)return null;
 const base=[...p.querySelectorAll('.poster-box')].find(x=>!x.closest('.poster-grid'));
 const fixtures=[...(base?.querySelectorAll('.poster-match')||[])].map(row=>{
 const s=row.querySelectorAll('span');return {home:text(s[0]),away:text(s[s.length-1]),score:text($('b',row))};});
 const leagues=[...p.querySelectorAll('.poster-grid .poster-box')].map(box=>({
 name:text($('h4',box)),awards:[...box.querySelectorAll('.award')].map(a=>({label:text($('.award-label',a)),names:lines($('b',a))}))
 }));
 return fixtures.length&&leagues.length?{round:text($('.poster-week',p))||'WEEK RESULTS',ribbon:text($('.poster-ribbon',p)),fixtures,leagues}:null;
}
const ctx=document.createElement('canvas').getContext('2d');
function fit(value,max,start=24,min=11){for(let i=start;i>=min;i--){ctx.font='900 '+i+'px Impact, Arial Narrow, sans-serif';if(ctx.measureText(String(value)).width<=max)return i;}return min;}
function tx(x,y,str,size=20,color=P.ink,opts={}){
 const a=opts.a||'start',weight=opts.w||900,font=opts.f||'Impact,Arial Narrow,Arial Black,sans-serif';
 return '<text x="'+x+'" y="'+y+'" text-anchor="'+a+'" fill="'+color+'" font-family="'+font+'" font-size="'+size+'" font-weight="'+weight+'"'+(opts.i?' font-style="italic"':'')+(opts.space?' letter-spacing="'+opts.space+'"':'')+(opts.stroke?' stroke="'+opts.stroke+'" stroke-width="2.5" paint-order="stroke"':'')+'>'+esc(str)+'</text>';
}
function box(x,y,w,h,color,r=0,stroke='',sw=1){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+color+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';}
function line(x,y,ex,ey,c='#c5b78f',width=1){return '<path d="M'+x+' '+y+'L'+ex+' '+ey+'" fill="none" stroke="'+c+'" stroke-width="'+width+'"/>';}
function ball(x,y,r){let s='<g fill="none" stroke="'+P.cream+'" stroke-width="4"><circle cx="'+x+'" cy="'+y+'" r="'+r+'"/>';let p=[];
 for(let j=0;j<5;j++){const a=-Math.PI/2+Math.PI*2*j/5;p.push([x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45]);}
 s+='<polygon points="'+p.map(a=>a.join(',')).join(' ')+'"/>';p.forEach((v,j)=>{const a=-Math.PI/2+Math.PI*2*j/5;s+=line(v[0],v[1],x+Math.cos(a)*r,y+Math.sin(a)*r,P.cream,3);});return s+'</g>';}
function crowd(y){let s='<g fill="#051d16" opacity=".94">';for(let i=0;i<55;i++){let x=i*22+(i%3)*3,top=y+(i*7%26);s+='<circle cx="'+x+'" cy="'+top+'" r="10"/><path d="M'+(x-10)+' '+(top+6)+'h20l8 67h-36z"/>';if(i%3===0)s+='<path d="M'+(x-7)+' '+(top+18)+'l-13 -36M'+(x+7)+' '+(top+18)+'l14 -40" fill="none" stroke="#051d16" stroke-width="8" stroke-linecap="round"/>';}return s+'</g>';}
function trophy(x,y,k=1){return '<g transform="translate('+x+' '+y+') scale('+k+')" fill="url(#gold)" stroke="#f7d474" stroke-width="3" stroke-linejoin="round"><path d="M12 0h57v35c0 25-12 39-29 39S12 60 12 35Z"/><path d="M12 10H0v21c0 15 11 21 22 24M69 10h12v21c0 15-11 21-22 24" fill="none"/><path d="M34 75h13v18h16v9H19v-9h15Z"/></g>';}
function badge(label,x,y){const v=String(label).toLowerCase();
 const p=[['villa','#73304b','#81b7d5','AVL'],['city','#58adca','#d4f4ff','MCI'],['arsenal','#bd303b','#f1bb60','ARS'],['everton','#3254a3','#eeeeef','EVE'],['chelsea','#174ca3','#eac45b','CHE'],['spurs','#263754','#f9f9f4','TOT'],['palace','#b12e32','#2466a9','PAL'],['newcastle','#222222','#eeeeee','NEW'],['liverpool','#ac272c','#e2c991','LIV'],['brighton','#2264ad','#efefef','BHA'],['united','#b9272a','#ebb73c','MUN'],['bournemouth','#b32d33','#151b19','BOU']].find(p=>v.includes(p[0]))||['other','#1c6548','#d8c593',v.slice(0,3).toUpperCase()];
 return '<g><path d="M'+(x-15)+' '+(y-19)+'h30v27q-15 22-30 0Z" fill="'+p[1]+'" stroke="'+P.gold+'" stroke-width="2.5"/><path d="M'+x+' '+(y-18)+'h14v26l-14 18Z" fill="'+p[2]+'" opacity=".48"/>'+tx(x,y+2,p[3],11,P.cream,{a:'middle',stroke:'#253727'})+'</g>';
}
function resultsStats(data){
 let total=0,big=null,margin=-1;
 data.fixtures.forEach(f=>{const m=f.score.match(/(\d+)\s*[-–:]\s*(\d+)/);if(!m)return;const h=+m[1],a=+m[2];total+=h+a;const diff=Math.abs(h-a);if(diff>margin){margin=diff;big={...f,winner:h>a?f.home:f.away,margin:diff};}});
 return {total,big};
}
function named(v){const m=String(v).match(/^(.*?)\s*[·•-]\s*(\d+)\s*pts?/i);return {name:m?m[1]:v,points:m?Number(m[2]):null};}
function topPlayer(data,rows){const out=[];data.leagues.forEach(l=>l.awards.forEach(a=>{if(/1st|first/i.test(a.label))a.names.forEach(n=>out.push(named(n)));}));if(!out.some(o=>o.points!==null))rows.filter(r=>r.is_winner).forEach(r=>out.push({name:r.player_name,points:r.points}));return out.filter(o=>o.points!==null).sort((a,b)=>b.points-a.points)[0]||{name:'No winner yet',points:null};}
async function details(data){
 try{
 const b=window.Super6Backend;if(!b?.client)return[];
 const title=data.round.replace(/\s*results\s*$/i,'').trim();
 const res=await b.client().from('admin_weekly_podium_details').select('round_id,round_name,actual_first_goal_minute,league_name,player_name,points,predicted_first_goal_minute,tie_break_difference,is_winner,is_second,tied_on_points').ilike('round_name',title).limit(100);
 if(res.error)return[];
 const all=res.data||[];
 const relevant=all.filter(r=>data.leagues.some(l=>l.name===r.league_name && l.awards.some(a=>a.names.some(n=>n.includes(r.player_name)))));
 return relevant.length?relevant:all;
 }catch(_){return[];}
}
function mainStory(rows){
 for(const first of rows.filter(r=>r.is_winner)){const second=rows.find(r=>r.is_second&&r.league_name===first.league_name&&r.points===first.points);
 if(second)return {first,second};}return null;
}
function stadium(data,rows){
 const S=resultsStats(data),top=topPlayer(data,rows),story=mainStory(rows);
 const matchMin=String(data.ribbon||'').match(/first.goal\D*(\d+)/i);
 const min=rows[0]?.actual_first_goal_minute??(matchMin?Number(matchMin[1]):null);
 let a='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><defs>'+
 '<radialGradient id="bg" cx="50%" cy="25%" r="82%"><stop stop-color="#1a563c"/><stop offset=".5" stop-color="#0a3a29"/><stop offset="1" stop-color="#061f18"/></radialGradient>'+
 '<linearGradient id="gold"><stop stop-color="#ffedac"/><stop offset=".5" stop-color="#dfac3b"/><stop offset="1" stop-color="#a8762c"/></linearGradient>'+
 '<linearGradient id="beam"><stop stop-color="#fff4d1" stop-opacity=".48"/><stop offset="1" stop-color="#fff4d1" stop-opacity="0"/></linearGradient>'+
 '<pattern id="grit" width="16" height="19" patternUnits="userSpaceOnUse"><circle cx="3" cy="6" r="1" fill="#fff2bd" opacity=".15"/><circle cx="14" cy="12" r=".7" fill="#fff2bd" opacity=".2"/></pattern></defs>';
 a+=box(0,0,W,H,'url(#bg)')+box(0,0,W,H,'url(#grit)');
 a+='<path d="M25 18Q561 35 1097 18L1093 1388Q561 1370 28 1388Z" stroke="'+P.cream+'" stroke-width="3" fill="none" opacity=".65"/>';
 a+='<path d="M75 188L305 600L2 590Z" fill="url(#beam)"/><path d="M1045 188L1120 585L808 600Z" fill="url(#beam)"/>';
 for(let z=0;z<2;z++)for(let i=0;i<9;i++)a+='<circle cx="'+((z===0?20:987)+i*11)+'" cy="185" r="4" fill="#fff3c9" opacity=".92"/>';
 a+=crowd(540)+crowd(1311);
 a+=tx(42,48,'SIX',21,P.cream,{space:2})+tx(42,73,'GAMES',21,P.cream,{space:2})+tx(42,98,'ONE',21,P.cream,{space:2})+tx(42,123,'PASSION',21,P.cream,{space:2});
 a+=tx(560,137,'SUPER 6',154,P.cream,{a:'middle',space:1,stroke:'#12452f'});
 a+=box(282,146,555,59,P.cream,3)+tx(561,187,data.round.toUpperCase(),fit(data.round.toUpperCase(),522,48,31),P.green,{a:'middle'});
 a+='<path d="M252 211H873L849 248H278Z" fill="'+P.red+'"/>';
 const caption='REAL MATCHES · REAL DRAMA'+(min!==null?' · FIRST GOAL '+min+"'":'');
 a+=tx(561,237,caption,fit(caption,548,23,15),P.cream,{a:'middle',space:1});
 a+=ball(973,123,64);
 for(let i=0;i<7;i++)a+=line(880-i*16,83+i*11,948-i*7,47+i*11,P.cream,2);
 ['REAL','FOOTBALL','REAL','PEOPLE','REAL','DRAMA'].forEach((w,i)=>a+=tx(41,340+i*30,w,22,P.cream,{i:true}));
 ['SAME','GAMES','DIFFERENT','HEROES'].forEach((w,i)=>a+=tx(974,343+i*33,w,w==='DIFFERENT'?20:22,P.cream,{i:true}));
 // The stadium match board.
 a+=box(177,256,766,338,P.paper,15,P.cream,5);
 a+=tx(561,290,"THIS WEEK'S MATCH RESULTS",30,P.ink,{a:'middle'})+line(195,303,925,303,'#c4b38d',2);
 data.fixtures.slice(0,6).forEach((f,i)=>{
 const y=335+i*43;a+=box(194,y-28,733,40,i%2?'#e8d5a5':'#f5e8c5',4);
 a+=badge(f.home,261,y-4)+tx(317,y+3,f.home,fit(f.home,170,22,13),P.ink);
 a+=box(499,y-27,123,36,P.green,4)+tx(561,y+2,f.score,29,P.cream,{a:'middle'});
 a+=tx(801,y+3,f.away,fit(f.away,147,22,13),P.ink,{a:'end'})+badge(f.away,865,y-4);
 });
 // Awards, feature story and stats.
 a+=box(27,613,307,311,'#092b20',15,P.cream,4)+box(346,613,416,311,P.paper,15,P.cream,4)+box(774,613,321,311,'#092b20',15,P.cream,4);
 a+=trophy(53,639,.87)+tx(217,659,'WINNER',41,P.gold,{a:'middle'})+tx(214,696,'OF THE WEEK',29,P.cream,{a:'middle'});
 a+=box(54,744,251,60,P.cream,8)+tx(180,786,top.name,fit(top.name,235,34,16),P.green,{a:'middle'});
 a+=tx(181,883,top.points===null?'—':top.points+' pts',77,P.gold,{a:'middle'});
 a+='<path d="M356 623H753L729 673H377Z" fill="'+P.red+'"/>';
 if(story){
 const w=story.first,r=story.second;
 a+=tx(556,655,'FIRST GOAL TIEBREAK DRAMA',fit('FIRST GOAL TIEBREAK DRAMA',355,29,20),P.cream,{a:'middle'});
 a+=tx(555,695,w.player_name+' BEATS '+r.player_name,fit(w.player_name+' beats '+r.player_name,368,21,13),P.green,{a:'middle'});
 a+=tx(555,721,'ON THE TIEBREAK!',19,P.red,{a:'middle'});
 a+=box(476,746,159,116,'#fff0c8',8,'#d8ab61',2);
 a+=tx(555,770,'BOTH SCORED',17,P.green,{a:'middle'})+tx(555,797,w.points+' PTS',28,P.green,{a:'middle'});
 const equaldiff=Number(w.tie_break_difference)===Number(r.tie_break_difference);
 a+=tx(555,824,equaldiff?'BOTH '+w.tie_break_difference+' MIN AWAY':'CLOSEST MINUTE',15,P.green,{a:'middle'});
 a+=tx(555,848,min===null?'FIRST GOAL':"GOAL: "+min+"'",19,P.red,{a:'middle'});
 a+=tx(407,767,String(w.player_name).split(' ')[0].toUpperCase(),16,P.green,{a:'middle'});
 a+=tx(694,767,String(r.player_name).split(' ')[0].toUpperCase(),16,P.green,{a:'middle'});
 a+=tx(408,846,(w.predicted_first_goal_minute??'—')+"'",63,'#195439',{a:'middle',stroke:'#e4cc91'});
 a+=tx(690,846,(r.predicted_first_goal_minute??'—')+"'",63,'#195439',{a:'middle',stroke:'#e4cc91'});
 a+=box(447,870,218,43,P.red,7)+tx(555,899,String(w.player_name).split(' ')[0].toUpperCase()+' WINS!',fit(w.player_name+' WINS!',198,23,14),P.cream,{a:'middle'});
 }else{
 a+=tx(555,655,'THE WEEK IN FOOTBALL',27,P.cream,{a:'middle'});
 a+=tx(555,721,'SIX GAMES. ONE PASSION.',26,P.green,{a:'middle'})+ball(555,796,52);
 a+=tx(555,886,'EVERY POINT COUNTS',29,P.red,{a:'middle'});
 }
 a+=tx(932,651,'WEEKLY KEY STATS',26,P.cream,{a:'middle'});
 const big=S.big,bd=big?big.margin+' GOALS · '+big.winner:'—';
 const tiles=[['TOP SCORE',top.points===null?'—':top.points+' PTS',top.name],
 ['FIRST GOAL',min===null?'—':min+"'",'Official first goal minute'],
 ['BIGGEST WIN',bd,big?big.home+' '+big.score+' '+big.away:'No completed scores']];
 tiles.forEach((tile,i)=>{let y=670+i*80;
 a+=box(794,y,280,72,P.cream,8)+tx(809,y+19,tile[0],14,P.ink,{space:1})+tx(810,y+47,tile[1],fit(tile[1],251,29,16),P.green)+tx(810,y+64,tile[2],fit(tile[2],249,13,10),P.ink,{w:500});});
 // Full width compact awards grid, up to three leagues.
 const n=Math.min(3,data.leagues.length),gap=10,cw=(1066-gap*(n-1))/n;
 data.leagues.slice(0,3).forEach((l,i)=>{
 const x=28+i*(cw+gap),y=937,bar=[P.blue,'#782631','#14563e'][i];
 a+=box(x,y,cw,253,P.cream,11,'#faf0d1',3)+box(x+3,y+3,cw-6,50,bar,9);
 a+=tx(x+16,y+37,'★',28,P.cream)+tx(x+48,y+34,l.name.toUpperCase(),fit(l.name.toUpperCase(),cw-60,23,13),P.cream);
 let yy=y+73;
 for(const aw of l.awards){
 const one=/1st|first/i.test(aw.label),two=/2nd|second/i.test(aw.label);
 const label=one?'1ST PLACE':two?'2ND PLACE':'WOODEN SPOON',colour=two?P.blue:P.red;
 a+=tx(x+18,yy,one?'★':two?'●':'◆',22,colour)+tx(x+51,yy-1,label,15,colour,{space:.6});
 let ly=yy+21;
 for(const nm of aw.names.slice(0,4)){a+=tx(x+51,ly,nm,fit(nm,cw-63,16,11),P.ink);ly+=18;}
 if(aw.names.length>4){a+=tx(x+51,ly,'+'+(aw.names.length-4)+' more',11,P.ink);ly+=16;}
 yy=ly+12;
 if(yy>1186)break;
 }
 });
 // Footer uses the full canvas, as in the requested design.
 a+=tx(561,1262,'NEXT WEEK, WE GO AGAIN',fit('NEXT WEEK, WE GO AGAIN',882,67,42),P.cream,{a:'middle',i:true,stroke:'#103023'});
 a+=tx(561,1305,'Different week. Same dreams.',30,P.gold,{a:'middle',i:true,f:'Georgia,serif',w:500});
 a+='<path d="M294 1326H832L804 1374H329Z" fill="'+P.red+'"/>';
 a+=tx(561,1360,'#BackStronger',36,P.cream,{a:'middle',i:true});
 a+=tx(40,1330,'PREDICTIONS',13,P.cream,{space:1})+tx(40,1350,'RIVALRY',13,P.cream,{space:1})+tx(40,1370,'BANTER · GLORY',13,P.cream,{space:1});
 a+=tx(1082,1330,'SAME GAMES',13,P.cream,{a:'end',space:1})+tx(1082,1350,'MORE STORIES',13,P.cream,{a:'end',space:1});
 return a+'</svg>';
}
function url(svg){return URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));}
async function refresh(){
 const d=parse();if(!d)return;
 const key=JSON.stringify(d);if(active?.key===key&&$('#posterPreview .s6-stadium-art'))return;
 const request=++serial,rows=await details(d);if(request!==serial)return;
 const graphic=stadium(d,rows);active={key,data:d,svg:graphic};
 const p=$('#posterPreview');if(!p)return;
 let img=$('.s6-stadium-art',p);
 if(!img){img=document.createElement('img');img.className='s6-stadium-art';img.alt='Stadium Edition Super 6 weekly results poster';p.appendChild(img);}
 const next=url(graphic),previous=img.dataset.ref;
 img.addEventListener('load',()=>{if(previous)URL.revokeObjectURL(previous);},{once:true});
 img.src=next;img.dataset.ref=next;
 p.classList.add('s6-stadium-preview');
 const card=p.closest('.modal-card');if(card)card.classList.add('s6-stadium-modal');
}
function later(){
 if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;refresh().catch(e=>console.warn('Super 6 poster:',e));},100);
}
async function save(){
 const d=parse();if(!active||active.key!==JSON.stringify(d))await refresh();
 if(!active)throw Error('Open the weekly poster preview first.');
 const source=url(active.svg);
 try{
 const img=new Image();
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Could not render poster image.'));img.src=source;});
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');
 context.drawImage(img,0,0);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create PNG')),'image/png'));
 const link=document.createElement('a'),href=URL.createObjectURL(blob);
 link.href=href;link.download='Super-6-'+active.data.round.replace(/[^a-z0-9 ]/gi,'').trim().replace(/\s+/g,'-')+'-Stadium.png';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(href),15000);
 }finally{URL.revokeObjectURL(source);}
}
const style=document.createElement('style');style.id='s6-stadium-styles';
style.textContent=[
 '#posterPreview.s6-stadium-preview{padding:0!important;border:0!important;box-shadow:0 12px 36px #00150e70!important;background:#07271d!important;max-width:850px!important;width:100%!important;margin:8px auto!important;box-sizing:border-box!important}',
 '#posterPreview.s6-stadium-preview:before{display:none!important}',
 '#posterPreview.s6-stadium-preview > :not(.s6-stadium-art){display:none!important}',
 '#posterPreview.s6-stadium-preview .s6-stadium-art{display:block!important;width:100%!important;height:auto!important;max-width:100%!important}',
 '.s6-stadium-modal{width:min(1080px,100%)!important;max-width:min(1080px,calc(100vw - 22px))!important}',
 '@media(max-width:640px){.s6-stadium-modal{padding:9px!important}}'
].join('');
document.head.appendChild(style);
const watcher=new MutationObserver(mutations=>{
 if(!$('#posterPreview')||busy)return;
 if(mutations.every(m=>m.target?.closest?.('#posterPreview.s6-stadium-preview')&&m.addedNodes.length===0))return;
 later();
});
watcher.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('#posterBtn')){setTimeout(later,120);setTimeout(later,450);}},true);
document.addEventListener('click',e=>{
 if(!e.target.closest('#downloadPoster'))return;
 e.preventDefault();e.stopImmediatePropagation();
 if(busy)return;busy=true;
 save().catch(err=>{console.error(err);alert(err.message||'Poster export failed.');}).finally(()=>{busy=false;});
},true);
later();
})();
