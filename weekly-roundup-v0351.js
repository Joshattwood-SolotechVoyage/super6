// Super 6 v0.35.1 — extended weekly roundup, built on the existing results preview.
// No scoring logic, authentication, payment settings or stored results are changed.
(function(){
  'use strict';
  var latest=null;
  var latestSvg='';
  var brandLogoPromise=null;
  function loadBrandLogo(){
    if(!brandLogoPromise)brandLogoPromise=new Promise(function(resolve,reject){
      var img=new Image();
      img.onload=function(){resolve(img);};
      img.onerror=function(){reject(new Error('The Super 6 logo could not be loaded. Check super6-logo.png and try again.'));};
      img.src='super6-logo.png';
    });
    return brandLogoPromise;
  }
  function drawBrandLogo(ctx,img){
    // Keep the official logo in the same position on the exported PNG as in the preview.
    ctx.save();
    ctx.fillStyle='#f6e9c8'; ctx.fillRect(41,24,224,166);
    ctx.strokeStyle='#efc66d';ctx.lineWidth=4;ctx.strokeRect(41,24,224,166);
    var boxW=210,boxH=152,scale=Math.min(boxW/img.naturalWidth,boxH/img.naturalHeight);
    var w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,48+(boxW-w)/2,31+(boxH-h)/2,w,h);
    ctx.restore();
  }
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c];});};
  var txt=function(n){return (n&&n.textContent||'').replace(/\s+/g,' ').trim();};
  var $=function(s,root){return (root||document).querySelector(s);};
  var $$=function(s,root){return Array.from((root||document).querySelectorAll(s));};

  function linesFrom(element){
    if(!element)return [];
    var output=[],part='';
    Array.from(element.childNodes).forEach(function(n){
      if(n.nodeName==='BR'){if(part.trim())output.push(part.trim());part='';}
      else part+=n.textContent||'';
    });
    if(part.trim())output.push(part.trim());
    return output.length?output:[txt(element)];
  }
  function parseNames(element){
    return linesFrom(element).map(function(line){
      var m=line.match(/^(.+?)\s*[·•]\s*(\d+)\s*pts?\b/i);
      return m?{name:m[1].trim(),points:Number(m[2])}:{name:line.trim(),points:null};
    }).filter(function(x){return x.name.length;});
  }
  function parse(){
    var preview=document.getElementById('posterPreview');
    if(!preview||!$('.poster-grid',preview))return null;
    var round=txt($('.poster-week',preview))||'ROUND RESULTS';
    var ribbon=txt($('.poster-ribbon',preview));
    var fixtures=$$('.poster-match',preview).map(function(row){
      var names=$$('span',row),v=txt($('b',row)),m=v.match(/(\d+)\s*[-–—]\s*(\d+)/);
      return {home:txt(names[0]),away:txt(names[names.length-1]),score:v,homeGoals:m?Number(m[1]):null,awayGoals:m?Number(m[2]):null};
    });
    var cards=$$('.poster-grid .poster-box',preview);
    var counts=$$('#weeklyResults .weekly-outcome-card').map(function(c){
      return {name:txt($('h4',c)),value:parseInt(txt($('.weekly-entry-count',c)),10)||0};
    });
    var leagues=cards.map(function(card){
      var name=txt($('h4',card));
      var awards={winner:[],second:[],spoon:[]};
      $$('.award',card).forEach(function(a){
        var label=txt($('.award-label',a)).toLowerCase();
        var kind=label.includes('1st')?'winner':label.includes('2nd')?'second':label.includes('spoon')?'spoon':null;
        if(kind)awards[kind]=parseNames($('b',a));
      });
      var count=counts.find(function(x){return x.name.toLowerCase()===name.toLowerCase();});
      return {name:name,entries:count?count.value:null,awards:awards,tiebreak:txt($('.poster-tiebreak',card))};
    });
    if(!leagues.length)return null;
    var winners=leagues.flatMap(function(l){return l.awards.winner.map(function(w){return {name:w.name,points:w.points,league:l.name};});});
    var best=winners.reduce(function(n,w){return w.points!=null?Math.max(n,w.points):n;},-1);
    var stars=best>=0?winners.filter(function(w){return w.points===best;}):[];
    var validFixtures=fixtures.filter(function(f){return f.homeGoals!=null&&f.awayGoals!=null;});
    var goals=validFixtures.reduce(function(n,f){return n+f.homeGoals+f.awayGoals;},0);
    var draws=validFixtures.filter(function(f){return f.homeGoals===f.awayGoals;}).length;
    var biggest=validFixtures.slice().sort(function(a,b){return b.homeGoals+b.awayGoals-a.homeGoals-a.awayGoals;})[0]||null;
    return {round:round,ribbon:ribbon,fixtures:fixtures,leagues:leagues,stars:stars,best:best,goals:goals,draws:draws,biggest:biggest,entries:leagues.reduce(function(n,l){return n+(l.entries||0);},0)};
  }

  function poster(data){
    var W=1080,cream='#f6e9c8',gold='#efc66d',deep='#103823',green='#174b30',ink='#122c20',paper='#ffedc9',red='#a84936';
    var parts=[],y=0;
    var bg=function(x,y,w,h,fill,r,stroke){parts.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+(r||0)+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="3"':'')+'/>');};
    var line=function(x1,y1,x2,y2,stroke,width,opacity){parts.push('<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" stroke="'+stroke+'" stroke-width="'+(width||2)+'" opacity="'+(opacity==null?1:opacity)+'"/>');};
    var heading=function(x,yy,s,font,color,anchor,max,weight){
      var size=font||26,content=String(s||'');
      if(max){var ratio=content.length*size*.55/max; if(ratio>1)size=Math.max(16,Math.floor(size/ratio));}
      parts.push('<text x="'+x+'" y="'+yy+'" text-anchor="'+(anchor||'start')+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" font-weight="'+(weight||800)+'" fill="'+(color||ink)+'">'+esc(content)+'</text>');
    };
    var decorated=function(yy,n){
      for(var i=0;i<n;i++){var x=48+(i*137)%975,dy=yy+(i%4)*35;parts.push('<circle cx="'+x+'" cy="'+dy+'" r="'+(i%3+2)+'" fill="'+(i%2?gold:cream)+'" opacity=".48"/>');}
    };
    var names=function(rows){return rows.length?rows.map(function(w){return w.name;}).join(' / '):'—';};
    var point=function(rows){return rows.length&&rows[0].points!=null?rows[0].points+' PTS':'';};
    var statBox=function(x,v,label){
      bg(x,575,294,112,'#22563a',15,'#477459');
      heading(x+147,635,v,48,cream,'middle',265,900);
      heading(x+147,661,label,17,gold,'middle',270,750);
    };

    bg(0,0,W,235,deep);
    parts.push('<path d="M-90 235L575 -120M210 320L1000 -105M800 265L1145 60" stroke="#306243" stroke-width="42" opacity=".34"/>');
    decorated(48,18);
    heading(540,89,'SUPER 6',90,cream,'middle',950,900);
    heading(540,124,'THE ROUND-UP',22,gold,'middle',900,900);
    heading(540,174,data.round.toUpperCase(),42,cream,'middle',930,900);
    heading(540,205,'SIX MATCHES  •  PLENTY OF BRAGGING RIGHTS',16,gold,'middle',960,700);

    bg(35,250,1010,300,paper,20);
    bg(35,250,1010,53,gold,20);
    bg(35,283,1010,20,gold,0);
    heading(540,288,data.stars.length>1?'★ JOINT STARS OF THE WEEK ★':'★ WINNER OF THE WEEK ★',24,ink,'middle',945,900);
    if(data.stars.length){
      var heroNames=names(data.stars);
      heading(540,385,heroNames,51,deep,'middle',955,900);
      heading(540,460,data.best+' POINT'+(data.best===1?'':'S'),73,red,'middle',910,900);
      var heroLeague=data.stars.map(function(s){return s.league;}).filter(function(s,i,a){return a.indexOf(s)===i;}).join(' / ');
      heading(540,512,heroLeague+'  •  Top score across all leagues',24,ink,'middle',950,700);
    }else{
      heading(540,400,'No counted winners yet',45,deep,'middle',900,900);
      heading(540,467,'This round needs eligible paid results',23,red,'middle',920,700);
    }

    statBox(56,String(data.entries),'COUNTED ENTRIES');
    statBox(393,String(data.goals),'MATCH GOALS');
    statBox(730,String(data.draws),'DRAWN MATCHES');
    var firstGoal=(data.ribbon.match(/FIRST GOAL\s+\d+'?/i)||[])[0];
    if(firstGoal)heading(540,708,firstGoal,18,gold,'middle',960,850);
    y=748;
    heading(54,y,'LEAGUE-BY-LEAGUE DRAMA',36,cream,'start',967,900);
    heading(54,y+30,'Every winner. Every chase. Every wooden spoon.',21,gold,'start',967,650);
    y+=58;

    data.leagues.forEach(function(l,i){
      var h=l.tiebreak?276:246;
      bg(40,y,1000,h,i%2? '#ecdfbe':paper,14);
      bg(40,y,1000,58,i%2?'#2c5c40':green,14);
      bg(40,y+37,1000,22,i%2?'#2c5c40':green,0);
      heading(66,y+41,l.name.toUpperCase(),30,cream,'start',700,900);
      if(l.entries!=null)heading(1010,y+39,l.entries+' ENTRIES',17,gold,'end',190,800);
      heading(72,y+90,'★  THE CHAMPION',18,red,'start',450,850);
      heading(690,y+90,point(l.awards.winner),23,red,'start',300,900);
      heading(72,y+124,names(l.awards.winner),30,ink,'start',920,900);
      line(66,y+141,1014,y+141,'#cdbb94',2);
      heading(72,y+172,'02  ON THEIR HEELS',17,green,'start',520,900);
      heading(690,y+172,point(l.awards.second),19,green,'start',300,900);
      heading(72,y+200,names(l.awards.second),23,ink,'start',890,750);
      heading(72,y+231,'🥄  SPOON CLUB: '+names(l.awards.spoon),19,red,'start',920,800);
      if(l.tiebreak)heading(72,y+259,l.tiebreak,16,red,'start',920,750);
      y+=h+14;
    });

    y+=35;
    heading(54,y,'THE SIX ON THE PITCH',36,cream,'start',967,900);
    heading(54,y+30,'The actual results behind the beautiful chaos.',20,gold,'start',955,650);
    y+=52;
    bg(40,y,1000,Math.max(70,data.fixtures.length*60+20),paper,14);
    data.fixtures.forEach(function(f,i){
      var ry=y+51+i*60;
      if(i%2===1)bg(50,y+16+i*60,980,56,'#eddfbf',7);
      heading(75,ry,f.home,23,ink,'start',315,800);
      bg(435,ry-32,210,45,deep,8);
      heading(540,ry,f.score,26,cream,'middle',200,900);
      heading(1007,ry,f.away,23,ink,'end',315,800);
    });
    y+=Math.max(70,data.fixtures.length*60+20)+26;

    if(data.biggest){
      bg(40,y,1000,118,'#26593c',15);
      heading(70,y+42,'⚽  GOAL FEST',25,gold,'start',315,900);
      heading(70,y+84,data.biggest.home+' '+data.biggest.score+' '+data.biggest.away,26,cream,'start',925,850);
      y+=138;
    }

    var H=y+184;
    bg(0,y,W,184,deep);
    decorated(y+20,19);
    heading(540,y+48,"THE ROUND IS OVER. THE BANTER ISN'T.",25,gold,'middle',960,900);
    heading(540,y+108,'#WeComeBackStronger',49,cream,'middle',1000,900);
    heading(540,y+149,'SUPER 6  •  PREDICTIONS  •  RIVALRY  •  GLORY',18,gold,'middle',1000,750);
    parts.unshift('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">');
    parts.push('</svg>');
    return parts.join('');
  }

  function makeBlob(svg){
    return new Promise(function(resolve,reject){
      var img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
      img.onload=function(){
        var canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Number(img.naturalHeight)||2500;
        loadBrandLogo().then(function(logo){
          var ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0);
          drawBrandLogo(ctx,logo);
          canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error('PNG conversion failed'));},'image/png');
        }).catch(reject).finally(function(){URL.revokeObjectURL(url);});
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('Could not render roundup image'));};
      img.src=url;
    });
  }
  function download(blob,name){
    var url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},3000);
  }
  function shareText(d){
    var names=function(rows){return rows.length?rows.map(function(w){return w.name;}).join(' / '):'—';};
    var point=function(rows){return rows.length&&rows[0].points!=null?rows[0].points+' PTS':'';};
    var text=['⚽ SUPER 6 — '+d.round,'','🏆 WINNER OF THE WEEK: '+(d.stars.length?d.stars.map(function(x){return x.name;}).join(' / ')+' ('+d.best+' pts)':'No winner')];
    d.leagues.forEach(function(l){
      text.push('','🏟️ '+l.name,'👑 '+names(l.awards.winner)+' '+point(l.awards.winner),'🥈 '+names(l.awards.second)+' '+point(l.awards.second),'🥄 '+names(l.awards.spoon));
    });
    text.push('','⚽ '+d.goals+' goals • '+d.draws+' draws','#WeComeBackStronger');
    return text.join('\n');
  }
  async function show(dataOverride){
    var p=document.getElementById('posterPreview');
    if(!p)return;
    var data=dataOverride||parse();
    if(!data)return;
    try{await loadBrandLogo();}
    catch(error){console.warn('Super 6 roundup could not load the logo; keeping the existing weekly poster.',error);return;}
    // Another modal may have opened while the asset was loading.
    if(!p.isConnected||document.getElementById('posterPreview')!==p)return;
    latest=data;latestSvg=poster(data);
    p.innerHTML='';
    p.style.cssText='position:relative;border:0;background:transparent;padding:0;box-shadow:none;max-width:580px;margin:20px auto;';
    var img=document.createElement('img');
    img.alt='Super 6 round-up featuring the overall winner, all league awards and match results';
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(latestSvg);
    img.style.cssText='width:100%;height:auto;display:block;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.2)';
    p.appendChild(img);
    var svgHeight=Number((latestSvg.match(/viewBox="0 0 1080 (\d+)"/)||[])[1])||2401;
    var logoBox=document.createElement('div');
    logoBox.style.cssText='position:absolute;box-sizing:border-box;left:3.8%;top:'+(24/svgHeight*100)+'%;width:20.75%;height:'+(166/svgHeight*100)+'%;background:#f6e9c8;border:2px solid #efc66d;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:5px;padding:2px;';
    var logoImg=document.createElement('img');
    logoImg.src='super6-logo.png';
    logoImg.alt='Official Super 6 logo';
    logoImg.style.cssText='max-width:100%;max-height:100%;object-fit:contain;';
    logoBox.appendChild(logoImg);
    p.appendChild(logoBox);
    var modal=p.closest('.modal')||p.parentElement.parentElement;
    var title=$('.section-head h3',modal),desc=$('.section-head .muted',modal);
    if(title)title.textContent='The Super 6 Round-Up';
    if(desc)desc.textContent='The winners, the high scores, the league drama and all six match results — ready for the group chat.';
    var btn=document.getElementById('downloadPoster');
    if(!btn)return;
    btn.id='downloadRoundupImage';
    btn.disabled=false;
    btn.textContent='Download roundup PNG';
    btn.onclick=async function(){
      var original=btn.textContent;btn.disabled=true;btn.textContent='Making the image…';
      try{var blob=await makeBlob(latestSvg);download(blob,'Super-6-'+latest.round.replace(/[^a-z0-9]+/gi,'-')+'-Roundup.png');}
      catch(e){alert('Could not create the round-up image: '+e.message);}
      finally{btn.disabled=false;btn.textContent=original;}
    };
    var actions=btn.parentElement;
    var copy=document.createElement('button');copy.className='secondary';copy.type='button';copy.textContent='Copy group-chat recap';
    copy.onclick=async function(){
      try{await navigator.clipboard.writeText(shareText(latest));copy.textContent='Copied!';setTimeout(function(){copy.textContent='Copy group-chat recap';},1600);}
      catch(e){alert('Your browser could not copy the round-up text.');}
    };
    actions.appendChild(copy);
    if(navigator.share){
      var share=document.createElement('button');share.className='secondary';share.type='button';share.textContent='Share image';
      share.onclick=async function(){
        try{
          var blob=await makeBlob(latestSvg);
          var file=new File([blob],'Super-6-Roundup.png',{type:'image/png'});
          if(navigator.canShare&&!navigator.canShare({files:[file]})){download(blob,file.name);return;}
          await navigator.share({files:[file],title:'Super 6 Round-Up',text:'#WeComeBackStronger'});
        }catch(e){if(e.name!=='AbortError')alert('Sharing is not supported here. Use Download PNG instead.');}
      };
      actions.appendChild(share);
    }
    actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;';
  }
  // v0.35.2: Make the admin round-up available when a newer round is still open.
  // The existing Results UI otherwise disables #posterBtn whenever the current round has no results.
  // Historical snapshots are read-only; scoring and payment calculations remain unchanged.
  function enableRoundupButton(){
    var btn=document.getElementById('posterBtn');
    if(!btn)return;
    if(btn.disabled)btn.disabled=false;
    if(btn.textContent!=='Weekly round-up')btn.textContent='Weekly round-up';
    btn.title='Generate a PNG of the latest completed round, including previous weeks';
  }
  if(typeof MutationObserver!=='undefined'){
    var buttonObserver=new MutationObserver(enableRoundupButton);
    buttonObserver.observe(document.getElementById('adminArea')||document.body,{
      subtree:true,childList:true,attributes:true,attributeFilter:['disabled']
    });
  }
  enableRoundupButton();

  function getHistoricalPreviewData(round,results,fixtures,leagueRecords){
    var names=leagueRecords.map(function(l){return {name:l.name,id:String(l.id),order:Number(l.sort_order)||0};});
    results.forEach(function(row){
      var id=String(row.league_id||''),name=String(row.league_name||'').trim();
      if(!name)return;
      if(!names.some(function(l){return l.id===id||l.name===name;})){
        names.push({name:name,id:id,order:100});
      }
    });
    var awardRows=function(rows,field){
      return rows.filter(function(x){return Boolean(x[field]);}).map(function(x){
        return {name:String(x.username||'Player'),points:Number(x.points||0)};
      });
    };
    var leagues=names.sort(function(a,b){return a.order-b.order||a.name.localeCompare(b.name);}).map(function(l){
      var eligible=results.filter(function(row){
        return (String(row.league_id||'')===l.id||String(row.league_name||'')===l.name)&&row.counted!==false;
      });
      var winners=awardRows(eligible,'is_winner');
      var topScore=winners.length?Math.max.apply(null,winners.map(function(x){return x.points;})):null;
      var joint=topScore===null?[]:eligible.filter(function(x){return Number(x.points)===topScore;});
      var evidence='';
      if(joint.length>1&&round.official_first_goal_minute!=null){
        evidence='TIEBREAK • '+joint.map(function(x){return String(x.username||'Player')+' ±'+String(x.tie_break_difference==null?'?':x.tie_break_difference)+'m';}).join(' / ')+' • actual '+round.official_first_goal_minute+"'";
      }
      return {name:l.name,entries:eligible.length,awards:{winner:winners,second:awardRows(eligible,'is_second'),spoon:awardRows(eligible,'is_wooden_spoon')},tiebreak:evidence};
    });
    var matchResults=fixtures.filter(function(f){return !f.removed;}).map(function(f){
      var a=f.home_score==null?null:Number(f.home_score),b=f.away_score==null?null:Number(f.away_score);
      return {home:f.home_team,away:f.away_team,homeGoals:a,awayGoals:b,score:a==null||b==null?'—':a+' – '+b};
    });
    var played=matchResults.filter(function(m){return m.homeGoals!=null&&m.awayGoals!=null;});
    var winners=leagues.flatMap(function(l){return l.awards.winner.map(function(w){return {name:w.name,points:w.points,league:l.name};});});
    var best=winners.reduce(function(n,w){return Math.max(n,w.points);},-1);
    return {
      round:round.name.toUpperCase()+' RESULTS',
      ribbon:round.official_first_goal_minute!=null?'FIRST GOAL '+round.official_first_goal_minute+"'":'FINAL RESULTS',
      fixtures:matchResults,leagues:leagues,best:best,
      stars:best<0?[]:winners.filter(function(x){return x.points===best;}),
      goals:played.reduce(function(n,m){return n+m.homeGoals+m.awayGoals;},0),
      draws:played.filter(function(m){return m.homeGoals===m.awayGoals;}).length,
      biggest:played.slice().sort(function(a,b){return (b.homeGoals+b.awayGoals)-(a.homeGoals+a.awayGoals);})[0]||null,
      entries:leagues.reduce(function(n,l){return n+l.entries;},0)
    };
  }

  function openPreviewModal(){
    var root=document.getElementById('modalRoot');
    if(!root)throw new Error('The round-up window could not be opened.');
    root.innerHTML='<div class="modal" id="historicalRoundupModal"><div class="modal-card">'
      +'<div class="section-head"><div><div class="kicker">Admin · Shareable image</div><h3>Super 6 Weekly Round-Up</h3>'
      +'<div class="muted">Loading the latest completed round…</div></div><button class="secondary small" type="button" id="closeHistoricalRoundup">Close</button></div>'
      +'<div id="posterPreview" class="poster-preview"><div class="notice">Loading completed results…</div></div>'
      +'<div class="modal-actions"><button type="button" id="downloadPoster" class="big-action" disabled>Download roundup PNG</button></div>'
      +'</div></div>';
    var dialog=document.getElementById('historicalRoundupModal');
    document.getElementById('closeHistoricalRoundup').onclick=function(){root.innerHTML='';};
    dialog.addEventListener('click',function(e){if(e.target===dialog)root.innerHTML='';});
    return dialog;
  }

  var opening=false;
  async function openLatestCompletedRoundup(){
    if(opening)return;
    opening=true;
    var dialog=openPreviewModal();
    var preview=document.getElementById('posterPreview');
    try{
      if(!window.Super6Backend||!window.Super6Backend.client||!window.Super6Backend.loadRoundResults)throw new Error('Results are not ready. Please refresh the app and try again.');
      var sb=window.Super6Backend.client();
      var roundResponse=await sb.from('rounds').select('id,name,completed_at,official_first_goal_minute').eq('status','completed').order('completed_at',{ascending:false}).limit(12);
      if(roundResponse.error)throw roundResponse.error;
      var finished=roundResponse.data||[],round=null,results=[];
      for(var i=0;i<finished.length;i++){
        var candidate=finished[i];
        var candidateResults=await window.Super6Backend.loadRoundResults(candidate.id);
        if(Array.isArray(candidateResults)&&candidateResults.some(function(x){return x.counted!==false;})){
          round=candidate;results=candidateResults;break;
        }
      }
      if(!round)throw new Error('There are no completed rounds with counted results yet.');
      var fetched=await Promise.all([
        sb.from('fixtures').select('home_team,away_team,home_score,away_score,removed,sort_order').eq('round_id',round.id).order('sort_order'),
        sb.from('leagues').select('id,name,sort_order').order('sort_order')
      ]);
      if(fetched[0].error)throw fetched[0].error;
      if(fetched[1].error)throw fetched[1].error;
      if(!dialog.isConnected)return;
      var data=getHistoricalPreviewData(round,results,fetched[0].data||[],fetched[1].data||[]);
      await show(data);
    }catch(error){
      console.error('Super 6 weekly round-up could not load',error);
      if(dialog.isConnected){
        preview.innerHTML='<div class="notice bad"></div>';
        preview.querySelector('.notice').textContent='Could not load the round-up: '+(error.message||'Please try again.');
      }
    }finally{opening=false;}
  }
  document.addEventListener('click',function(event){
    if(!event.target||!event.target.closest||!event.target.closest('#posterBtn'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openLatestCompletedRoundup();
  },true);
})();