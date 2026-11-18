/** Visitor-only phase calculations. Never change a scientifically observed status here. */
export const EMERGENCE_WINDOW_START_DAY = 50;
export const EMERGENCE_WINDOW_END_DAY = 60;
function isoDay(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y,m,d]=iso.split('-').map(Number);
  const utc=Date.UTC(y,m-1,d),date=new Date(utc);
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? utc : null;
}
export function daysSinceRelocation(nest, today=new Date()) {
  const from=isoDay(nest?.date_relocated);
  if(from===null || !(today instanceof Date) || Number.isNaN(today.getTime()))return null;
  const to=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  return Math.floor((to-from)/86400000);
}
/** Incubating is the persisted status; phase is a display-only classification. */
export function displayPhase(nest, today=new Date()) {
  if(['emerged','excavated'].includes(nest?.status))return nest.status;
  if(nest?.status!=='incubating')return 'incubating';
  const days=daysSinceRelocation(nest,today);
  if(days!==null && days>EMERGENCE_WINDOW_END_DAY)return 'awaiting_update';
  if(days!==null && days>=EMERGENCE_WINDOW_START_DAY && days<=EMERGENCE_WINDOW_END_DAY)return 'emergence_soon';
  return 'incubating';
}
