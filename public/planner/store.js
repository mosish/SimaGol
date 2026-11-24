const storageKey = 'simagol.planner.v1';
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

export function validZone(zone) {
  try { return !!new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone; }
  catch { return false; }
}

export function validLink(link) {
  if (!link) return true;
  try { return ['http:','https:'].includes(new URL(link).protocol); }
  catch { return false; }
}

export function validEntry(entry) {
  return entry && ['personal','occasion'].includes(entry.kind) &&
    ['birthday','anniversary','custom'].includes(entry.type) && typeof entry.id === 'string' && !!entry.id &&
    typeof entry.name === 'string' && !!entry.name.trim() && entry.name.length <= 120 &&
    validDate(entry.date) && entry.date >= '1900-01-01' && entry.date <= '2100-12-31' &&
    typeof entry.annual === 'boolean' && Number.isSafeInteger(entry.daysBefore) &&
    entry.daysBefore >= 0 && entry.daysBefore <= 365 && validLink(entry.link);
}

export function newPlanner(now = new Date()) {
  return {
    version: 1, entries: [], inbox: [], lastCheck: now.toISOString(), time: '09:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran', region: 'IR', followZone: true
  };
}

export function loadPlanner(storage, now = new Date()) {
  const raw = storage.getItem(storageKey);
  if (raw === null) return newPlanner(now);
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries) || !value.entries.every(validEntry) ||
    !Array.isArray(value.inbox) || !value.inbox.every(x => x && typeof x.key === 'string' &&
      validDate(x.date) && Number.isFinite(Date.parse(x.dueAt))) || !validZone(value.timeZone) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) || !Number.isFinite(Date.parse(value.lastCheck)) ||
    !['IR','US','IN'].includes(value.region)) throw new Error('storageInvalid');
  return value;
}

export function savePlanner(storage, state) {
  storage.setItem(storageKey,JSON.stringify(state));
}

export function upsert(state, entry) {
  if (!validEntry(entry)) throw new Error('invalid');
  const found = state.entries.some(x => x.id === entry.id);
  const entries = found ? state.entries.map(x => x.id === entry.id ? entry : x) : [...state.entries,entry];
  return {...state,entries};
}

export function removeEntry(state,id) {
  return {...state, entries:state.entries.filter(x => x.id !== id), inbox:state.inbox.filter(x => x.id !== id)};
}

// Preserve read state when a time interval is replayed after resume or a clock adjustment.
export function collectAlerts(state, now, dueAlerts) {
  const to = now.toISOString();
  if (to <= state.lastCheck) return state;
  const alerts = dueAlerts({from:state.lastCheck,to,timeZone:state.timeZone,time:state.time,events:state.entries});
  const keys = new Set(state.inbox.map(a => a.key));
  const inbox = [...state.inbox];
  for (const a of alerts) {
    if (keys.has(a.key)) continue;
    keys.add(a.key);
    inbox.push({id:a.id,key:a.key,name:a.name,date:a.date,dueAt:a.dueAt,daysBefore:a.daysBefore,read:false});
  }
  return {...state,lastCheck:to,inbox:inbox.sort((a,b)=>b.dueAt.localeCompare(a.dueAt))};
}
