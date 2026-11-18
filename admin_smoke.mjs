import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const examples=JSON.parse(await fs.readFile(new URL('../data/demo-nests.json', import.meta.url),'utf8'));
const fields=(await fs.readFile(new URL('../admin.html',import.meta.url),'utf8')).matchAll(/name="([^"]+)"/g);
const fieldNames=[...new Set([...fields].map(m=>m[1]))];
class Element {
 constructor(id=''){this.id=id;this.value='';this.checked=false;this.dataset={};this.textContent='';this.children=[];this.className='';this.classList={toggle(){},add(){},remove(){}};this.listeners={};this.hidden=false;this.style={};this.files=[];this.parent=null;}
 addEventListener(key,fn){this.listeners[key]=fn;}
 setAttribute(k,v){this[k]=v;}
 append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const out=[];const scan=node=>{for(const child of node.children){if(child.className?.split(' ').includes(selector.slice(1)))out.push(child);scan(child);}};scan(this);return out;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 click(){if(this.listeners.click)return this.listeners.click();}
 scrollIntoView(){}
 reset(){for(const el of formFields.values())el.value='';}
}
const formFields=new Map(fieldNames.map(n=>[n,new Element(n)]));
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},createElement(tag){return new Element(tag);},querySelectorAll(){return []}};
const form=document.getElementById('nestForm');form.elements={namedItem(n){return formFields.get(n);}};
globalThis.fetch=async()=>({ok:true,json:async()=>examples});
globalThis.confirm=()=>true;
globalThis.matchMedia=()=>({matches:false});
await import(new URL('../assets/admin.js',import.meta.url));
await new Promise(resolve=>setTimeout(resolve,90));
const $=id=>document.getElementById(id);
assert.equal($('adminNestList').children.length,6);
assert.equal($('reviewList').children.length,1);
for(const [k,v] of Object.entries({id:'PM-2026-999',species:'Green turtle',status:'emerged',date_relocated:'2026-11-11',egg_count:'88',broken_eggs:'2',deformed_eggs:'0',healthy_hatchlings:'70',deformed_hatchlings:'4',tag_left:'DEMO-L999',ccl:'101.5'}))formFields.get(k).value=v;
formFields.get('date_relocated').listeners.change();
assert.equal(formFields.get('season').value,'2026');
formFields.get('healthy_hatchlings').listeners.input();
assert.equal(formFields.get('released_hatchlings').value,'74');
$('shareMotherDetails').checked=true;
$('addMetadata').click();$('addMetadata').click();
let fieldsRows=$('metadataRows').children;
assert.equal(fieldsRows.length,2);
fieldsRows[0].querySelector('.metadata-label').value='Public note';
fieldsRows[0].querySelector('.metadata-value').value='Protected nest';
fieldsRows[1].querySelector('.metadata-label').value='Internal depth';
fieldsRows[1].querySelector('.metadata-value').value='65 cm';
fieldsRows[1].querySelector('.metadata-visibility').value='private';
// Delete a row and recreate it, to verify the removable metadata control.
fieldsRows[1].querySelector('.metadata-remove').click();
assert.equal($('metadataRows').children.length,1);
$('addMetadata').click();fieldsRows=$('metadataRows').children;
fieldsRows[1].querySelector('.metadata-label').value='Internal depth';
fieldsRows[1].querySelector('.metadata-value').value='65 cm';
fieldsRows[1].querySelector('.metadata-visibility').value='private';
await $('nestForm').listeners.submit({preventDefault(){}});
assert.equal($('reviewCount').textContent,'1 pending',$('adminMessage').textContent);
assert.equal($('adminNestList').children.length,6);
// Confirm proposed data is separated into public and protected payloads.
const details=$('reviewList').children[0].children.find(e=>e.className==='review-details');
const proposed=JSON.parse(details.children[1].textContent);
assert.equal(proposed.public_record.season,2026);
assert.equal(proposed.public_record.released_hatchlings,74);
assert.equal(proposed.protected_research.broken_eggs,2);
assert.equal(proposed.protected_research.deformed_eggs,0);
assert.ok(!('broken_eggs' in proposed.public_record) && !('deformed_eggs' in proposed.public_record));
assert.equal(proposed.public_record.mother_tag_left,'DEMO-L999');
assert.equal(proposed.public_record.mother_ccl_cm,101.5);
assert.deepEqual(proposed.public_record.public_metadata,[{label:'Public note',value:'Protected nest'}]);
assert.deepEqual(proposed.protected_research.custom_private_metadata,[{label:'Internal depth',value:'65 cm'}]);
const controls=$('reviewList').children[0].children.find(c=>c.className==='review-actions');
await controls.children[1].listeners.click();
assert.equal($('reviewCount').textContent,'0 pending');
assert.equal($('adminNestList').children.length,7);
$('adminNestList').children.find(c=>c.dataset.id==='PM-2026-999').listeners.click();
assert.equal($('metadataRows').children.length,2);
assert.equal(formFields.get('tag_left').value,'DEMO-L999');
assert.equal($('shareMotherDetails').checked,true);
console.log('Local review approval + release categories + mother tags + metadata: PASS');
