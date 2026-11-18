import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=JSON.parse(await fs.readFile(new URL('../data/demo-nests.json',import.meta.url),'utf8'));
class Element {
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.hidden=false;this.innerHTML='';this.children=[];this.listeners={};this.classes=new Set();this.attributes={};this.classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);},add:name=>this.classes.add(name),remove:name=>this.classes.delete(name)};}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(key,value){this.attributes[key]=value;}
 insertAdjacentHTML(pos,text){this.innerHTML+=text;}
 replaceChildren(...items){this.children=items;}
 append(...items){this.children.push(...items);}
 showModal(){this.open=true;}
 close(){this.open=false;if(this.listeners.close)this.listeners.close();}
 click(){if(this.listeners.click)return this.listeners.click();}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},createElement(tag){return new Element(tag);},querySelectorAll(){return []}};
globalThis.location={href:'https://example.test/tracc/',origin:'https://example.test',pathname:'/tracc/',hash:''};
globalThis.history={replaceState(){}};
globalThis.fetch=async()=>({ok:true,json:async()=>data});
await import(new URL('../assets/app.js',import.meta.url));
await new Promise(resolve=>setTimeout(resolve,100));
const $=id=>document.getElementById(id);
assert.equal($('statRecords').textContent,'6');
assert.match($('activityFeed').innerHTML,/Nest excavated/);
assert.match($('nestGrid').innerHTML,/Hatchlings released/);
assert.match($('nestGrid').innerHTML,/status-art-fallback/);
assert.equal($('statEggs').textContent,'641');
assert.equal($('statReleased').textContent,'355');
assert.equal($('statActive').textContent,'2');
assert.equal($('seasonBreakdown').children.length,2);
assert.equal($('speciesBreakdown').children.length,2);
assert.match($('statFootnote').textContent,/4 of these nests/);
assert.equal($('trendTitle').textContent,'Nests relocated by year');
assert.match($('trendChart').innerHTML,/<svg/);
assert.equal(($('trendChart').innerHTML.match(/class="series-dot"/g)||[]).length,2);
$('statSeasonFilter').value='2026';$('statSeasonFilter').listeners.change();
assert.equal($('statRecords').textContent,'5');
assert.equal($('trendTitle').textContent,'Nests relocated by month · 2026');
assert.equal(($('trendChart').innerHTML.match(/class="series-dot"/g)||[]).length,12);
$('statSeasonFilter').value='2025';$('statSeasonFilter').listeners.change();
assert.equal($('statRecords').textContent,'1');
assert.equal($('statEggs').textContent,'110');
assert.equal($('statReleased').textContent,'95');
$('statSeasonFilter').value='';$('statSpeciesFilter').value='Hawksbill turtle';$('statSpeciesFilter').listeners.change();
assert.equal($('statRecords').textContent,'2');
assert.equal($('statEggs').textContent,'194');
assert.equal($('statReleased').textContent,'79');
assert.equal(($('trendChart').innerHTML.match(/class="series-dot"/g)||[]).length,2); // years shared by all species
$('statSpeciesFilter').value='';$('statSpeciesFilter').listeners.change();
$('listView').listeners.click();
assert.equal($('nestGrid').classes.has('list-layout'),true);
assert.equal($('listView').attributes['aria-pressed'],'true');
$('gridView').listeners.click();assert.equal($('nestGrid').classes.has('list-layout'),false);
$('sortNests').value='soon';$('sortNests').listeners.change();
assert.match($('nestGrid').innerHTML,/data-nest="PM-2026-040"/);
assert.ok($('nestGrid').innerHTML.indexOf('PM-2026-040') < $('nestGrid').innerHTML.indexOf('PM-2026-041'));
$('sortNests').value='latest';$('sortNests').listeners.change();
$('nestGrid').listeners.click({target:{closest:()=>({dataset:{nest:'PM-2026-039'}})}});
assert.match($('dialogContent').innerHTML,/DEMO-L041/);
assert.match($('dialogContent').innerHTML,/Habitat/);
assert.match($('dialogContent').innerHTML,/South beach/);
$('dialogClose').listeners.click();
$('nestGrid').listeners.click({target:{closest:()=>({dataset:{nest:'PM-2026-040'}})}});
assert.doesNotMatch($('dialogContent').innerHTML,/Identified nesting mother/);
console.log('Dashboard: year/month charts + season/species filters + layout toggle + conditional mother data: PASS');
