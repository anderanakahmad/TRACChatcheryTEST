import { loadNests, isDemo, isLive } from './api.js';
import { SITE } from './config.js';
import {translate} from './i18n.js';
import {createQrSvg} from './qr.js';
import {daysSinceRelocation,displayPhase} from './phase.js';
import {initThemeToggle} from './theme.js';

const $ = (id) => document.getElementById(id);
const output = (id, text) => { $(id).textContent = text; };
const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentDate = () => { const d = new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
const parseDate = (s) => s ? new Date(`${s}T12:00:00`) : null;
const daysBetween = (a,b) => Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate()) - Date.UTC(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);
const dateText = (s) => s && !Number.isNaN(parseDate(s)?.getTime()) ? parseDate(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Not recorded';
const numberText = (n) => Number(n ?? 0).toLocaleString('en-GB');
const phaseTypes = ['incubating','emergence_soon','awaiting_update','emerged','excavated'];
const filteredStatus = (s) => phaseTypes.includes(s)?tr(s):'Monitoring';
const statusClass = (s) => phaseTypes.includes(s)?s:'incubating';
const goodNum = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));
let allNests = [];
let viewMode = 'grid';
const readStored=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const saveStored=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* private browsing */}};
let language = readStored('tracc_language','en')==='ms'?'ms':'en';
const tr=key=>translate(language,key);
let followed=new Set();
try {const data=JSON.parse(readStored('tracc_followed_nests','[]'));if(Array.isArray(data))followed=new Set(data.filter(id=>typeof id==='string'));}catch{}
function rememberFollowing(){saveStored('tracc_followed_nests',JSON.stringify([...followed]));}
function applyLanguage(){
  if(globalThis.document?.documentElement)document.documentElement.lang=language==='ms'?'ms':'en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=tr(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=tr(el.dataset.i18nPlaceholder);});
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
  if (n.expected_start) return `From ${dateText(n.expected_start)}`;
  if (n.expected_end) return `By ${dateText(n.expected_end)}`;
  return 'Not set';
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
  return `<button class="nest-card" type="button" data-nest="${safe(n.id)}" aria-label="Open details for nest ${safe(n.id)}">
  <div class="nest-card-intro"><div class="card-top">${statusBadge(n)}<span class="card-season">${tr('season').toUpperCase()} ${safe(seasonOf(n))}</span></div>
  <h3 class="card-title">Nest ${safe(n.id)}</h3><span class="card-species">${safe(n.species)} · ${safe(n.island_sector_found || 'Pom Pom Island')}</span></div>
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
    const label=String(key==='season'?seasonOf(nest):(nest[key]??'Unclassified'));
    if(!grouped.has(label))grouped.set(label,[]);
    grouped.get(label).push(nest);
  }
  const table=$(elementId);table.replaceChildren();
  if(!grouped.size) {
    const row=document.createElement('tr'),cell=document.createElement('td');
    cell.colSpan=4;cell.className='empty-breakdown';cell.textContent='No approved records for this selection';
    row.append(cell);table.append(row);return;
  }
  const sorted=[...grouped].sort((a,b)=>key==='season'?Number(b[0])-Number(a[0]):a[0].localeCompare(b[0]));
  for(const [label,entries] of sorted) {
    const stat=countStats(entries),row=document.createElement('tr');
    for(const val of [label,numberText(stat.nests),numberText(stat.eggs),stat.released===null?'—':numberText(stat.released)]) {
      const cell=document.createElement('td');cell.textContent=val;row.append(cell);
    }
    table.append(row);
  }
}
function renderTrend(rows, selectedYear, selectedSpecies) {
  const monthly=Boolean(selectedYear);
  const labels=monthly ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : null;
  const years=[...new Set(allNests.map(seasonOf).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100))].sort((a,b)=>a-b);
  const xValues=monthly ? Array.from({length:12},(_,i)=>i+1) : (years.length ? Array.from({length:years.at(-1)-years[0]+1},(_,i)=>years[0]+i) : []);
  const counts=xValues.map(x=>rows.filter(n=>monthly ? Number((n.date_relocated||'').slice(5,7))===x : seasonOf(n)===x).length);
  const title=monthly?`Nests relocated by month · ${selectedYear}`:'Nests relocated by year';
  output('trendTitle',title);
  output('trendSubtitle',selectedSpecies || 'All sea turtle species');
  const wrap=$('trendChart');
  if(!xValues.length){wrap.innerHTML='<p class="chart-note">No approved nest records to graph for this selection.</p>';output('trendNote','Graph updates with the season and species selectors.');return;}
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
  counts.forEach((c,i)=>{const pointLabel=monthly?`${labels[i]} ${selectedYear}`:String(xValues[i]);markup+=`<circle class="series-dot" cx="${x(i).toFixed(1)}" cy="${y(c).toFixed(1)}" r="4.7"><title>${pointLabel}: ${c} nests relocated</title></circle>`;});
  wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${safe(title)}: ${counts.map((v,i)=>`${monthly?labels[i]:xValues[i]} ${v}`).join(', ')}"><title>${safe(title)}</title>${markup}</svg>`;
  output('trendNote',`${counts.reduce((a,b)=>a+b,0)} approved nests across ${monthly?'January–December':`${xValues[0]}–${xValues.at(-1)}`}. ${selectedSpecies?'Filtered to '+selectedSpecies+'. ':''}Hover over chart points for counts.`);
}
function renderStats() {
  const season=$('statSeasonFilter').value,species=$('statSpeciesFilter').value;
  const visible=allNests.filter(n=>(!season||String(seasonOf(n))===season)&&(!species||n.species===species));
  const totals=countStats(visible);
  output('statRecords',numberText(totals.nests));
  output('statEggs',numberText(totals.eggs));
  output('statReleased',totals.released===null?'—':numberText(totals.released));
  output('statActive',numberText(totals.active));
  output('statFootnote',`Showing ${numberText(visible.length)} administrator-approved nest records. Release counts are recorded for ${numberText(totals.releaseKnown)} of these nests; missing counts are not assumed to be zero.`);
  breakdownTable('seasonBreakdown',visible,'season');
  breakdownTable('speciesBreakdown',visible,'species');
  renderTrend(visible, season, species);
  output('dataLabel',isDemo()?tr('preview'):`Hatchery records · ${isLive()?'APPROVED LIVE RECORDS':'APPROVED STATIC RECORDS'}`);
}
function fillFilters() {
  const seasons=[...new Set(allNests.map(seasonOf))].filter(y=>Number.isInteger(y)).sort((a,b)=>b-a);
  const species=[...new Set(allNests.map(n=>n.species))].sort();
  for(const id of ['seasonFilter','statSeasonFilter'])$(id).insertAdjacentHTML('beforeend',seasons.map(y=>`<option value="${safe(y)}">${safe(y)} season</option>`).join(''));
  for(const id of ['speciesFilter','statSpeciesFilter'])$(id).insertAdjacentHTML('beforeend',species.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join(''));
}
function renderGrid() {
  const query = $('nestSearch').value.trim().toLowerCase();
  const season = $('seasonFilter').value, status = $('statusFilter').value, species = $('speciesFilter').value;
  const filtered = allNests.filter(n => (!$('followedOnly').checked || followed.has(n.id)) && (!query || `${n.id} ${n.warden_public_name ?? ''} ${n.species}`.toLowerCase().includes(query)) && (!season || String(seasonOf(n)) === season) && (!status || displayPhase(n) === status) && (!species || n.species === species));
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
  $('dialogContent').innerHTML = `<div class="dialog-kicker">TRACC HATCHERY · NEST RECORD</div>
    <h2 class="dialog-title" id="dialogTitle">Nest ${safe(nest.id)}</h2>
    <div class="dialog-subtitle">${safe(nest.species)} · Season ${safe(seasonOf(nest))} · Pom Pom Island</div>
    <div class="dialog-status">${statusBadge(nest)}</div>
    <div class="dialog-timeline"><div class="timeline-heading"><span>${nest.status==='incubating' ? `${tr('day')} ${time ?? '—'} ${tr('sinceRelocation')}` : 'Latest reported status'}</span><span>${estimate ? `${progress}% ${tr('estimatedTime')}` : safe(filteredStatus(phase))}</span></div>
      ${estimate ? `<div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>` : ''}
      <p class="timeline-note">${nest.status==='incubating' ? 'The bar indicates calendar time toward the estimated start of emergence; it does not measure embryo development.' : 'This status comes from monitoring observations entered by the hatchery team.'} ${phase==='emergence_soon'?'This window is a calendar-based prompt, not confirmation that hatching has started.':phase==='awaiting_update'?'The 50–60 day window has passed; the hatchery team has not yet published a confirmed outcome.':''}</p></div>
    <div class="dialog-details">
      ${recordField(tr('nestId'),nest.id)}${recordField(tr('species'),nest.species)}
      ${recordField(tr('eggsRelocated'),numberText(nest.egg_count))}${recordField(tr('responsible'),nest.warden_public_name || tr('notPublished'))}
      ${recordField(tr('dateLaid'),dateText(nest.date_laid))}${recordField(tr('dateRelocated'),dateText(nest.date_relocated))}
      ${recordField(tr('sectorFound'),nest.island_sector_found || tr('notPublished'))}
      ${recordField(tr('expected'),estimatedLabel(nest))}${recordField(tr('firstEmergence'),dateText(nest.emergence_date))}
      ${recordField(tr('hatchDate'),dateText(nest.hatch_date))}${recordField(tr('excavationDate'),dateText(nest.excavation_date))}
    </div>
    ${nest.island_sector_found ? `<p class="dialog-map-link"><a href="#sectors" data-jump-sector="${safe(nest.island_sector_found)}">See sector ${safe(nest.island_sector_found)} on the island map ↗</a></p>` : ''}
    <h3 class="outcome-title">${tr('hatchingOutcomes')}</h3>
    <div class="outcome-grid"><div class="outcome-box"><strong>${rate(nest.hatched_eggs,nest.egg_count,hasAssessment)}</strong><span>${tr('hatchingSuccess')}</span></div><div class="outcome-box"><strong>${rate(nest.emerged_hatchlings,nest.egg_count,hasAssessment)}</strong><span>${tr('emergenceSuccess')}</span></div><div class="outcome-box"><strong>${goodNum(nest.released_hatchlings) ? numberText(nest.released_hatchlings) : tr('pending')}</strong><span>${tr('hatchlingsReleased')}</span></div><div class="outcome-box"><strong>${hasAssessment && goodNum(nest.hatched_eggs) ? numberText(nest.hatched_eggs) : tr('pending')}</strong><span>${tr('hatchedEggs')}</span></div></div>
    ${tagsPresent(nest) ? `<section class="mother-section"><h3>${tr('identifiedMother')}</h3><div class="dialog-details">
      ${nest.mother_tag_left ? recordField(tr('leftTag'),nest.mother_tag_left) : ''}
      ${nest.mother_tag_right ? recordField(tr('rightTag'),nest.mother_tag_right) : ''}
      ${goodNum(nest.mother_ccl_cm)?recordField(tr('ccl'),`${numberText(nest.mother_ccl_cm)} cm`):''}
      ${goodNum(nest.mother_ccw_cm)?recordField(tr('ccw'),`${numberText(nest.mother_ccw_cm)} cm`):''}
      </div>${nest.mother_note_public?`<p>${safe(nest.mother_note_public)}</p>`:''}</section>` : ''}
    ${Array.isArray(nest.public_metadata) && nest.public_metadata.length ? `<section class="mother-section"><h3>${tr('more')}</h3><div class="custom-metadata-list">${nest.public_metadata.filter(m=>m && typeof m.label==='string'&&typeof m.value==='string'&&m.label.trim()&&m.value.trim()).slice(0,20).map(m=>recordField(m.label,m.value)).join('')}</div></section>` : ''}
    ${nest.notes_public ? `<div class="dialog-note"><strong>${tr('wardenUpdate')}</strong><div>${safe(nest.notes_public)}</div></div>` : ''}
    <div class="dialog-foot"><span>${tr('lastUpdated')}: ${nest.updated_at ? new Date(nest.updated_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Not recorded'}</span><button type="button" id="shareNest">${tr('copyLink')}</button>
      <button type="button" id="followNest" aria-pressed="${followed.has(nest.id)}">${tr(followed.has(nest.id)?'following':'follow')}</button>
      <button type="button" id="toggleQr">QR</button></div>
    <div id="nestQrPanel" class="nest-qr-panel" hidden><strong>${tr('qrTitle')}</strong><div id="nestQrCode" class="nest-qr-code"></div><p class="qr-hint">${safe(nest.id)} · ${safe(SITE.ORGANIZATION_NAME)}</p>
      <button class="btn btn-outline" type="button" id="downloadQr">${tr('downloadQr')} · SVG</button></div>`;
  $('nestDialog').showModal();
  $('shareNest').addEventListener('click',async()=>{
    const url = `${location.origin}${location.pathname}?nest=${encodeURIComponent(nest.id)}`;
    try {await navigator.clipboard.writeText(url);$('shareNest').textContent='Link copied!';} catch {prompt('Copy this nest URL:',url);}
  });
  $('followNest').addEventListener('click',()=>{
    if(followed.has(nest.id))followed.delete(nest.id);else followed.add(nest.id);
    rememberFollowing();$('followNest').textContent=tr(followed.has(nest.id)?'following':'follow');
    $('followNest').setAttribute('aria-pressed',String(followed.has(nest.id)));renderGrid();
  });
  const nestUrl=`${location.origin}${location.pathname}?nest=${encodeURIComponent(nest.id)}`;
  $('toggleQr').addEventListener('click',()=>{
    const panel=$('nestQrPanel');panel.hidden=!panel.hidden;
    if(!panel.hidden){try{$('nestQrCode').innerHTML=createQrSvg(nestUrl,5);}catch(e){$('nestQrCode').textContent=e.message;}}
  });
  $('downloadQr').addEventListener('click',()=>{
    try{
      const svg=createQrSvg(nestUrl,7),blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`TRACC-nest-${nest.id}-QR.svg`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){alert(`Unable to create QR code: ${e.message}`);}
  });
  if (updateHistory) history.replaceState(null,'',`${location.pathname}?nest=${encodeURIComponent(nest.id)}${location.hash}`);
}
function closeNest() { $('nestDialog').close(); if (new URL(location.href).searchParams.has('nest')) history.replaceState(null,'',`${location.pathname}${location.hash}`); }
function renderActivity() {
  const today=currentDate();
  const events=[];
  for(const n of allNests){
    for(const [field,label] of [['date_relocated','Nest relocated'],['emergence_date','Emergence observed'],['excavation_date','Nest excavated']]){
      const date=parseDate(n[field]);
      if(!date || date>today)continue;
      events.push({id:n.id,date:n[field],label,species:n.species});
    }
  }
  events.sort((a,b)=>b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  $('activityFeed').innerHTML = events.length ? events.slice(0,4).map(e => `<button class="activity-item" type="button" data-activity-nest="${safe(e.id)}"><span class="activity-date">${dateText(e.date)}</span><strong>${safe(e.label)}</strong><span>${safe(e.id)} · ${safe(e.species)}</span><span class="activity-arrow" aria-hidden="true">↗</span></button>`).join('') : '<p class="activity-empty">No dated milestones have been published yet.</p>';
}
function showSector(sector){
  const code=String(sector||'').trim().toUpperCase();
  const exact=sectorCodes.has(code);
  $('sectorSelected').innerHTML=`<span class="sector-selected-dot">◎</span><div><strong>${exact?`Sector ${safe(code)}`:safe(sector||'Sector not recorded')}</strong><span>${exact?'Locate this labelled beach sector on the supplied map. Exact nest coordinates are not published.':'This record uses a general location description; an exact sector code is not available.'}</span></div>`;
  $('sectors').scrollIntoView({behavior:'smooth',block:'start'});
}
function configureHeroArtwork(){
  if(!SITE.HERO_ART_URL)return;
  const host=$('heroArtwork');const img=document.createElement('img');img.src=SITE.HERO_ART_URL;img.alt='';img.className='hero-custom-art';
  img.addEventListener('error',()=>{host.replaceChildren(); host.textContent='Illustration unavailable. Check the image path in config.js.';});
  host.replaceChildren(img);
}
async function start() {
  $('demoBanner').hidden = !isDemo();
  configureHeroArtwork();
  initThemeToggle('themeSwitch');
  applyLanguage();
  $('languageSwitch').addEventListener('click',()=>{
    language=language==='en'?'ms':'en';saveStored('tracc_language',language);
    applyLanguage();if(allNests.length){renderStats();renderGrid();renderActivity();}
    if($('nestDialog')?.open){const id=new URL(location.href).searchParams.get('nest');const nest=allNests.find(n=>n.id===id);if(nest)showNest(nest,false);}
  });
  $('followedOnly').addEventListener('change',renderGrid);
  $('copyright').textContent = `© ${new Date().getFullYear()} TRACC · Hatchery Portal`;
  $('brandLogoLink').href=SITE.WEBSITE_URL;
  $('instagramLink').href=SITE.INSTAGRAM_URL;
  $('websiteLink').href=SITE.WEBSITE_URL;
  for (const id of ['nestSearch','seasonFilter','statusFilter','speciesFilter','sortNests']) $(id).addEventListener(id==='nestSearch'?'input':'change',renderGrid);
  for (const id of ['statSeasonFilter','statSpeciesFilter']) $(id).addEventListener('change',renderStats);
  $('clearFilters').addEventListener('click',resetFilters);$('emptyClear').addEventListener('click',resetFilters);
  $('activityFeed').addEventListener('click',event=>{const button=event.target.closest('[data-activity-nest]');if(!button)return;const nest=allNests.find(n=>n.id===button.dataset.activityNest);if(nest)showNest(nest);});
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
    output('resultCount','Records unavailable');
    output('dataLabel','Hatchery records temporarily unavailable');
  }
}
start();
