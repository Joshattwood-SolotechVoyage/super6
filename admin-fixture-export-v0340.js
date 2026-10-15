/* Super 6 v0.34.0 — four-sheet Excel export. No external libraries. */
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function sheet(matrix){
  const widths=[19,10,21,10,10,26,11,11,26,19,38,18];
  const rows=matrix.map((row,i)=>'<row r="'+(i+1)+'"'+(i===0?' ht="26" customHeight="1"':'')+'>'+
    row.map((v,j)=>{
      if(i>0&&(v===null||v===undefined||v===''))return '';
      const address=col(j)+(i+1),style=i===0?1:0;
      if(i>0&&typeof v==='number'&&Number.isFinite(v))return '<c r="'+address+'" s="'+style+'"><v>'+v+'</v></c>';
      return '<c r="'+address+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';
    }).join('')+'</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:L'+matrix.length+'"/>'+
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="19"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+
    '</cols><sheetData>'+rows+'</sheetData><autoFilter ref="A1:L'+matrix.length+'"/></worksheet>';
}
const encoder=new TextEncoder();
const table=new Uint32Array(256);
for(let i=0;i<256;i++){let a=i;for(let k=0;k<8;k++)a=a&1?0xedb88320^(a>>>1):a>>>1;table[i]=a>>>0;}
function crc(bytes){let v=0xffffffff;for(const b of bytes)v=table[(v^b)&255]^(v>>>8);return (v^0xffffffff)>>>0}
const w16=v=>Uint8Array.of(v&255,(v>>>8)&255);
const w32=v=>Uint8Array.of(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255);
function zip(files){
  const blocks=[],central=[];let pos=0;
  const put=b=>{blocks.push(b);pos+=b.length};
  for(const [path,contents] of files){
    const name=encoder.encode(path),body=encoder.encode(contents),start=pos,checksum=crc(body);
    put(Uint8Array.of(0x50,0x4b,0x03,0x04));put(w16(20));put(w16(0));put(w16(0));put(w16(0));put(w16(0));
    put(w32(checksum));put(w32(body.length));put(w32(body.length));put(w16(name.length));put(w16(0));put(name);put(body);
    central.push({name,checksum,size:body.length,start});
  }
  const directoryAt=pos;
  for(const e of central){
    put(Uint8Array.of(0x50,0x4b,0x01,0x02));put(w16(20));put(w16(20));put(w16(0));put(w16(0));put(w16(0));put(w16(0));
    put(w32(e.checksum));put(w32(e.size));put(w32(e.size));put(w16(e.name.length));put(w16(0));put(w16(0));put(w16(0));put(w16(0));put(w32(0));put(w32(e.start));put(e.name);
  }
  const directorySize=pos-directoryAt;
  put(Uint8Array.of(0x50,0x4b,0x05,0x06));put(w16(0));put(w16(0));put(w16(central.length));put(w16(central.length));
  put(w32(directorySize));put(w32(directoryAt));put(w16(0));
  return new Blob(blocks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const headers=['Competition','Round','Stage','Group','Fixture','Player 1','Score 1','Score 2','Player 2','Status','Super 6 Round','Date'];
const sheets=[['chumpions','Chumpions'],['nohope','No-Hope-A'],['fall','F-All Cup'],['shart','SHART']];
function dataRow(x){
  return [x.cupLabel,x.round??'',x.stageLabel||'',x.group||'',x.slot||'',x.p1,x.s1??'',x.s2??'',x.p2,x.statusLabel,x.superRound||'',x.date||''];
}
function build(rows){
  const files=[];
  const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
    '</Types>';
  files.push(['[Content_Types].xml',types]);
  files.push(['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
  files.push(['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
    sheets.map((s,i)=>'<sheet name="'+esc(s[1])+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>']);
  files.push(['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
    '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
  files.push(['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>'+
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F2A"/><bgColor indexed="64"/></patternFill></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'+
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']);
  sheets.forEach((s,i)=>files.push(['xl/worksheets/sheet'+(i+1)+'.xml',sheet([headers,...rows.filter(r=>r.cup===s[0]).map(dataRow)])]));
  return zip(files);
}
window.Super6FixtureExcel=Object.freeze({build,dataRow,headers});
})();