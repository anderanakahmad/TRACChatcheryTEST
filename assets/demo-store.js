/* Demonstration ONLY: this is browser-local storage, never an authentication or multi-device database. */
const KEY = 'tracc_field_test_demo_v1';
export function readDemoStore(){
 try {
  if (typeof localStorage === 'undefined') return null;
  const state=JSON.parse(localStorage.getItem(KEY) || 'null');
  if(state && state.version===1 && Array.isArray(state.approved) && Array.isArray(state.submissions) && Array.isArray(state.research) && Array.isArray(state.audit))return state;
 } catch(_){}
 return null;
}
export function writeDemoStore(state){
 if (typeof localStorage === 'undefined') return;
 try { localStorage.setItem(KEY, JSON.stringify({version:1,approved:state.approved,submissions:state.submissions,research:state.research,audit:state.audit})); }
 catch(error){ console.warn('Demo-only device state could not be saved:', error); }
}
export function clearDemoStore(){ if (typeof localStorage === 'undefined') return; try{localStorage.removeItem(KEY)}catch(_){} }
