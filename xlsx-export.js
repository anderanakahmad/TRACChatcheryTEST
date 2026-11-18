/* Tiny dependency-free XLSX writer using the Office Open XML format and ZIP STORE.
 * Strings always use inlineStr, never formulas, to avoid spreadsheet formula injection.
 * No network requests and no third-party libraries. */
const encoder=new TextEncoder();
const xmlText=value=>String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const colName=index=>{let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
const xmlRow=(row,index)=>`<row r="${index+1}">${row.map((value,col)=>{
  if(value===null||value===undefined||value==='')return '';
  const address=colName(col)+(index+1);
  if(typeof value==='number' && Number.isFinite(value))return `<c r="${address}"><v>${value}</v></c>`;
  if(typeof value==='boolean')return `<c r="${address}" t="b"><v>${value?1:0}</v></c>`;
  return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}).join('')}</row>`;
const sheetXml=rows=>{const maxColumns=Math.max(1,...rows.map(r=>r.length));const widths=Array.from({length:maxColumns},(_,i)=>Math.min(42,Math.max(14,...rows.slice(0,60).map(r=>String(r[i]??'').length+2))));return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map(xmlRow).join('')}</sheetData><autoFilter ref="A1:${colName(maxColumns-1)}${Math.max(1,rows.length)}"/></worksheet>`;};
const uint16=(arr,offset,n)=>{arr[offset]=n&255;arr[offset+1]=(n>>>8)&255;};
const uint32=(arr,offset,n)=>{uint16(arr,offset,n&65535);uint16(arr,offset+2,Math.floor(n/65536));};
const concat=parts=>{const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let off=0;for(const p of parts){result.set(p,off);off+=p.length;}return result;};
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zipEntries(files){const locals=[],centers=[];let offset=0;
  for(const [name,text] of files){const path=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
    const head=new Uint8Array(30+path.length);uint32(head,0,0x04034b50);uint16(head,4,20);uint32(head,14,crc);uint32(head,18,data.length);uint32(head,22,data.length);uint16(head,26,path.length);head.set(path,30);
    locals.push(head,data);
    const cd=new Uint8Array(46+path.length);uint32(cd,0,0x02014b50);uint16(cd,4,20);uint16(cd,6,20);uint32(cd,16,crc);uint32(cd,20,data.length);uint32(cd,24,data.length);uint16(cd,28,path.length);uint32(cd,42,offset);cd.set(path,46);centers.push(cd);
    offset+=head.length+data.length;
  }
  const center=concat(centers),end=new Uint8Array(22);uint32(end,0,0x06054b50);uint16(end,8,files.length);uint16(end,10,files.length);uint32(end,12,center.length);uint32(end,16,offset);
  return concat([...locals,center,end]);
}
export function buildXlsx(sheets){
  if(!Array.isArray(sheets)||!sheets.length)throw Error('No sheets to export.');
  const normalized=sheets.map((sheet,i)=>({name:String(sheet.name||`Sheet${i+1}`).replace(/[\\/:*?\[\]]/g,' ').slice(0,31),rows:sheet.rows}));
  const contentTypes=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${normalized.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const files=[
    ['[Content_Types].xml',contentTypes],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${normalized.map((s,i)=>`<sheet name="${xmlText(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${normalized.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${normalized.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>']
  ];
  normalized.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheetXml(s.rows)]));
  return zipEntries(files);
}
export function downloadXlsx(sheets,filename){
  const bytes=buildXlsx(sheets);
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
}
