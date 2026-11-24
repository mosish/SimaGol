const dayMs=86400000;
const solar=new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
const starts=new Map();
export function calendarSystem() {
  try {return localStorage.getItem('simagol.calendar')==='gregory'?'gregory':'persian';}catch{return 'persian';}
}
export function dateLocale(lang,system=calendarSystem()) { return (lang==='fa'?'fa-IR':'en-US')+'-u-ca-'+system; }
export function addDays(iso,days) {return new Date(Date.parse(iso)+days*dayMs).toISOString().slice(0,10);}
export function calendarParts(iso,system=calendarSystem()) {
  if(system==='gregory') return iso.split('-').map(Number);
  const parts=Object.fromEntries(solar.formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  return [Number(parts.year),Number(parts.month),Number(parts.day)];
}
function nowruz(year) {
  if(!starts.has(year)){
    let date=(year+621)+'-03-18';
    while(calendarParts(date,'persian')[2]!==1) date=addDays(date,1);
    starts.set(year,date);
  }
  return starts.get(year);
}
export function monthStart(y,m,system) {
  if(system==='gregory')return new Date(Date.UTC(y,m-1,1)).toISOString().slice(0,10);
  y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12;
  return addDays(nowruz(y),Math.min(m,6)*31+Math.max(m-6,0)*30);
}
export function monthLength(y,m,system) {
  return (Date.parse(monthStart(y,m+1,system))-Date.parse(monthStart(y,m,system)))/dayMs;
}
export function inputDate(iso,system=calendarSystem()) {
  return iso?calendarParts(iso,system).map((n,i)=>String(n).padStart(i?2:4,'0')).join('/'):'';
}
export function readDate(value,system=calendarSystem()) {
  const digits=value.trim().replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
  if(!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(digits)) return null;
  const [y,m,d]=digits.split(/[-/]/).map(Number);
  if(y<(system==='persian'?1278:1900)||y>(system==='persian'?1480:2100)||m<1||m>12||d<1||d>monthLength(y,m,system))return null;
  const iso=addDays(monthStart(y,m,system),d-1);
  return iso>='1900-01-01' && iso<='2100-12-31'?iso:null;
}
