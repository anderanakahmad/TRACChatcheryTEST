import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { displayPhase, daysSinceRelocation } from '../assets/phase.js';
import {checkMilestone} from '../assets/workflow.js';
const today=new Date(2026,10,18);
const makeNest=(date,status='incubating')=>({id:'TRACC-01',status,date_relocated:date,egg_count:100});
const daysBack=(n)=>{const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
for(const [day,phase] of [[0,'incubating'],[49,'incubating'],[50,'emergence_soon'],[55,'emergence_soon'],[60,'emergence_soon'],[61,'awaiting_update'],[90,'awaiting_update']]){
 const nest=makeNest(daysBack(day));assert.equal(daysSinceRelocation(nest,today),day);assert.equal(displayPhase(nest,today),phase,`day ${day}`);
}
for(const status of ['emerged','excavated']){
 assert.equal(displayPhase(makeNest(daysBack(55),status),today),status,`actual status ${status} beats estimate`);
 assert.equal(displayPhase(makeNest(daysBack(90),status),today),status);
}
assert.equal(displayPhase(makeNest('not-a-date'),today),'incubating');
assert.equal(displayPhase(makeNest(daysBack(-5)),today),'incubating');
assert.throws(()=>checkMilestone(makeNest(daysBack(42)),{status:'incubating'},{broken_eggs:5}),/not a milestone field/);
assert.throws(()=>checkMilestone(makeNest(daysBack(42)),{status:'incubating'},{deformed_eggs:5}),/not a milestone field/);
const a=await fs.readFile(new URL('../admin.html',import.meta.url),'utf8');
for(const field of ['egg_count','broken_eggs','deformed_eggs'])assert.equal([...a.matchAll(new RegExp(`name="${field}"`,'g'))].length,1,`exactly one ${field} field in new nest form`);
assert.match(a,/Eggs recorded at relocation/);
assert.match(a,/Broken and deformed egg counts are staff-only/);
const v=await fs.readFile(new URL('../assets/app.js',import.meta.url),'utf8');
assert.doesNotMatch(v,/broken_eggs|deformed_eggs/, 'public rendering must not expose private egg fields');
assert.match(v,/displayPhase\(n\)/);
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/value="emergence_soon"/);
for(const p of [html,a])assert.match(p,/id="themeSwitch"/);
const css=await fs.readFile(new URL('../assets/styles.css',import.meta.url),'utf8');
assert.match(css,/html\[data-theme="dark"\]/);
const schema=await fs.readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
const milestonePart=schema.split('allowed_milestone_private text[] := array[')[1].split('];')[0];
assert.doesNotMatch(milestonePart,/broken_eggs|deformed_eggs/);
console.log('V6 phases days 49/50/60/61, verified-status priority, egg field visibility, milestone privacy, and theme assets: PASS');
