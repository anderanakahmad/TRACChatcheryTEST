import { loadNests, isDemo, isLive } from './api.js';
import { SITE } from './config.js';
import {translate,localizeRecordText} from './i18n.js?v=8-bm';
import {createQrSvg} from './qr.js';
import {daysSinceRelocation,displayPhase} from './phase.js';
import {initThemeToggle} from './theme.js?v=8-bm';

const $ = (id) => document.getElementById(id);
const output = (id, text) => { $(id).textContent = text; };
const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentDate = () => { const d = new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
const parseDate = (s) => s ? new Date(`${s}T12:00:00`) : null;
const daysBetween = (a,b) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);
const dateText = (s) => s && !Number.isNaN(parseDate(s)?.getTime()) ? parseDate(s).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'}) : tr('notRecorded');
const numberText = (n) => Number(n ?? 0).toLocaleString(locale());
const phaseTypes = ['incubating','emergence_soon','awaiting_update','emerged','excavated'];
const filteredStatus = (s) => phaseTypes.includes(s)?tr(s):tr('monitoring');
const statusClass = (s) => phaseTypes.includes(s)?s:'incubating';
const goodNum = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));
let allNests = [];
let viewMode = 'grid';
const readStored=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const saveStored=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* private browsing */}};
let language = readStored('tracc_language','en')==='ms'?'ms':'en';
const tr=(key,params)=>translate(language,key,params);
const locale=()=>language==='ms'?'ms-MY':'en-GB';
const speciesText=s=>tr(({'Green turtle':'green','Hawksbill turtle':'hawksbill','Olive ridley turtle':'olive','Other / unconfirmed':'otherSpecies'})[s]||'unclassified');
const recordText=s=>localizeRecordText(language,s);
const locationText=s=>s?recordText(s):tr('island');
let selectedSector=null;
let loadFailed=false;
let followed=new Set();
try {const data=JSON.parse(readStored('tracc_followed_nests','[]'));if(Array.isArray(data))followed=new Set(data.filter(id=>typeof id==='string'));}catch{}
function rememberFollowing(){saveStored('tracc_followed_nests',JSON.stringify([...followed]));}
function applyLanguage(){
  if(globalThis.document?.documentElement)document.documentElement.lang=language==='ms'?'ms':'en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=tr(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=tr(el.dataset.i18nPlaceholder);});
  for(const attr of ['aria-label','title','alt'])document.querySelectorAll('[data-i18n-'+attr+']').forEach(el=>el.setAttribute(attr,tr(el.getAttribute('data-i18n-'+attr))));
  document.title=tr('portalName')+' | TRACC';
  $('copyright').textContent=`© ${new Date().getFullYear()} TRACC · ${tr('portalName')}`;
  document.dispatchEvent(new Event('tracc-language-change'));
  $('languageSwitch').textContent=language==='en'?'BM':'EN';
  $('languageSwitch').setAttribute('aria-label',language==='en'?'View in Bahasa Melayu':'View in English');
}

const sectorCodes = new Set(['A1','A2','A3','B1','B2','B3','C1','C2','C3','D1','D2','D3','E','F1','F2','F3','G1','G2']);
function statusVisual(status) { const icon = SITE.STATUS_ICONS?.[status]; return icon ? `<img class="status-art" src="${safe(icon)}" alt="" loading="lazy">` : `<span class="status-art-fallback" aria-hidden="true">${{incubating:'◔',emergence_soon:'◉',awaiting_update:'◷',emerged:'✦',excavated:'◇'}[status] || '◌'}</span>`; }
function statusBadge(n) { const phase=displayPhase(n);return `<span class="nest-status status-${statusClass(phase)}">${statusVisual(phase)}${safe(filteredStatus(phase))}</span>`; }

// A nesting season is defined by the calendar year of the recorded relocation.
const seasonOf = n => /^\d{4}-\d{2}-\d{2}$/.test(n.date_relocated || '')
  ? Number(n.date_relocated.slice(0,4)) : Number(n.season);
const tagsPresent = n => Boolean(String(n.mother_tag_left||'').trim() || String(n.mother_tag_right||'').trim());


function elapsed(nest) {
  const start = parseDate(nest.date_relocated);
  return start ? Math.max(0,daysBetween(start,currentDate())) : null;
}
function expectedProgress(nest) {
  const start = parseDate(nest.date_relocated);
  const end = parseDate(nest.expected_start);
  if (!start || !end || end <= start) return null;
  return Math.min(100,Math.max(0,Math.round(100 * daysBetween(start,currentDate()) / daysBetween(start,end))));
}
function ratesReady(n) { return Boolean(n.excavation_date); }
function rate(value, total, confirmed) { return confirmed && goodNum(value) && Number(total) > 0 ? `${(100*Number(value)/Number(total)).toFixed(1)}%` : tr('pending'); }
function estimatedLabel(n) {
  if (n.expected_start && n.expected_end) return `${dateText(n.expected_start)} – ${dateText(n.expected_end)}`;
  if (n.expected_start) return `${tr('from')} ${dateText(n.expected_start)}`;
  if (n.expected_end) return `${tr('byDate')} ${dateText(n.expected_end)}`;
  return tr('notSet');
}
function timeCard(n) {
  const phase=displayPhase(n);
  const elapsedDays = daysSinceRelocation(n);
  const progress = expectedProgress(n);
  if (n.status !== 'incubating') return `<div class="progress-head"><strong>${safe(filteredStatus(n.status))}</strong><span>${tr('observedMilestone')}</span></div><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>`;
  const phaseHint = phase==='emergence_soon'?tr('emergenceEstimate') : phase==='awaiting_update'?tr('awaitingObservation') : '';
  if (progress === null) return `<div class="progress-head"><strong>${tr('day')} ${elapsedDays ?? '—'} ${tr('sinceRelocation')}</strong></div><div class="progress-unknown">${phaseHint||tr('incubationEstimate')}</div>`;
  return `<div class="progress-head"><strong>${tr('day')} ${elapsedDays ?? '—'} ${tr('sinceRelocation')}</strong><span>${progress}% ${tr('estimatedTime')}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>${phaseHint?`<p class="phase-hint">${phaseHint}</p>`:''}`;
}
function nestReleaseShown(n){return ['emerged','excavated'].includes(n.status) && goodNum(n.released_hatchlings) && Number(n.released_hatchlings)>0;}
function renderCard(n) {
  return `<button class="nest-card" type="button" data-nest="${safe(n.id)}" aria-label="${safe(tr('openNest'))} ${safe(n.id)}">
  <div class="nest-card-intro"><div class="card-top">${statusBadge(n)}<span class="card-season">${tr('season').toUpperCase()} ${safe(seasonOf(n))}</span></div>
  <h3 class="card-title">${tr('nest')} ${safe(n.id)}</h3><span class="card-species">${safe(speciesText(n.species))} · ${safe(locationText(n.island_sector_found))}</span></div>
  <div class="nest-card-progress">${timeCard(n)}</div><div class="card-detail-row"><div><span class="card-meta-label">${tr('eggsRelocated')}</span><span class="card-meta-value">${numberText(n.egg_count)}</span></div>${nestReleaseShown(n)?`<div><span class="card-meta-label">${tr('hatchlingsReleased')}</span><span class="card-meta-value hatchlings-value">${numberText(n.released_hatchlings)}</span></div>`:''}<div><span class="card-meta-label">${tr('relocatedOn')}</span><span class="card-meta-value">${dateText(n.date_relocated)}</span></div></div>
  <div class="card-footer"><span>${followed.has(n.id)?'★ ':''}${tr('viewJourney')}</span><span aria-hidden="true">↗</span></div></button>`;
}
function countStats(rows) {
  const sum = key => rows.reduce((t,n)=>t+(goodNum(n[key]) ? Number(n[key]) : 0),0);
  const releaseKnown=rows.filter(n=>goodNum(n.released_hatchlings)).length;
  return { nests:rows.length,eggs:sum('egg_count'),released:releaseKnown?sum('released_hatchlings'):null,
    active:rows.filter(n=>n.status==='incubating').length,releaseKnown };
}
function breakdownTable(elementId, rows, key) {
  const grouped = new Map();
  for(const nest of rows) {
    const label=String(key==='season'?seasonOf(nest):(nest[key]??tr('unclassified')));
    if(!grouped.has(label))grouped.set(label,[]);
    grouped.get(label).push(nest);
  }
  const table=$(elementId);table.replaceChildren();
  if(!grouped.size) {
    const row=document.createElement('tr'),cell=document.createElement('td');
    cell.colSpan=4;cell.className='empty-breakdown';cell.textContent=tr('noApproved');
    row.append(cell);table.append(row);return;
  }
  const sorted=[...grouped].sort((a,b)=>key==='season'?Number(b[0])-Number(a[0]):a[0].localeCompare(b[0]));
  for(const [label,entries] of sorted) {
    const stat=countStats(entries),row=document.createElement('tr');
    for(const val of [key==='species'?speciesText(label):label,numberText(stat.nests),numberText(stat.eggs),stat.released===null?'—':numberText(stat.released)]) {
      const cell=document.createElement('td');cell.textContent=val;row.append(cell);
    }
    table.append(row);
  }
}
function renderTrend(rows, selectedYear, selectedSpecies) {
  const monthly=Boolean(selectedYear);
  const labels=monthly ? ['jMonth','fMonth','mMonth','aMonth','mayMonth','junMonth','julMonth','augMonth','sepMonth','octMonth','novMonth','decMonth'].map(k=>tr(k)) : null;
  const years=[...new Set(allNests.map(seasonOf).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100))].sort((a,b)=>a-b);
  const xValues=monthly ? Array.from({length:12},(_,i)=>i+1) : (years.length ? Array.from({length:years.at(-1)-years[0]+1},(_,i)=>years[0]+i) : []);
  const counts=xValues.map(x=>rows.filter(n=>monthly ? Number((n.date_relocated||'').slice(5,7))===x : seasonOf(n)===x).length);
  const title=monthly?`${tr('trendMonth')} · ${selectedYear}`:tr('trendYear');
  output('trendTitle',title);
  output('trendSubtitle',selectedSpecies?speciesText(selectedSpecies):tr('allTurtles'));
  const wrap=$('trendChart');
  if(!xValues.length){wrap.innerHTML=`<p class="chart-note">${safe(tr('noGraph'))}</p>`;output('trendNote',tr('graphUpdates'));return;}
  const W=680,H=260,left=43,right=18,top=19,bottom=46;
  const max=Math.max(1,...counts),peak=max<=4?4:Math.ceil(max/4)*4;
  const x=i=>left+(xValues.length===1?(W-left-right)/2:i*(W-left-right)/(xValues.length-1));
  const y=count=>top+(peak-count)*(H-top-bottom)/peak;
  let markup='';
  for(let step=0;step<=4;step++){
    const value=Math.round(peak*step/4),yy=y(value);
    markup+=`<line class="grid-line" x1="${left}" y1="${yy.toFixed(1)}" x2="${W-right}" y2="${yy.toFixed(1)}"/><text class="y-label" x="${left-11}" y="${(yy+4).toFixed(1)}" text-anchor="end">${value}</text>`;
  }
  for(let i=0;i<xValues.length;i++){
    if(xValues.length>13 && i%Math.ceil(xValues.length/9)!==0 && i!==xValues.length-1)continue;
    markup+=`<text class="axis-label" x="${x(i).toFixed(1)}" y="${H-19}" text-anchor="middle">${monthly?labels[i]:xValues[i]}</text>`;
  }
  const path=counts.map((c,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(' ');
  markup+=`<path class="series-line" d="${path}"/>`;
  counts.forEach((c,i)=>{const pointLabel=monthly?`${labels[i]} ${selectedYear}`:String(xValues[i]);markup+=`<circle class="series-dot" cx="${x(i).toFixed(1)}" cy="${y(c).toFixed(1)}" r="4.7"><title>${pointLabel}: ${c} ${tr('nestsRelocated').toLowerCase()}</title></circle>`;});
  wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${safe(title)}: ${counts.map((v,i)=>`${monthly?labels[i]:xValues[i]} ${v}`).join(', ')}"><title>${safe(title)}</title>${markup}</svg>`;
  output('trendNote',[tr('graphSpan',{n:counts.reduce((a,b)=>a+b,0),period:monthly?tr('janDec'):`${xValues[0]}–${xValues.at(-1)}`}),selectedSpecies?tr('graphFiltered',{species:speciesText(selectedSpecies)}):'',tr('graphHover')].filter(Boolean).join(' '));
}
function renderStats() {
  const season=$('statSeasonFilter').value,species=$('statSpeciesFilter').value;
  const visible=allNests.filter(n=>(!season||String(seasonOf(n))===season)&&(!species||n.species===species));
  const totals=countStats(visible);
  output('statRecords',numberText(totals.nests));
  output('statEggs',numberText(totals.eggs));
  output('statReleased',totals.released===null?'—':numberText(totals.released));
  output('statActive',numberText(totals.active));
  output('statFootnote',tr('statsNote',{n:numberText(visible.length),r:numberText(totals.releaseKnown)}));
  breakdownTable('speciesBreakdown',visible,'species');
  renderTrend(visible, season, species);
  output('dataLabel',isDemo()?tr('preview'):tr(isLive()?'liveLabel':'staticLabel'));
}
function fillFilters() {
  const seasons=[...new Set(allNests.map(seasonOf))].filter(y=>Number.isInteger(y)).sort((a,b)=>b-a);
  const species=[...new Set(allNests.map(n=>n.species))].sort();
  for(const [ids,values,caption] of [[['seasonFilter','statSeasonFilter'],seasons,v=>tr('seasonOption',{year:v})],[['speciesFilter','statSpeciesFilter'],species,speciesText]]){
    for(const id of ids){const select=$(id),previous=select.value;while(select.options.length>1)select.remove(1);
      for(const value of values){const opt=document.createElement('option');opt.value=String(value);opt.textContent=caption(value);select.append(opt);}
      if([...select.options].some(o=>o.value===previous))select.value=previous;
    }
  }
}
function renderGrid() {
  const query = $('nestSearch').value.trim().toLowerCase();
  const season = $('seasonFilter').value, status = $('statusFilter').value, species = $('speciesFilter').value;
  const filtered = allNests.filter(n => (!$('followedOnly').checked || followed.has(n.id)) && (!query || `${n.id} ${n.warden_public_name ?? ''} ${n.species} ${speciesText(n.species)} ${recordText(n.warden_public_name||'')}`.toLowerCase().includes(query)) && (!season || String(seasonOf(n)) === season) && (!status || displayPhase(n) === status) && (!species || n.species === species));
  const sortMode=$('sortNests').value;
  filtered.sort((a,b) => {
    if(sortMode==='soon'){
      const rank=n=>n.status==='incubating' ? (displayPhase(n)==='emergence_soon'?0:displayPhase(n)==='awaiting_update'?2:parseDate(n.expected_start)?1:2) : 3;
      const rankDiff=rank(a)-rank(b);if(rankDiff)return rankDiff;
      if(rank(a)<=1){const expected=n=>String(n.expected_start||n.date_relocated);const diff=expected(a).localeCompare(expected(b));if(diff)return diff;}
    }
    return String(b.date_relocated).localeCompare(String(a.date_relocated)) || String(a.id).localeCompare(String(b.id));
  });
  $('nestGrid').innerHTML = filtered.map(renderCard).join('');
  $('nestGrid').classList.toggle('list-layout',viewMode==='list');
  $('emptyState').hidden = filtered.length !== 0;
  output('resultCount',`${filtered.length} ${tr(filtered.length===1?'foundNest':'foundNests')}`);
}
function resetFilters() { for (const id of ['nestSearch','seasonFilter','statusFilter','speciesFilter']) $(id).value=''; $('sortNests').value='latest'; $('followedOnly').checked=false; renderGrid(); }
function setView(mode) {
  viewMode=mode;
  $('gridView').classList.toggle('view-active', mode==='grid');
  $('listView').classList.toggle('view-active', mode==='list');
  $('gridView').setAttribute('aria-pressed',String(mode==='grid'));
  $('listView').setAttribute('aria-pressed',String(mode==='list'));
  renderGrid();
}
function recordField(label, value) { return `<div class="detail-pair"><span class="detail-key">${safe(label)}</span><span class="detail-value">${safe(value)}</span></div>`; }
function showNest(nest,updateHistory=true) {
  const progress = expectedProgress(nest);
  const time = daysSinceRelocation(nest);
  const phase = displayPhase(nest);
  const estimate = nest.status === 'incubating' && progress !== null;
  const hasAssessment = ratesReady(nest);
  $('dialogContent').innerHTML = `<div class="dialog-kicker">${tr('dialogKicker')}</div>
    <h2 class="dialog-title" id="dialogTitle">${tr('nest')} ${safe(nest.id)}</h2>
    <div class="dialog-subtitle">${safe(speciesText(nest.species))} · ${tr('season')} ${safe(seasonOf(nest))} · ${tr('island')}</div>
    <div class="dialog-status">${statusBadge(nest)}</div>
    <div class="dialog-timeline"><div class="timeline-heading"><span>${nest.status==='incubating' ? `${tr('day')} ${time ?? '—'} ${tr('sinceRelocation')}` : tr('latestStatus')}</span><span>${estimate ? `${progress}% ${tr('estimatedTime')}` : safe(filteredStatus(phase))}</span></div>
      ${estimate ? `<div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>` : ''}
      <p class="timeline-note">${nest.status==='incubating' ? tr('timelineEstimate') : tr('timelineObserved')} ${phase==='emergence_soon'?tr('timelineSoon'):phase==='awaiting_update'?tr('timelineLate'):''}</p></div>
    <div class="dialog-details">
      ${recordField(tr('nestId'),nest.id)}${recordField(tr('species'),speciesText(nest.species))}
      ${recordField(tr('eggsRelocated'),numberText(nest.egg_count))}${recordField(tr('responsible'),recordText(nest.warden_public_name) || tr('notPublished'))}
      ${recordField(tr('dateLaid'),dateText(nest.date_laid))}${recordField(tr('dateRelocated'),dateText(nest.date_relocated))}
      ${recordField(tr('sectorFound'),recordText(nest.island_sector_found) || tr('notPublished'))}
      ${recordField(tr('expected'),estimatedLabel(nest))}${recordField(tr('firstEmergence'),dateText(nest.emergence_date))}
      ${recordField(tr('hatchDate'),dateText(nest.hatch_date))}${recordField(tr('excavationDate'),dateText(nest.excavation_date))}
    </div>
    ${nest.island_sector_found ? `<p class="dialog-map-link"><a href="#sectors" data-jump-sector="${safe(nest.island_sector_found)}">${safe(tr('seeSector',{sector:locationText(nest.island_sector_found)}))} ↗</a></p>` : ''}
    <h3 class="outcome-title">${tr('hatchingOutcomes')}</h3>
    <div class="outcome-grid"><div class="outcome-box"><strong>${rate(nest.hatched_eggs,nest.egg_count,hasAssessment)}</strong><span>${tr('hatchingSuccess')}</span></div><div class="outcome-box"><strong>${rate(nest.emerged_hatchlings,nest.egg_count,hasAssessment)}</strong><span>${tr('emergenceSuccess')}</span></div><div class="outcome-box"><strong>${goodNum(nest.released_hatchlings) ? numberText(nest.released_hatchlings) : tr('pending')}</strong><span>${tr('hatchlingsReleased')}</span></div><div class="outcome-box"><strong>${hasAssessment && goodNum(nest.hatched_eggs) ? numberText(nest.hatched_eggs) : tr('pending')}</strong><span>${tr('hatchedEggs')}</span></div></div>
    ${tagsPresent(nest) ? `<section class="mother-section"><h3>${tr('identifiedMother')}</h3><div class="dialog-details">
      ${nest.mother_tag_left ? recordField(tr('leftTag'),nest.mother_tag_left) : ''}
      ${nest.mother_tag_right ? recordField(tr('rightTag'),nest.mother_tag_right) : ''}
      ${goodNum(nest.mother_ccl_cm)?recordField(tr('ccl'),`${numberText(nest.mother_ccl_cm)} cm`):''}
      ${goodNum(nest.mother_ccw_cm)?recordField(tr('ccw'),`${numberText(nest.mother_ccw_cm)} cm`):''}
      </div>${nest.mother_note_public?`<p>${safe(recordText(nest.mother_note_public))}</p>`:''}</section>` : ''}
    ${Array.isArray(nest.public_metadata) && nest.public_metadata.length ? `<section class="mother-section"><h3>${tr('more')}</h3><div class="custom-metadata-list">${nest.public_metadata.filter(m=>m && typeof m.label==='string'&&typeof m.value==='string'&&m.label.trim()&&m.value.trim()).slice(0,20).map(m=>recordField(recordText(m.label),recordText(m.value))).join('')}</div></section>` : ''}
    ${nest.notes_public ? `<div class="dialog-note"><strong>${tr('wardenUpdate')}</strong><div>${safe(recordText(nest.notes_public))}</div></div>` : ''}
    <div class="dialog-foot"><span>${tr('lastUpdated')}: ${nest.updated_at ? new Date(nest.updated_at).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'}) : tr('notRecorded')}</span><button type="button" id="shareNest">${tr('copyLink')}</button>
      <button type="button" id="followNest" aria-pressed="${followed.has(nest.id)}">${tr(followed.has(nest.id)?'following':'follow')}</button>
      <button type="button" id="toggleQr">QR</button></div>
    <div id="nestQrPanel" class="nest-qr-panel" hidden><strong>${tr('qrTitle')}</strong><div id="nestQrCode" class="nest-qr-code"></div><p class="qr-hint">${safe(nest.id)} · ${safe(SITE.ORGANIZATION_NAME)}</p>
      <button class="btn btn-outline" type="button" id="downloadQr">${tr('downloadQr')} · SVG</button></div>`;
  if(!$('nestDialog').open)$('nestDialog').showModal();
  $('shareNest').addEventListener('click',async()=>{
    const url = `${location.origin}${location.pathname}?nest=${encodeURIComponent(nest.id)}`;
    try {await navigator.clipboard.writeText(url);$('shareNest') .textContent=tr('linkCopied');} catch {prompt(tr('copyPrompt'),url);}
  });
  $('followNest').addEventListener('click',()=>{
    if(followed.has(nest.id))followed.delete(nest.id);else followed.add(nest.id);
    rememberFollowing();$('followNest').textContent=tr(followed.has(nest.id)?'following':'follow');
    $('followNest').setAttribute('aria-pressed',String(followed.has(nest.id)));renderGrid();
  });
  const nestUrl=`${location.origin}${location.pathname}?nest=${encodeURIComponent(nest.id)}`;
  $('toggleQr').addEventListener('click',()=>{
    const panel=$('nestQrPanel');panel.hidden=!panel.hidden;
    if(!panel.hidden){try{$('nestQrCode').innerHTML=createQrSvg(nestUrl,5);}catch(e){$('nestQrCode').textContent=tr('qrError');}}
  });
  $('downloadQr').addEventListener('click',()=>{
    try{
      const svg=createQrSvg(nestUrl,7),blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`TRACC-nest-${nest.id}-QR.svg`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){alert(tr('qrError'));}
  });
  if (updateHistory) history.replaceState(null,'',`${location.pathname}?nest=${encodeURIComponent(nest.id)}${location.hash}`);
}
function closeNest() { $('nestDialog').close(); if (new URL(location.href).searchParams.has('nest')) history.replaceState(null,'',`${location.pathname}${location.hash}`); }
function renderActivity() {
  const today=currentDate();
  const events=[];
  for(const n of allNests){
    for(const [field,label] of [['date_relocated','eventRelocated'],['emergence_date','eventEmerged'],['excavation_date','eventExcavated']]){
      const date=parseDate(n[field]);
      if(!date || date>today)continue;
      events.push({id:n.id,date:n[field],label,species:n.species});
    }
  }
  events.sort((a,b)=>b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const activityHost = $('activityFeed');
  if (!activityHost) return;
  activityHost.innerHTML = events.length ? events.slice(0,4).map(e => `<button class="activity-item" type="button" data-activity-nest="${safe(e.id)}"><span class="activity-date">${dateText(e.date)}</span><strong>${safe(tr(e.label))}</strong><span>${safe(e.id)} · ${safe(speciesText(e.species))}</span><span class="activity-arrow" aria-hidden="true">↗</span></button>`).join('') : `<p class="activity-empty">${safe(tr('noActivity'))}</p>`;
}
function showSector(sector,scroll=true){
  selectedSector=sector;
  const code=String(sector||'').trim().toUpperCase();
  const exact=sectorCodes.has(code);
  $('sectorSelected').innerHTML=`<span class="sector-selected-dot">◎</span><div><strong>${exact?`${tr('sector')} ${safe(code)}`:safe(recordText(sector)||tr('sectorUnknown'))}</strong><span>${exact?tr('sectorExact'):tr('sectorGeneral')}</span></div>`;
  if(scroll)$('sectors').scrollIntoView({behavior:'smooth',block:'start'});
}
function configureHeroArtwork(){
  if(!SITE.HERO_ART_URL)return;
  const host=$('heroArtwork');const img=document.createElement('img');img.src=SITE.HERO_ART_URL;img.alt='';img.className='hero-custom-art';
  img.addEventListener('error',()=>{host.replaceChildren(); host.textContent=tr('artError');});
  host.replaceChildren(img);
}
async function start() {
  $('demoBanner').hidden = !isDemo();
  configureHeroArtwork();
  initThemeToggle('themeSwitch');
  applyLanguage();
  $('languageSwitch').addEventListener('click',()=>{
    language=language==='en'?'ms':'en';saveStored('tracc_language',language);
    applyLanguage();
    if(loadFailed){output('resultCount',tr('recordsUnavailable'));output('dataLabel',tr('dataUnavailable'));}
    else {fillFilters();renderStats();renderGrid();renderActivity();}
    if(selectedSector!==null)showSector(selectedSector,false);
    if($('nestDialog')?.open){const id=new URL(location.href).searchParams.get('nest');const nest=allNests.find(n=>n.id===id);if(nest)showNest(nest,false);}
  });
  $('followedOnly').addEventListener('change',renderGrid);
  $('copyright').textContent = `© ${new Date().getFullYear()} TRACC · ${tr('portalName')}`;
  $('brandLogoLink').href=SITE.WEBSITE_URL;
  $('instagramLink').href=SITE.INSTAGRAM_URL;
  $('websiteLink').href=SITE.WEBSITE_URL;
  for (const id of ['nestSearch','seasonFilter','statusFilter','speciesFilter','sortNests']) $(id).addEventListener(id==='nestSearch'?'input':'change',renderGrid);
  for (const id of ['statSeasonFilter','statSpeciesFilter']) $(id).addEventListener('change',renderStats);
  $('clearFilters').addEventListener('click',resetFilters);$('emptyClear').addEventListener('click',resetFilters);
  $('activityFeed')?.addEventListener('click',event=>{const button=event.target.closest('[data-activity-nest]');if(!button)return;const nest=allNests.find(n=>n.id===button.dataset.activityNest);if(nest)showNest(nest);});
  $('dialogContent').addEventListener('click',event=>{const link=event.target.closest('[data-jump-sector]');if(!link)return;event.preventDefault();closeNest();showSector(link.dataset.jumpSector);});
  $('gridView').addEventListener('click',()=>setView('grid'));
  $('listView').addEventListener('click',()=>setView('list'));
  $('nestGrid').addEventListener('click',event=>{const button=event.target.closest('[data-nest]');if(!button)return;const nest=allNests.find(n=>n.id===button.dataset.nest);if(nest)showNest(nest);});
  $('dialogClose').addEventListener('click',closeNest);
  $('nestDialog').addEventListener('click',e=>{if(e.target === $('nestDialog'))closeNest();});
  $('nestDialog').addEventListener('close',()=>{if(new URL(location.href).searchParams.has('nest'))history.replaceState(null,'',`${location.pathname}${location.hash}`);});
  try {
    allNests = await loadNests();
    fillFilters();renderStats();renderGrid();renderActivity();
    const selected = new URL(location.href).searchParams.get('nest');
    const match = allNests.find(n=>n.id===selected);
    if(match)showNest(match,false);
  } catch(error) {
    console.error('Nest fetch failed:',error);
    $('loadError').hidden=false;
    loadFailed=true;
    output('resultCount',tr('recordsUnavailable'));
    output('dataLabel',tr('dataUnavailable'));
  }
}
start().catch(error => {
  console.error('Portal initialization failed:', error);
  const label = document.getElementById('resultCount');
  if (label) label.textContent = tr('initError');
  const warning = document.getElementById('loadError');
  if (warning) warning.hidden = false;
});
