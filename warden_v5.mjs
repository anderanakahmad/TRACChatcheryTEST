import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const data=JSON.parse(await fs.readFile(new URL('../data/demo-nests.json',import.meta.url),'utf8'));
const html=await fs.readFile(new URL('../admin.html',import.meta.url),'utf8');
const names=[...new Set([...html.matchAll(/name="([^"]+)"/g)].map(m=>m[1]))];
class Element{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.checked=false;this.dataset={};this.listeners={};this.children=[];this.hidden=false;this.className='';this.style={};this.classList={toggle(){},add(){},remove(){}};this.files=[];}
 addEventListener(k,fn){this.listeners[k]=fn;}
 setAttribute(k,v){this[k]=v;}
 append(...args){this.children.push(...args);}
 replaceChildren(...args){this.children=[...args];}
 querySelectorAll(){return [];} querySelector(){return null;}scrollIntoView(){}
 reset(){for(const x of this.elements?.all||[])x.value='';}
 click(){return this.listeners.click?.();}
}
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
const fieldMap=new Map(names.map(x=>[x,new Element(x)]));
const fields={namedItem:k=>fieldMap.get(k),all:[...fieldMap.values()]};
const form=el('nestForm'),milestone=el('milestoneForm');form.elements=fields;milestone.elements=fields;
globalThis.document={getElementById:el,createElement:name=>new Element(name),querySelectorAll:()=>[]};
globalThis.location={href:'http://localhost/admin.html?role=warden'};
globalThis.fetch=async()=>({ok:true,json:async()=>data});
globalThis.matchMedia=()=>({matches:false});
globalThis.confirm=()=>true;
globalThis.prompt=()=>null;
await import('../assets/admin.js');await new Promise(res=>setTimeout(res,75));
assert.equal(el('exportSection').hidden,true,'Warden export must be hidden');
const list=el('adminNestList');assert.equal(list.children.length,6);
const first=list.children[0];first.listeners.click();
assert.equal(el('milestoneForm').hidden,false,'Warden should see milestone form');
assert.equal(el('nestForm').hidden,true,'Warden should not see correction form');
assert.match(el('formTitle').textContent,/New milestone/);
const n=data.find(x=>x.id===first.dataset.id);
fieldMap.get('status').value=n.status==='incubating'?'emerged':n.status;
fieldMap.get('emergence_date').value='2026-11-30';
fieldMap.get('healthy_hatchlings').value='10';fieldMap.get('deformed_hatchlings').value='1';
const originalPublic=JSON.stringify(n);
await milestone.listeners.submit({preventDefault(){}});
assert.equal(el('reviewCount').textContent,'1 pending');
assert.equal(JSON.stringify(n),originalPublic,'Warden proposal must not mutate approved object');
assert.equal(el('exportSection').hidden,true);
console.log('V5 warden follow-up only + no corrections/exports + pending submission: PASS');
