import { downloadXlsx } from './xlsx-export.js';
import {checkMilestone,applyMilestone,canSubmitType,canSeeProtected} from './workflow.js';
import {saveEncryptedDraft,readEncryptedDraft,clearEncryptedDraft,hasEncryptedDraft} from './encrypted-drafts.js';
import { SITE } from './config.js';
import {readDemoStore,writeDemoStore,clearDemoStore} from './demo-store.js';
import {initThemeToggle} from './theme.js';
import { isLive, isDemo, loadApprovedStaffNests, loadSubmissions, loadResearch, signIn,
  signOut, getSession, getStaffProfile, submitNest, reviewSubmission, loadAudit } from './api.js';

const $ = id => document.getElementById(id);
const form = $('nestForm');
const publicKeys = ['id','season','species','status','date_laid','date_relocated','egg_count',
  'warden_public_name','expected_start','expected_end','hatch_date','emergence_date','excavation_date',
  'hatched_eggs','emerged_hatchlings','released_hatchlings','notes_public','island_sector_found',
  'mother_tag_left','mother_tag_right','mother_ccl_cm','mother_ccw_cm','mother_note_public','public_metadata'];
const privateKeys = ['nest_code','nest_location','sector','hatchery_position','relocated_by_nest',
  'relocated_by_hatchery','broken_eggs','deformed_eggs','healthy_hatchlings','deformed_hatchlings',
  'undeveloped_eggs','dead_egg_stage1','dead_egg_stage2','dead_egg_stage3','attacked_eggs',
  'dead_hatchlings','total_excavated','excavation_difference','hatching_method','hatching_time',
  'logger_id','turtle_present','ccl','ccw','tag_left','tag_right','private_notes'];
const decimal = new Set(['mother_ccl_cm','mother_ccw_cm']);
const numeric = new Set(['season','egg_count','hatched_eggs','emerged_hatchlings','released_hatchlings',
  'broken_eggs','deformed_eggs','healthy_hatchlings','deformed_hatchlings','undeveloped_eggs',
  'dead_egg_stage1','dead_egg_stage2','dead_egg_stage3','attacked_eggs','dead_hatchlings',
  'total_excavated','excavation_difference','mother_ccl_cm','mother_ccw_cm']);
let approved=[],submissions=[],researchById=new Map(),auditHistory=[],selectedId=null,profile={role:'local-preview'};
let editMode='new_nest',entryMode='quick',supersedesId=null;
const local = () => !isLive();
const canReview=()=>profile.role==='admin'||(local() && profile.role==='local-preview');
const canExportPrivate=()=>profile.role==='admin'||(local() && profile.role==='local-preview');
const isoNow=()=>new Date().toISOString();
function preserveDemo(){if(local())writeDemoStore({approved,submissions,research:[...researchById],audit:auditHistory});}

const localRequestId=()=>globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const safeText=(value)=>String(value ?? '');
const metadataContainer=$('metadataRows');
function addMetadataRow(item={}) {
  if(metadataContainer.children.length>=20)throw Error('Maximum 20 custom metadata fields per nest.');
  const row=document.createElement('div');row.className='metadata-row';
  const field=(title,type,value,max=180)=>{
    const label=document.createElement('label');label.textContent=title;
    const el=document.createElement('input');el.type=type;el.maxLength=max;el.value=value||'';
    label.append(el);row.append(label);return el;
  };
  const label=field('Field name','text',item.label,60);label.className='metadata-label';label.placeholder='e.g. Substrate';
  const value=field('Field value','text',item.value,280);value.className='metadata-value';value.placeholder='Observation or value';
  const visibilityLabel=document.createElement('label');visibilityLabel.textContent='Visibility';
  const visibility=document.createElement('select');visibility.className='metadata-visibility';
  for(const [val,title] of [['public','Public after approval'],['private','Staff only']]){
    const opt=document.createElement('option');opt.value=val;opt.textContent=title;visibility.append(opt);
  }
  visibility.value=item.visibility==='private'?'private':'public';visibilityLabel.append(visibility);row.append(visibilityLabel);
  const remove=document.createElement('button');remove.className='metadata-remove';remove.type='button';remove.textContent='Remove';
  remove.setAttribute('aria-label','Remove metadata field');remove.addEventListener('click',()=>row.remove());row.append(remove);
  metadataContainer.append(row);
}
function replaceMetadata(p=[],r=[]) {
  metadataContainer.replaceChildren();
  for(const m of Array.isArray(p)?p:[])addMetadataRow({...m,visibility:'public'});
  for(const m of Array.isArray(r)?r:[])addMetadataRow({...m,visibility:'private'});
}
function readMetadata() {
  const pub=[],priv=[],seen=new Set();
  const rows=[...metadataContainer.querySelectorAll('.metadata-row')];
  if(rows.length>20)throw Error('Too many custom metadata fields.');
  for(const row of rows){
    const label=row.querySelector('.metadata-label').value.trim();
    const value=row.querySelector('.metadata-value').value.trim();
    const visibility=row.querySelector('.metadata-visibility').value;
    if(!label&&!value)continue;
    if(!label||!value)throw Error('Each custom metadata field needs both a label and a value.');
    if(label.length>60||value.length>280)throw Error('Custom metadata fields are too long.');
    if(visibility==='public' && /\b(gps|latitude|longitude|coordinates?|precise\s+location)\b/i.test(label))
      throw Error('GPS/coordinate metadata cannot be public. Use staff-only visibility.');
    if(visibility==='public' && /\b(broken|deformed)\s+eggs?\b/i.test(label))
      throw Error('Broken/deformed egg counts cannot be public metadata. They belong in staff-only relocation fields.');
    const key=`${visibility}:${label.toLowerCase()}`;
    if(seen.has(key))throw Error(`Duplicate metadata field: ${label}`);
    seen.add(key);
    (visibility==='private'?priv:pub).push({label,value});
  }
  return {pub,priv};
}
function updateReleased() {
  const a=form.elements.namedItem('healthy_hatchlings').value;
  const b=form.elements.namedItem('deformed_hatchlings').value;
  const total=form.elements.namedItem('released_hatchlings');
  if(a!=='' && b!=='' && Number.isInteger(Number(a)) && Number.isInteger(Number(b)) && Number(a)>=0 && Number(b)>=0)
    total.value=String(Number(a)+Number(b));
  else if(a!=='' || b!=='')total.value='';
  else if(!selectedId)total.value='';
}
function syncCalendarSeason() {
  const date=form.elements.namedItem('date_relocated').value;
  const year=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,4):'';
  form.elements.namedItem('season').value=year;
}


function setEntryMode(mode) {
  entryMode=mode==='detailed'?'detailed':'quick';
  form.classList.toggle('quick-mode',entryMode==='quick');
  $('quickMode').classList.toggle('active',entryMode==='quick');
  $('detailedMode').classList.toggle('active',entryMode==='detailed');
  $('quickMode').setAttribute('aria-pressed',String(entryMode==='quick'));
  $('detailedMode').setAttribute('aria-pressed',String(entryMode==='detailed'));
}
function showMilestone(id) {
  const n=approved.find(x=>x.id===id);if(!n)return;
  selectedId=id;editMode='milestone';supersedesId=null;
  $('nestForm').hidden=true;$('entryModeControls').hidden=true;
  $('milestoneForm').hidden=false;$('milestoneForm').reset();
  $('milestoneForm').elements.namedItem('status').value=n.status;
  $('milestoneNestTitle').textContent=`Nest ${n.id} · ${n.species}`;
  $('milestoneContext').textContent=`Relocated ${n.date_relocated} · ${n.egg_count} eggs · Latest approved status: ${n.status}. Wardens can submit observations but cannot edit original relocation data.`;
  $('formTitle').textContent=`New milestone · ${n.id}`;
  document.querySelectorAll('.admin-nest-row').forEach(e=>e.classList.toggle('active',e.dataset.id===id));
  if(matchMedia('(max-width:700px)').matches)$('milestoneForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function readMilestoneProposal() {
  const nest=approved.find(n=>n.id===selectedId);if(!nest)throw Error('Choose an approved nest first.');
  const fm=$('milestoneForm'),pub={},priv={};
  for(const k of ['status','hatch_date','emergence_date','excavation_date','hatched_eggs','emerged_hatchlings','notes_public']){
    const raw=fm.elements.namedItem(k).value.trim();
    if(raw!=='')pub[k]=['hatched_eggs','emerged_hatchlings'].includes(k)?Number(raw):raw;
  }
  for(const k of ['healthy_hatchlings','deformed_hatchlings','dead_hatchlings','total_excavated','undeveloped_eggs','dead_egg_stage1','dead_egg_stage2','dead_egg_stage3','attacked_eggs','hatching_method','hatching_time','private_notes']) {
    const raw=fm.elements.namedItem(k).value.trim();if(raw!=='')priv[k]=['hatching_method','hatching_time','private_notes'].includes(k)?raw:Number(raw);
  }
  if('healthy_hatchlings' in priv && 'deformed_hatchlings' in priv)pub.released_hatchlings=priv.healthy_hatchlings+priv.deformed_hatchlings;
  return {payload:checkMilestone(nest,pub,priv).publicDelta,research_payload:priv};
}
async function submitMilestone(event){
  event.preventDefault();const b=$('submitMilestone');
  try{
    if(!canSubmitType(profile.role,'milestone') && !local())throw Error('Not permitted to submit milestone updates.');
    const n=approved.find(x=>x.id===selectedId);const delta=readMilestoneProposal();b.disabled=true;
    if(isLive()) {await submitNest(n.id,delta.payload,delta.research_payload,n.updated_at,'milestone',supersedesId);await reload();}
    else {const req={type:'tracc-hatchery-proposal-v5',submission_type:'milestone',nest_id:n.id,...delta,
      supersedes_submission_id:supersedesId,base_updated_at:n.updated_at||null,
      review_state:'pending',submitted_at:isoNow(),submission_id:localRequestId(),submitted_by:'local-warden'};
      submissions.unshift(req);preserveDemo();renderReview();downloadJSON(req,`tracc-milestone-request-${n.id}.json`);}
    clearEncryptedDraft();notice(`Milestone for ${n.id} submitted for administrator review. The public nest is unchanged until approved.`);newNest();
  }catch(e){notice(`Milestone not submitted: ${e.message}`,true);}finally{b.disabled=false;}
}
function reviseRequest(s){
  if(s.review_state!=='returned')return;
  supersedesId=s.submission_id;
  if(s.submission_type==='milestone'){
    showMilestone(s.nest_id);supersedesId=s.submission_id;
    for(const [k,v] of Object.entries({...s.payload,...s.research_payload})){
      const el=$('milestoneForm').elements.namedItem(k);if(el && v!==null && v!==undefined)el.value=v;
    }
  }else{
    newNest();supersedesId=s.submission_id;
    const p=s.payload||{},r=s.research_payload||{};
    fillRecord(p,publicKeys);fillRecord(r,privateKeys);syncCalendarSeason();
    replaceMetadata(p.public_metadata,r.custom_private_metadata);
    $('shareMotherDetails').checked=Boolean(p.mother_tag_left||p.mother_tag_right);
    if(s.submission_type==='correction'){
      if(profile.role!=='admin')throw Error('Only administrators can correct approved records.');
      selectedId=s.nest_id;editMode='correction';form.elements.namedItem('id').disabled=true;
    }
    setEntryMode('detailed');
  }
  notice(`Revising returned submission. Administrator note: ${s.review_note||'Please correct and resubmit.'}`);
  document.getElementById('formTitle').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderAudit(){
  const section=$('auditSection');section.hidden=!canReview();if(section.hidden)return;
  const list=$('auditList');list.replaceChildren();
  for(const entry of auditHistory.slice(0,100)){
    const d=document.createElement('details');d.className='review-details';
    const title=document.createElement('summary');title.textContent=`${entry.nest_id} · ${entry.action} · ${new Date(entry.approved_at).toLocaleString('en-GB')}`;
    const before=document.createElement('pre');
    before.textContent=JSON.stringify({previous_public:entry.before_public,published_public:entry.after_public,
      previous_protected:entry.before_protected,new_protected:entry.after_protected,
      submission_id:entry.submission_id,approved_by:entry.approved_by},null,2);
    d.append(title,before);list.append(d);
  }
  if(!auditHistory.length){const x=document.createElement('p');x.className='staff-helper';x.textContent='No approved changes in history yet.';list.append(x);}
}
function draftAccount(){return getSession()?.user?.id||'local-demo';}
async function saveDraft(){
  try{
    const pass=prompt('Choose a private draft passphrase (12+ characters). Do not reuse your staff password. The passphrase is not stored.');
    if(pass===null)return;
    let document;
    if(editMode==='milestone')document={mode:'milestone',selectedId,values:Object.fromEntries(new FormData($('milestoneForm')))};
    else document={mode:'nest',entryMode,selectedId,values:Object.fromEntries(new FormData(form)),shareMother:$('shareMotherDetails').checked,
      metadata:[...metadataContainer.querySelectorAll('.metadata-row')].map(row=>({label:row.querySelector('.metadata-label').value,value:row.querySelector('.metadata-value').value,visibility:row.querySelector('.metadata-visibility').value}))};
    await saveEncryptedDraft(document,pass,draftAccount());notice('Encrypted draft saved to this device. It will not sync or publish automatically.');
  }catch(e){notice(`Draft not saved: ${e.message}`,true);}
}
async function restoreDraft(){
  try{
    if(!hasEncryptedDraft())throw Error('No encrypted draft on this device.');
    const pass=prompt('Enter your encrypted draft passphrase.');if(pass===null)return;
    const d=await readEncryptedDraft(pass,draftAccount());
    if(d.mode==='milestone'){
      if(!approved.some(x=>x.id===d.selectedId))throw Error('The nest is not available in the current approved records.');
      showMilestone(d.selectedId);
      for(const [k,v] of Object.entries(d.values||{})){const el=$('milestoneForm').elements.namedItem(k);if(el)el.value=v;}
    }else{
      newNest();setEntryMode(d.entryMode);replaceMetadata(d.metadata?.filter(x=>x.visibility!=='private'),d.metadata?.filter(x=>x.visibility==='private'));
      for(const [k,v] of Object.entries(d.values||{})){const el=form.elements.namedItem(k);if(el)el.value=v;}
      $('shareMotherDetails').checked=Boolean(d.shareMother);
      syncCalendarSeason();updateReleased();
    }
    notice('Encrypted draft restored. Check the fields before submitting.');
  }catch(e){notice(`Draft not restored: ${e.message}`,true);}
}
function notice(text, error=false) {
  $('adminMessage').textContent=text;$('adminMessage').classList.toggle('error',error);
}
function fillRecord(obj,keys) {
  for(const key of keys){const input=form.elements.namedItem(key);if(input)input.value=obj?.[key] ?? '';}
}
function newNest() {
  form.reset();selectedId=null;editMode='new_nest';supersedesId=null;metadataContainer.replaceChildren();
  $('milestoneForm').hidden=true;form.hidden=false;$('entryModeControls').hidden=false;setEntryMode('quick');
  $('shareMotherDetails').checked=false;
  $('formTitle').textContent='New nest submission';
  form.elements.namedItem('id').disabled=false;
  form.elements.namedItem('season').value='';
  document.querySelectorAll('.admin-nest-row').forEach(n=>n.classList.remove('active'));
}
function selectApproved(id) {
  const n=approved.find(x=>x.id===id);if(!n)return;
  if(profile.role==='warden'){showMilestone(id);return;}
  editMode='correction';supersedesId=null;
  $('milestoneForm').hidden=true;form.hidden=false;$('entryModeControls').hidden=false;setEntryMode('detailed');
  selectedId=id;form.reset();fillRecord(n,publicKeys);fillRecord(researchById.get(id),privateKeys);
  replaceMetadata(n.public_metadata, researchById.get(id)?.custom_private_metadata);
  // Public mother fields use the SAME tag/measurement inputs as protected research.
  for(const [name,legacyName] of [['tag_left','mother_tag_left'],['tag_right','mother_tag_right'],['ccl','mother_ccl_cm'],['ccw','mother_ccw_cm']]){
    const v=researchById.get(id)?.[name];
    if(v===null || v===undefined || v==='')form.elements.namedItem(name).value=n[legacyName]??'';
  }
  $('shareMotherDetails').checked=Boolean(n.mother_tag_left || n.mother_tag_right);
  syncCalendarSeason();updateReleased();
  form.elements.namedItem('id').disabled=true;
  $('formTitle').textContent=`Propose correction · ${id}`;
  document.querySelectorAll('.admin-nest-row').forEach(e=>e.classList.toggle('active',e.dataset.id===id));
  if(matchMedia('(max-width:700px)').matches)form.scrollIntoView({behavior:'smooth',block:'start'});
}
function readValues(keys) {
  const data={};
  for(const key of keys){const el=form.elements.namedItem(key);if(!el)continue;
    const raw=el.value.trim();data[key]=numeric.has(key)?(raw===''?null:Number(raw)):(raw||null);
  }
  return data;
}
function readProposal() {
  const p=readValues(publicKeys),r=readValues(privateKeys);
  const {pub,priv}=readMetadata();p.public_metadata=pub;r.custom_private_metadata=priv;
  // By TRACC's definition, both healthy and deformed hatchlings are released.
  // Both category counts are required, including explicit zeros, before publishing a calculated total.
  if((r.healthy_hatchlings===null)!==(r.deformed_hatchlings===null))
    throw Error('Enter both healthy and deformed hatchling release counts (use 0 when none), or leave both blank.');
  if(r.healthy_hatchlings!==null && r.deformed_hatchlings!==null)
    p.released_hatchlings=r.healthy_hatchlings+r.deformed_hatchlings;
  else if(!selectedId) p.released_hatchlings=null;
  // Store original mother tags/measures in protected research, but optionally share
  // an approved subset publicly when at least one actual tag number exists.
  const sharingMother=$('shareMotherDetails').checked;
  if(sharingMother && !r.tag_left && !r.tag_right)
    throw Error('A left or right tag number is required before sharing mother turtle details.');
  p.mother_tag_left=sharingMother?r.tag_left:null;
  p.mother_tag_right=sharingMother?r.tag_right:null;
  for(const [privateKey,publicKey] of [['ccl','mother_ccl_cm'],['ccw','mother_ccw_cm']]){
    const raw=r[privateKey];
    if(sharingMother && raw!==null && (!Number.isFinite(Number(raw)) || Number(raw)<0 || Number(raw)>250))
      throw Error(`${privateKey.toUpperCase()} must be a valid measurement (cm) before sharing.`);
    p[publicKey]=sharingMother && raw!==null?Number(raw):null;
  }
  if(!sharingMother)p.mother_note_public=null;

  p.id=safeText(p.id).toUpperCase();
  if(!/^[A-Z0-9_-]{1,40}$/.test(p.id))throw Error('Enter a valid public nest ID (letters, numbers, hyphen or underscore).');
  if(!Number.isInteger(p.season)||p.season<2000||p.season>2100)throw Error('Season must be a four-digit year.');
  if(!p.date_relocated)throw Error('Relocation date is required.');
  if(Number(p.date_relocated.slice(0,4))!==p.season)throw Error('Season must equal the relocation date calendar year.');
  if(!Number.isInteger(p.egg_count)||p.egg_count<1)throw Error('Relocated egg count must be a positive whole number.');
  if(p.date_laid && p.date_laid>p.date_relocated)throw Error('Laying date must not be after relocation.');
  if(p.expected_start && p.expected_end && p.expected_end<p.expected_start)throw Error('Expected emergence window is reversed.');
  if(p.status==='excavated'&&!p.excavation_date)throw Error('Excavated status requires an assessment date.');
  if(!['incubating','emerged','excavated'].includes(p.status))throw Error('Choose Incubating, Emerged or Excavated.');
  if(p.released_hatchlings!==null && p.released_hatchlings>0 && p.status==='incubating')throw Error('A nest with released hatchlings must be marked Emerged or Excavated.');
  if(p.hatched_eggs!==null&&!p.excavation_date)throw Error('Confirmed hatched eggs require an assessment date.');
  for(const [key,value] of Object.entries({...p,...r})) {
    if(numeric.has(key) && value!==null && ((!decimal.has(key)&&!Number.isInteger(value)) || !Number.isFinite(value) || (key!=='excavation_difference' && value<0)))
      throw Error(`${key.replaceAll('_',' ')} must be a valid whole number.`);
  }
  for(const key of ['mother_ccl_cm','mother_ccw_cm'])if(p[key]!==null && p[key]>250)throw Error(`${key} must be 250 cm or less.`);
  for(const key of ['hatched_eggs','emerged_hatchlings','released_hatchlings'])if(p[key]!==null && p[key]>p.egg_count)throw Error(`${key} cannot exceed eggs relocated.`);
  if(p.hatched_eggs!==null && p.emerged_hatchlings!==null && p.emerged_hatchlings>p.hatched_eggs)
    throw Error('Emerged hatchlings cannot exceed confirmed hatched eggs.');
  if(approved.some(x=>x.id===p.id) && selectedId!==p.id)throw Error('This nest already exists; choose it from Approved nests to propose a correction.');
  if(selectedId && selectedId!==p.id)throw Error('Nest ID cannot be changed on a revision.');
  // Only the explicit publicKeys can ever reach the public table; r is protected research metadata.
  return {payload:p,research_payload:r};
}
function downloadJSON(obj,name) {
  const blob=new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'});
  const href=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function renderApproved() {
  const query=$('adminSearch').value.trim().toLowerCase();
  const shown=approved.filter(x=>`${x.id} ${x.species} ${x.season}`.toLowerCase().includes(query))
    .sort((a,b)=>safeText(b.date_relocated).localeCompare(safeText(a.date_relocated)));
  $('adminNestList').replaceChildren();
  for(const nest of shown) {
    const button=document.createElement('button');button.type='button';button.className='admin-nest-row';button.dataset.id=nest.id;
    if(nest.id===selectedId)button.classList.add('active');
    const info=document.createElement('div'),bold=document.createElement('strong'),sub=document.createElement('span'),status=document.createElement('span');
    bold.textContent=nest.id;sub.textContent=`${nest.species} · ${nest.season}`;status.textContent='✓ Approved';
    info.append(bold,sub);button.append(info,status);button.addEventListener('click',()=>selectApproved(nest.id));$('adminNestList').append(button);
  }
  if(!shown.length){const p=document.createElement('p');p.className='staff-helper';p.textContent='No approved nests match your search.';$('adminNestList').append(p);}
}
function makeButton(label,clazz,fn){const b=document.createElement('button');b.type='button';b.className=clazz;b.textContent=label;b.addEventListener('click',fn);return b;}
function makeReviewCard(s) {
  const article=document.createElement('article');article.className='review-item';
  const meta=document.createElement('div');meta.className='review-item-top';
  const title=document.createElement('strong');title.textContent=`${s.nest_id} · ${s.payload?.species||'Unknown species'}`;
  const badge=document.createElement('span');badge.className='review-state '+s.review_state;badge.textContent=s.review_state;
  meta.append(title,badge);article.append(meta);
  const desc=document.createElement('p');desc.className='staff-helper';
  desc.textContent=`${s.submission_type||'new_nest'} · Submitted ${s.submitted_at?new Date(s.submitted_at).toLocaleString('en-GB'):'locally'} · ${s.payload?.egg_count??'—'} eggs`;
  article.append(desc);
  const details=document.createElement('details');details.className='review-details';const summary=document.createElement('summary');summary.textContent='Inspect all proposed fields (including private research data)';
  const pre=document.createElement('pre');pre.textContent=JSON.stringify({public_record:s.payload,protected_research:s.research_payload},null,2);
  details.append(summary,pre);article.append(details);
  if(s.review_state==='pending'&&canReview()) {
    const controls=document.createElement('div');controls.className='review-actions';
    const reason=document.createElement('input');reason.type='text';reason.placeholder='Reason for return/rejection or optional approval note';reason.maxLength=1200;reason.setAttribute('aria-label','Review note');
    controls.append(reason,makeButton('Approve & publish','btn btn-dark',()=>decide(s,'approve',reason.value)),
      makeButton('Return for correction','btn btn-outline',()=>decide(s,'return',reason.value)),
      makeButton('Reject','btn btn-outline',()=>decide(s,'reject',reason.value)));
    article.append(controls);
  }
  if(s.review_state==='returned' && (!isLive() || s.submitted_by===getSession()?.user?.id)){
    article.append(makeButton('Revise & resubmit','btn btn-outline',()=>reviseRequest(s)));
  }
  if(s.review_note){const p=document.createElement('p');p.className='staff-helper';p.textContent=`Review note: ${s.review_note}`;article.append(p);}
  return article;
}
function renderReview() {
  const pending=submissions.filter(s=>s.review_state==='pending'),list=$('reviewList');list.replaceChildren();
  $('reviewCount').textContent=`${pending.length} pending`;
  $('reviewHelp').textContent=canReview() ? (local()
    ? 'LOCAL SIMULATION: review actions affect this browser only. Download approved nests and commit them manually in JSON mode.'
    : 'Administrator review: approving permanently updates the public database. Check counts, staff consent and private fields first.')
    : 'Your requests are awaiting administrator review. Only administrators can approve or reject submissions.';
  for(const s of [...submissions].filter(s=>canReview()||s.submitted_by==='local-warden').sort((a,b)=>safeText(b.submitted_at).localeCompare(safeText(a.submitted_at))))list.append(makeReviewCard(s));
  if(!submissions.length){const p=document.createElement('p');p.className='staff-helper';p.textContent='No submissions yet.';list.append(p);}
}
async function reload() {
  approved=await loadApprovedStaffNests();
  if(isLive()) {
    submissions=await loadSubmissions();
    if(canSeeProtected(profile.role)) {
      const [research,audit]=await Promise.all([loadResearch(),loadAudit()]);
      researchById=new Map(research.map(x=>[x.nest_id,x.scientific_data]));auditHistory=audit;
    }else{researchById=new Map();auditHistory=[];}
  }
  renderApproved();renderReview();refreshExportOptions();renderAudit();
}
async function submit(event) {
  event.preventDefault();const b=$('saveButton');
  try {
    if(profile.role==='warden' && editMode!=='new_nest')throw Error('Wardens can submit new nests or milestone updates, not corrections.');
    const data=readProposal();b.disabled=true;b.textContent='Submitting…';
    const existing=approved.find(n=>n.id===data.payload.id);
    const base=existing?.updated_at||null;
    if(isLive()) {
      await submitNest(data.payload.id,data.payload,data.research_payload,base,editMode,supersedesId);
      await reload();notice(`Nest ${data.payload.id} submitted for review. It is NOT publicly visible yet.`);
    } else {
      const req={type:'tracc-hatchery-proposal-v5',submission_type:editMode,supersedes_submission_id:supersedesId,nest_id:data.payload.id,...data,
        base_updated_at:base,review_state:'pending',submitted_at:isoNow(),submission_id:localRequestId(),submitted_by:'local-warden'};
      submissions.unshift(req);preserveDemo();renderReview();
      downloadJSON(req,`tracc-review-request-${data.payload.id}.json`);
      notice(`Request for ${data.payload.id} saved in this local demonstration. A private review-request JSON was downloaded; send it to the designated administrator, NOT a public repository.`);
    }
    clearEncryptedDraft();newNest();
  } catch(e){notice(e.message,true);} finally{b.disabled=false;b.textContent='Submit for administrator review';}
}
async function decide(s,action,note) {
  if(!canReview())return notice('Only administrators can review requests.',true);
  if(action!=='approve' && note.trim().length<4)return notice('Please enter a reason to return or reject this submission.',true);
  if(!confirm(`${action.toUpperCase()} submission for ${s.nest_id}?`))return;
  try {
    if(isLive()) {
      await reviewSubmission(s.submission_id,action,note);await reload();
      notice(`${s.nest_id}: ${action==='approve'?'approved and published':action==='return'?'returned for correction':'rejected'}.`);
    } else {
      if(action==='approve'){
        const current=approved.find(n=>n.id===s.nest_id);
        if((current?.updated_at||null)!==(s.base_updated_at||null))throw Error('Published record changed since this submission. Return it for correction.');
        const before=current?structuredClone(current):null;
        const beforeResearch=structuredClone(researchById.get(s.nest_id)||{});
        let proposed,privateNext;
        if(s.submission_type==='milestone'){
          const combined=applyMilestone(current,beforeResearch,s);proposed=combined.publicRecord;privateNext=combined.privateRecord;
        }else {proposed=s.payload;privateNext=s.research_payload;}
        approved=approved.filter(n=>n.id!==s.nest_id);
        const published={...proposed,updated_at:isoNow(),published:true};approved.push(published);
        researchById.set(s.nest_id,privateNext);
        auditHistory.unshift({nest_id:s.nest_id,submission_id:s.submission_id,action:s.submission_type,
          before_public:before,after_public:published,before_protected:beforeResearch,after_protected:privateNext,
          approved_at:isoNow(),approved_by:'local-admin'});
      }
      s.review_state=action==='approve'?'approved':action==='return'?'returned':'rejected';s.review_note=note||'';
      preserveDemo();renderApproved();renderReview();refreshExportOptions();renderAudit();
      notice(`${s.nest_id}: ${s.review_state} in LOCAL PREVIEW only. This action has not published online.`);
    }
  }catch(e){notice(`Review failed: ${e.message}`,true);}
}
async function importRequest(e) {
  const file=e.target.files?.[0];if(!file)return;
  try {
    if(isLive())throw Error('Live requests must be submitted by signed-in wardens; file import is disabled.');
    const req=JSON.parse(await file.text());
    if(!['tracc-hatchery-proposal-v2','tracc-hatchery-proposal-v3','tracc-hatchery-proposal-v4','tracc-hatchery-proposal-v5'].includes(req.type)||typeof req.nest_id!=='string'||(req.submission_type!=='milestone' && req.nest_id!==req.payload?.id) || (req.submission_type!=='milestone' && (!req.payload?.date_relocated || !Number.isInteger(req.payload?.egg_count))))
      throw Error('This is not a valid TRACC nest review request.');
    req.review_state='pending';req.submission_id=localRequestId();req.submitted_at=isoNow();req.submission_type ||= 'new_nest';
    submissions.unshift(req);preserveDemo();renderReview();notice(`Imported review request for ${req.nest_id}. Inspect it before approving.`);
  } catch(err){notice(`Import failed: ${err.message}`,true);} finally{e.target.value='';}
}
function exportApproved() {
  if(isLive())return notice('The live database is authoritative. Use a controlled database export for backups.',true);
  const rows=approved.filter(n=>n.published===true).sort((a,b)=>a.id.localeCompare(b.id));
  downloadJSON(rows,'nests.json');
  notice(`Downloaded ${rows.length} approved public records. Commit this file ONLY as data/nests.json in a GitHub repository configured for JSON mode. Protected research fields were excluded.`);
}
function showEditor() { $('loginSection').hidden=true;$('editorSection').hidden=false; }
function showLogin() { $('loginSection').hidden=false;$('editorSection').hidden=true; }
async function authenticate() {
  profile=await getStaffProfile();await reload();
  $('editorModeLabel').textContent=`${profile.display_name||'TRACC staff'} · ${profile.role.toUpperCase()}`;
  $('editorModeHelp').textContent=profile.role==='admin'?'Approve, return, reject and audit submissions.':'Create new nests or submit follow-up milestones. You cannot change approved relocation records.';
  $('exportSection').hidden=profile.role!=='admin';
  $('importButton').hidden=true;$('exportButton').hidden=true;
  $('logoutButton').hidden=false;showEditor();newNest();notice('Signed in. Your permissions are enforced by database policies; no changes are public without administrator approval.');
}
// Field-oriented .xlsx export; only approved public records by default. Private sheets require admin role.
const exportPublicKeys=[...publicKeys.filter(k=>k!=='public_metadata'),'updated_at'];
function flatRow(record,keys){return keys.map(key=>record?.[key] ?? null);}
function buildNestExport(rows){
  const dynamic=[...new Set(rows.flatMap(n=>Array.isArray(n.public_metadata)?n.public_metadata.map(m=>m?.label).filter(Boolean):[]))].sort();
  const headers=[...exportPublicKeys,...dynamic.map(name=>`Metadata: ${name}`)];
  return {name:'Approved Nests',rows:[headers,...rows.map(n=>[
    ...flatRow(n,exportPublicKeys),...dynamic.map(label=>n.public_metadata?.find(m=>m.label===label)?.value ?? null)
  ])]};
}
function buildPrivateExport(rows){
  const keys=[...privateKeys,'custom_private_metadata'];
  return {name:'Protected Research',rows:[['Nest ID',...keys],...rows.map(n=>{
    const r=researchById.get(n.id)||{};
    return [n.id,...keys.map(k=>typeof r[k]==='object' && r[k]!==null?JSON.stringify(r[k]):r[k]??null)];
  })]};
}
function buildReviewExport(){
  const h=['Submission ID','Nest ID','State','Submitted by','Submitted at','Reviewed by','Reviewed at','Review note','Base updated at','Public payload JSON','Protected payload JSON'];
  return {name:'Review Submissions',rows:[h,...submissions.map(x=>[x.submission_id,x.nest_id,x.review_state,x.submitted_by,x.submitted_at,x.reviewed_by,x.reviewed_at,x.review_note,x.base_updated_at,JSON.stringify(x.payload||{}),JSON.stringify(x.research_payload||{})])]};
}
function refreshExportOptions(){
  const season=$('exportYear'),species=$('exportSpecies'),nest=$('exportNest');
  const previous=[season.value,species.value,nest.value];
  season.replaceChildren();species.replaceChildren();nest.replaceChildren();
  const options=(el,values)=>{for(const v of values){const o=document.createElement('option');o.value=String(v);o.textContent=String(v);el.append(o);}};
  options(season,[...new Set(approved.map(n=>String(n.date_relocated||'').slice(0,4)).filter(Boolean))].sort().reverse());
  options(species,[...new Set(approved.map(n=>n.species).filter(Boolean))].sort());
  options(nest,approved.map(n=>n.id).sort());
  [season,species,nest].forEach((el,i)=>{if([...el.children].some(o=>o.value===previous[i]))el.value=previous[i];});
  $('exportPrivate').disabled=!canExportPrivate();
  const subOption=$('exportScope').querySelector?.('option[value="submissions"]');if(subOption)subOption.disabled=!canReview();
  updateExportControls();
}
function updateExportControls(){
  const scope=$('exportScope').value;
  for(const [id,value] of [['exportYearWrap','year'],['exportSpeciesWrap','species'],['exportNestWrap','nest']])$(id).hidden=scope!==value;
  $('exportPrivate').disabled=!canExportPrivate() || scope==='submissions';
}
function exportToExcel(){
  try{
    const scope=$('exportScope').value;let records=[...approved];
    if(scope==='submissions'){
      if(!canReview())throw Error('Only an administrator can export unapproved review requests.');
      if(!submissions.length)throw Error('No review submissions to export.');
      downloadXlsx([buildReviewExport()],`TRACC-Review-Submissions-${new Date().toISOString().slice(0,10)}.xlsx`);
      notice(`Downloaded ${submissions.length} sensitive submission records for internal review.`);return;
    }
    if(scope==='year')records=records.filter(n=>String(n.date_relocated||'').slice(0,4)===$('exportYear').value);
    if(scope==='species')records=records.filter(n=>n.species===$('exportSpecies').value);
    if(scope==='nest')records=records.filter(n=>n.id===$('exportNest').value);
    if(!records.length)throw Error('No approved records matched the selection.');
    if($('exportPrivate').checked&&!canExportPrivate())throw Error('Only administrators may export protected research data.');
    const sheets=[buildNestExport(records)];
    if($('exportPrivate').checked)sheets.push(buildPrivateExport(records));
    const suffix=scope==='all'?'All':scope==='year'?$('exportYear').value:scope==='species'?$('exportSpecies').value.replaceAll(/\s+/g,'-'):$('exportNest').value;
    downloadXlsx(sheets,`TRACC-Hatchery-${suffix}-${new Date().toISOString().slice(0,10)}.xlsx`);
    notice(`Downloaded ${records.length} approved nest records to Excel${sheets.length>1?' with a protected research worksheet':''}.`);
  }catch(error){notice(`Excel export failed: ${error.message}`,true);}
}
function bind() {
  $('exportScope').addEventListener('change',updateExportControls);
  $('exportExcel').addEventListener('click',exportToExcel);
  $('resetDemo').addEventListener('click',()=>{if(!isDemo())return;if(confirm('Reset all fictional demo nests, pending requests, and audit entries on this browser?')){clearDemoStore();location.reload();}});
  $('newNest').addEventListener('click',newNest);$('resetButton').addEventListener('click',newNest);
  $('quickMode').addEventListener('click',()=>setEntryMode('quick'));
  $('detailedMode').addEventListener('click',()=>setEntryMode('detailed'));
  $('milestoneForm').addEventListener('submit',submitMilestone);
  $('cancelMilestone').addEventListener('click',newNest);
  $('saveDraft').addEventListener('click',saveDraft);
  $('loadDraft').addEventListener('click',restoreDraft);
  $('clearDraft').addEventListener('click',()=>{if(confirm('Delete the encrypted draft saved on this device?')){clearEncryptedDraft();notice('Encrypted draft deleted.');}});
  $('addMetadata').addEventListener('click',()=>{try{addMetadataRow();}catch(e){notice(e.message,true);}});
  form.elements.namedItem('date_relocated').addEventListener('change',syncCalendarSeason);
  for(const key of ['healthy_hatchlings','deformed_hatchlings'])form.elements.namedItem(key).addEventListener('input',updateReleased);
  $('adminSearch').addEventListener('input',renderApproved);form.addEventListener('submit',submit);
  $('importButton').addEventListener('click',()=>$('importInput').click());$('importInput').addEventListener('change',importRequest);
  $('exportButton').addEventListener('click',exportApproved);
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();try {
      await signIn($('loginEmail').value,$('loginPassword').value);await authenticate();$('loginPassword').value='';
    }catch(err){notice(`Sign-in failed: ${err.message}`,true);} });
  $('logoutButton').addEventListener('click',async()=>{await signOut();showLogin();notice('Signed out.');});
}
async function start() {
  initThemeToggle('themeSwitch');
  bind();
  if(local()){
    $('editorModeLabel').textContent=`${isDemo()?'Demonstration':'JSON export'} · LOCAL REVIEW SIMULATION`;
    $('editorModeHelp').textContent='DEMO ONLY. No real accounts, shared database or automatic cross-device publishing. Enter fictional records only. Review requests can be transferred manually as JSON files.';
    profile={role:new URL(globalThis.location?.href||'http://localhost/admin.html').searchParams.get('role')==='warden'?'warden':'admin'};
    const saved=readDemoStore();if(saved){submissions=saved.submissions;researchById=new Map(saved.research);auditHistory=saved.audit;}
    $('exportSection').hidden=profile.role==='warden';
    $('importButton').hidden=profile.role==='warden';$('exportButton').hidden=profile.role==='warden';
    try{approved=await loadApprovedStaffNests();showEditor();newNest();renderApproved();renderReview();refreshExportOptions();renderAudit();notice(`TEST MODE (${profile.role.toUpperCase()}): fictional records only. Changes are stored on this browser, not shared across devices.`);}
    catch(e){notice(`Cannot load local data: ${e.message}`,true);}
  }else if(getSession()?.access_token){try{await authenticate();}catch{showLogin();notice('Please sign in again.');}}
  else{showLogin();notice('Sign in with a TRACC-approved staff account.');}
}
start();
