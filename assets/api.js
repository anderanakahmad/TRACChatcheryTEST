import { SITE } from './config.js';
import { readDemoStore } from './demo-store.js';

export const isLive = () => SITE.DATA_SOURCE === 'supabase';
export const isDemo = () => SITE.DATA_SOURCE === 'demo';
const base = () => String(SITE.SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = () => SITE.SUPABASE_PUBLISHABLE_KEY;
const basicHeaders = () => ({apikey: publicKey(), 'Content-Type': 'application/json'});
const sessionKey = 'tracc_hatchery_session';
const publicColumns = 'id,season,species,date_laid,date_relocated,egg_count,warden_public_name,expected_start,expected_end,status,hatch_date,emergence_date,excavation_date,hatched_eggs,emerged_hatchlings,released_hatchlings,notes_public,island_sector_found,mother_tag_left,mother_tag_right,mother_ccl_cm,mother_ccw_cm,mother_note_public,public_metadata,updated_at';

function checkSetup() {
  if (!base().startsWith('https://') || !/^(sb_publishable_|eyJ)/.test(publicKey() || '')) {
    throw Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in assets/config.js.');
  }
}
async function parseResponse(response) {
  const raw = await response.text(); let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* empty response */ }
  if (!response.ok) throw Error(body.message || body.error_description || body.msg || body.error || `Request failed (${response.status})`);
  return body;
}
export async function loadNests() {
  if (!isLive()) {
    const saved = isDemo() ? readDemoStore() : null;
    const file = SITE.DATA_SOURCE === 'json' ? SITE.DATA_FILE : SITE.DEMO_FILE;
    try {
      const response = await fetch(file, {cache:'no-store'});
      if (!response.ok) throw Error(`Cannot load ${file}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error('Expected a JSON array of approved nests.');
      // Refresh the shared fictional seed set without losing locally approved test records.
      // Stored records take precedence when an ID has already been edited in this browser.
      const merged = new Map(rows.filter(n => n.published === true).map(n => [n.id,n]));
      const locallyChanged=new Set([...((saved?.audit)||[]).map(a=>a.nest_id),...((saved?.submissions)||[]).filter(q=>q.review_state==='approved').map(q=>q.nest_id)]);
      if(saved) for(const n of saved.approved) if(n.published===true && (!merged.has(n.id)||locallyChanged.has(n.id)||n.updated_at!==merged.get(n.id).updated_at)) merged.set(n.id,n);
      return [...merged.values()];
    } catch(error) {
      if(saved) return saved.approved.filter(n => n.published===true);
      throw error;
    }
  }
  checkSetup();
  // Table contains approved records only; drafts are stored separately and inaccessible anonymously.
  const pageSize=500, rows=[];
  for(let offset=0;offset<200000;offset+=pageSize) {
    const res=await fetch(`${base()}/rest/v1/nests?select=${publicColumns}&order=date_relocated.desc&limit=${pageSize}&offset=${offset}`,
      {headers:basicHeaders(),cache:'no-store'});
    const page=await parseResponse(res);rows.push(...page);
    if(page.length<pageSize)return rows;
  }
  throw Error('Too many nest records; increase the pagination safety limit.');
}
export function getSession() { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } }
function saveSession(value) { sessionStorage.setItem(sessionKey,JSON.stringify(value));return value; }
export async function signIn(email, password) {
  checkSetup();
  const r=await fetch(`${base()}/auth/v1/token?grant_type=password`,{method:'POST',headers:basicHeaders(),body:JSON.stringify({email,password})});
  return saveSession(await parseResponse(r));
}
async function refreshSession() {
  const s=getSession(); if(!s?.refresh_token)throw Error('Sign in again: session expired.');
  const r=await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:basicHeaders(),body:JSON.stringify({refresh_token:s.refresh_token})});
  return saveSession(await parseResponse(r));
}
export async function signOut() {
  const s=getSession();
  if(s?.access_token && isLive())await fetch(`${base()}/auth/v1/logout`,{method:'POST',headers:{...basicHeaders(),Authorization:`Bearer ${s.access_token}`}}).catch(()=>{});
  sessionStorage.removeItem(sessionKey);
}
export async function staffRequest(method, path, body) {
  checkSetup();let s=getSession();if(!s?.access_token)throw Error('Sign in required.');
  const request=token=>fetch(`${base()}/rest/v1/${path}`,{
    method,headers:{...basicHeaders(),Authorization:`Bearer ${token}`,Prefer:'return=representation'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let r=await request(s.access_token);
  if(r.status===401){s=await refreshSession();r=await request(s.access_token);}
  return parseResponse(r);
}
export async function getStaffProfile() {
  const uid=getSession()?.user?.id; if(!uid)throw Error('Sign in required.');
  const rows=await staffRequest('GET',`staff_profiles?select=user_id,role,display_name&user_id=eq.${encodeURIComponent(uid)}`);
  if(!Array.isArray(rows)||!rows[0]||!['warden','admin'].includes(rows[0].role))throw Error('This account has no staff access. Contact the administrator.');
  return rows[0];
}
async function pagedStaff(table, order) {
  const result=[],size=500;
  for(let offset=0;offset<200000;offset+=size) {
    const page=await staffRequest('GET',`${table}?select=*&order=${order}&limit=${size}&offset=${offset}`);
    result.push(...page);if(page.length<size)return result;
  }
  throw Error('Too many staff records; increase pagination safety limit.');
}
export const loadApprovedStaffNests = () => isLive() ? pagedStaff('nests','date_relocated.desc') : loadNests();
export const loadSubmissions = () => pagedStaff('nest_submissions','submitted_at.desc');
export const submitNest = (nestId, payload, researchPayload, baseUpdatedAt, submissionType='new_nest', supersedesId=null) => staffRequest('POST','nest_submissions',{
  nest_id:nestId,payload,research_payload:researchPayload,base_updated_at:baseUpdatedAt || null,
  submission_type:submissionType, supersedes_submission_id:supersedesId
});
export const reviewSubmission = (submissionId, action, note='') => staffRequest('POST','rpc/tracc_decide_submission',{
  p_submission_id:submissionId,p_action:action,p_review_note:note || null
});

// RLS permits these queries for administrators only. Never call them for wardens.
export const loadResearch = () => pagedStaff('nest_research','nest_id.asc');
export const loadAudit = () => pagedStaff('nest_audit','approved_at.desc');
