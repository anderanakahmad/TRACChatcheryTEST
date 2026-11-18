/** Pure rules shared by staff forms and test cases. Database independently enforces these. */
export const validStatuses = ['incubating','emerged','excavated'];
export const milestonePublicFields = new Set(['status','hatch_date','emergence_date','excavation_date',
  'hatched_eggs','emerged_hatchlings','released_hatchlings','notes_public']);
export const milestonePrivateFields = new Set(['healthy_hatchlings','deformed_hatchlings','dead_hatchlings',
  'total_excavated','undeveloped_eggs','dead_egg_stage1','dead_egg_stage2',
  'dead_egg_stage3','attacked_eggs','hatching_method','hatching_time','private_notes']);
export function canSubmitType(role, kind) {
  return role==='admin' || (role==='warden' && ['new_nest','milestone'].includes(kind));
}
export function canSeeProtected(role) {return role==='admin';}
export function canEditPublished(role){return role==='admin';}
export function checkBasicNest(n) {
  if(!/^[A-Z0-9_-]{1,40}$/.test(String(n.id||'')))throw Error('Use a valid nest ID (A–Z, 0–9, hyphen or underscore).');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(n.date_relocated||'')))throw Error('Relocation date is required.');
  if(Number(n.season)!==Number(n.date_relocated.slice(0,4)))throw Error('Season must match the relocation calendar year.');
  if(!Number.isInteger(Number(n.egg_count))||Number(n.egg_count)<1)throw Error('Egg count must be a positive whole number.');
  if(!['Green turtle','Hawksbill turtle','Olive ridley turtle','Other / unconfirmed'].includes(n.species))throw Error('Select a recognized turtle species.');
  return n;
}
export function checkMilestone(nest, proposedPublic, proposedPrivate={}) {
  if(!nest?.id)throw Error('Select a previously approved nest.');
  if(!proposedPublic||!Object.keys(proposedPublic).length)throw Error('Enter an observation first.');
  for(const key of Object.keys(proposedPublic))if(!milestonePublicFields.has(key))throw Error(`Milestones cannot change ${key}.`);
  for(const key of Object.keys(proposedPrivate))if(!milestonePrivateFields.has(key))throw Error(`Private field ${key} is not a milestone field.`);
  const next=proposedPublic.status ?? nest.status;
  if(!validStatuses.includes(next))throw Error('Choose a recognized hatchery status.');
  if(nest.status==='excavated' && next!=='excavated')throw Error('An excavated nest cannot revert to an earlier status.');
  if(nest.status==='emerged' && next==='incubating')throw Error('An emerged nest cannot revert to incubating.');
  const a=proposedPrivate.healthy_hatchlings,b=proposedPrivate.deformed_hatchlings;
  if((a===null||a===undefined)!==(b===null||b===undefined))throw Error('Provide both healthy and deformed released counts, including zero where applicable.');
  if(a!==null && a!==undefined){
    if(!Number.isInteger(a)||a<0||!Number.isInteger(b)||b<0)throw Error('Release counts must be non-negative whole numbers.');
    if(proposedPublic.released_hatchlings!==a+b)throw Error('Release total must equal healthy + deformed hatchlings.');
  }
  if(next==='incubating' && (proposedPublic.released_hatchlings??0)>0)throw Error('Released hatchlings require emerged or excavated status.');
  if(next==='excavated' && !(proposedPublic.excavation_date || nest.excavation_date))throw Error('Excavated status requires an excavation date.');
  for(const k of ['released_hatchlings','hatched_eggs','emerged_hatchlings']){
    const v=proposedPublic[k]; if(v!==undefined && v!==null && (!Number.isInteger(v)||v<0||v>nest.egg_count))throw Error(`${k} must be between zero and eggs relocated.`);
  }
  return {publicDelta:proposedPublic,researchDelta:proposedPrivate};
}
export function applyMilestone(nest, research={}, submission) {
  const {publicDelta,researchDelta}=checkMilestone(nest,submission.payload,submission.research_payload||{});
  return {publicRecord:{...nest,...publicDelta},privateRecord:{...research,...researchDelta}};
}
