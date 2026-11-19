/** Pure rules shared by staff forms and test cases. Database independently enforces these. */
export const validStatuses = ['incubating','emerged','excavated'];
export const milestonePublicFields = new Set(['status','hatch_date','emergence_date','excavation_date',
  'hatched_eggs','emerged_hatchlings','released_hatchlings','notes_public']);
export const milestonePrivateFields = new Set(['healthy_hatchlings','deformed_hatchlings','dead_hatchlings',
  'total_excavated','undeveloped_eggs','dead_egg_stage1','dead_egg_stage2',
  'dead_egg_stage3','excavation_hatchlings','unsure_eggs','attacked_eggs','hatching_method','hatching_time','private_notes']);
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
export const excavationKeys = ["excavation_hatchlings","undeveloped_eggs","dead_egg_stage1","dead_egg_stage2","dead_egg_stage3","dead_hatchlings","unsure_eggs"];
const known = v => v !== null && v !== undefined;
const count = v => Number.isInteger(v) && v >= 0;
export function validateExcavation(record, data, requireAll=false) {
  const any=excavationKeys.some(k=>known(data[k]));
  if(!any && !requireAll)return;
  if(record.status!=='excavated' || !record.excavation_date)throw Error('Enter excavation outcomes only with Excavated status and an excavation date.');
  if(!excavationKeys.every(k=>count(data[k])))throw Error('Enter all seven excavation counts as whole numbers (0 for confirmed none).');
  const unhatched=['undeveloped_eggs','dead_egg_stage1','dead_egg_stage2','dead_egg_stage3','unsure_eggs'].reduce((s,k)=>s+data[k],0);
  const recovered=data.excavation_hatchlings,dead=data.dead_hatchlings;
  if(unhatched+recovered+dead>record.egg_count)throw Error('Excavation outcomes exceed relocated eggs.');
  if(known(record.hatched_eggs)){
    if(unhatched+record.hatched_eggs>record.egg_count)throw Error('Confirmed hatched eggs plus unhatched egg categories exceed eggs relocated.');
    if(recovered+dead+(record.emerged_hatchlings??0)>record.hatched_eggs)throw Error('Emerged and excavation hatchlings exceed confirmed hatched eggs.');
    if(known(record.released_hatchlings)&&record.released_hatchlings>record.hatched_eggs)throw Error('Released hatchlings exceed confirmed hatched eggs.');
  }
}
export function calculateRelease(data, previous=null, previousResearch={}, milestone=false) {
  const a=data.healthy_hatchlings,b=data.deformed_hatchlings,recovered=data.excavation_hatchlings;
  if(known(a)!==known(b))throw Error('Enter both healthy and deformed release counts, or leave both blank.');
  if(known(a)&&(!count(a)||!count(b)))throw Error('Release counts must be non-negative whole numbers.');
  if(known(recovered)&&!count(recovered))throw Error('Excavation hatchlings must be a non-negative whole number.');
  if(milestone && previous?.status==='excavated' && (known(a)||known(recovered))){
    if(!known(a)||!known(recovered))throw Error('For an already excavated nest, enter cumulative pre-excavation release counts and all excavation outcomes, or request an administrator correction. Do not add a second excavation release to the previous total.');
  }
  if(known(a))return a+b+(known(recovered)?recovered:0);
  if(known(recovered)){
    if(known(previous?.released_hatchlings)){
      if(previous.status==='excavated'){
        if(!known(previousResearch.excavation_hatchlings))throw Error('Enter both original release categories to recalculate an already excavated nest.');
        return previous.released_hatchlings-previousResearch.excavation_hatchlings+recovered;
      }
      return previous.released_hatchlings+recovered;
    }
    if(recovered>0)throw Error('Enter both pre-excavation release counts (use 0 if confirmed none) before adding recovered hatchlings.');
  }
  return previous?.released_hatchlings??null;
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
  const changesRelease=['healthy_hatchlings','deformed_hatchlings','excavation_hatchlings'].some(k=>known(proposedPrivate[k]));
  if(changesRelease){
    const total=calculateRelease(proposedPrivate,nest,{},true);
    if(total!==null && proposedPublic.released_hatchlings!==total)throw Error('Release total must equal cumulative pre-excavation releases plus recovered hatchlings.');
    if(total===null && known(proposedPublic.released_hatchlings))throw Error('Release total is unknown.');
  }else if(known(proposedPublic.released_hatchlings))throw Error('Enter release categories before changing the total.');
  validateExcavation({...nest,...proposedPublic},proposedPrivate,next==='excavated' && nest.status!=='excavated');
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
