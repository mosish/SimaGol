import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transaction } from './db.js';
import { dueAlerts, HOLIDAYS } from '../public/planner/dates.js';

const DAY = 86400000;
const holidayIds = new Set(HOLIDAYS.map(h => h.id));
const fail = (status=400, message='Invalid reminder settings') => {
  throw Object.assign(new Error(message),{status});
};

export function pushCredentials(pem,subject) {
  if (!/^mailto:[^\s@]+@[^\s@]+$/.test(subject) && !/^https:\/\/[^\s]+$/.test(subject))
    throw new Error('Configure a valid VAPID_SUBJECT contact');
  const key=createPrivateKey(pem);
  const jwk=key.export({format:'jwk'});
  if (jwk.kty!=='EC' || jwk.crv!=='P-256') throw new Error('Expected a P-256 VAPID key');
  const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
  return {key,publicKey,subject};
}

export function loadPushCredentials(dir,env=process.env) {
  if (!env.VAPID_SUBJECT) return null;
  return pushCredentials(readFileSync(join(dir,'vapid-private.pem')),env.VAPID_SUBJECT);
}

function endpointOf(value) {
  if (typeof value!=='string' || value.length>2048) fail();
  let url;
  try {url=new URL(value);} catch {fail();}
  const host=url.hostname;
  const allowed=['web.push.apple.com','updates.push.services.mozilla.com','fcm.googleapis.com'].includes(host) ||
    /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  if (url.protocol!=='https:' || !allowed || url.port || url.username || url.password || url.hash || url.pathname==='/') fail();
  return url.href;
}

function schedule(body) {
  if (!Array.isArray(body.events) || body.events.length>250 || typeof body.timeZone!=='string' ||
      body.timeZone.length>80 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) fail();
  try {new Intl.DateTimeFormat('en',{timeZone:body.timeZone});} catch {fail();}
  const seen=new Set();
  const events=body.events.map(event=>{
    if (!event || !/^[a-z0-9_-]{1,90}$/i.test(event.id) || typeof event.id!=='string' || seen.has(event.id) ||
        !['personal','occasion'].includes(event.kind) || typeof event.annual!=='boolean' ||
        !Number.isInteger(event.daysBefore) || event.daysBefore<0 || event.daysBefore>365 ||
        typeof event.date!=='string' || !/^\d{4}-\d\d-\d\d$/.test(event.date) ||
        !Number.isFinite(Date.parse(event.date)) || new Date(event.date).toISOString().slice(0,10)!==event.date ||
        event.date<'1900-01-01' || event.date>'2100-12-31' ||
        (event.holidayId && !holidayIds.has(event.holidayId))) fail();
    seen.add(event.id);
    const {id,kind,date,annual,daysBefore,holidayId}=event;
    return {id,kind,date,annual,daysBefore,...(holidayId?{holidayId}:{})};
  });
  return JSON.stringify({time:body.time,timeZone:body.timeZone,events});
}

export function initPush(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS planner_push (
    endpoint TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule TEXT NOT NULL, cursor INTEGER NOT NULL, retryAt INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE INDEX IF NOT EXISTS planner_push_owner ON planner_push(owner);
    CREATE TABLE IF NOT EXISTS planner_sent (
      endpoint TEXT NOT NULL REFERENCES planner_push(endpoint) ON DELETE CASCADE,
      occurrence TEXT NOT NULL, sentAt INTEGER NOT NULL, PRIMARY KEY(endpoint,occurrence)) STRICT;`);
}

export function syncPush(db,userId,body,now=Date.now()) {
  const endpoint=endpointOf(body.endpoint), json=schedule(body);
  return transaction(db,()=>{
    const existing=db.prepare('SELECT owner,schedule FROM planner_push WHERE endpoint=?').get(endpoint);
    if (existing && existing.owner!==userId) fail(409,'Device belongs to another account');
    if (!existing && db.prepare('SELECT count(*) AS n FROM planner_push WHERE owner=?').get(userId).n>=10)
      fail(429,'Device limit reached');
    if (!existing) db.prepare('INSERT INTO planner_push(endpoint,owner,schedule,cursor) VALUES (?,?,?,?)').run(endpoint,userId,json,now);
    else if (json!==existing.schedule) db.prepare('UPDATE planner_push SET schedule=?,failures=0,retryAt=0 WHERE endpoint=?').run(json,endpoint);
    return {ok:true};
  });
}
export function deletePush(db,userId,body) {
  db.prepare('DELETE FROM planner_push WHERE endpoint=? AND owner=?').run(endpointOf(body.endpoint),userId);
  return {ok:true};
}
export async function sendWake(endpoint,credentials,topic,now=Date.now(),post=fetch) {
  const url=new URL(endpointOf(endpoint));
  const part=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const token=part({typ:'JWT',alg:'ES256'})+'.'+part({aud:url.origin,exp:Math.floor(now/1000)+3600,sub:credentials.subject});
  const sig=sign('sha256',Buffer.from(token),{key:credentials.key,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const res=await post(url.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{authorization:'vapid t='+token+'.'+sig+', k='+credentials.publicKey,TTL:'3600',Topic:topic,Urgency:'normal'}});
  const retry=res.headers.get('retry-after');
  await res.body?.cancel();
  const retryMs=!retry?0:/^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry)-now;
  return {status:res.status,retryMs:Number.isFinite(retryMs)?retryMs:0};
}

export async function pushTick(db,credentials,now=Date.now(),send=sendWake) {
  db.prepare('DELETE FROM planner_sent WHERE sentAt<?').run(now-2*DAY);
  // One process owns this SQLite volume. The oldest cursors get priority after a restart.
  const rows=db.prepare('SELECT * FROM planner_push WHERE retryAt<=? AND cursor<? ORDER BY cursor LIMIT 128').all(now,now);
  for (const row of rows) {
    const fresh=db.prepare('SELECT schedule FROM planner_push WHERE endpoint=?').get(row.endpoint);
    if (fresh?.schedule!==row.schedule) continue;
    const alerts=dueAlerts({...JSON.parse(row.schedule),from:Math.max(now-DAY,row.cursor),to:now});
    const missing=alerts.filter(a=>!db.prepare('SELECT 1 FROM planner_sent WHERE endpoint=? AND occurrence=?').get(row.endpoint,a.key));
    if (!missing.length) {
      db.prepare('UPDATE planner_push SET cursor=? WHERE endpoint=?').run(now,row.endpoint);
      continue;
    }
    const topic=createHash('sha256').update(missing.map(a=>a.key).sort().join('|')).digest('base64url').slice(0,32);
    let result;
    try { result=await send(row.endpoint,credentials,topic,now); } catch { result={status:0}; }
    transaction(db,()=>{
      const current=db.prepare('SELECT owner,schedule FROM planner_push WHERE endpoint=?').get(row.endpoint);
      if (!current || current.owner!==row.owner) return;
      if (result.status===404 || result.status===410) {
        db.prepare('DELETE FROM planner_push WHERE endpoint=?').run(row.endpoint);
      } else if (result.status>=200 && result.status<300) {
        const record=db.prepare('INSERT OR IGNORE INTO planner_sent VALUES (?,?,?)');
        for (const alert of missing) record.run(row.endpoint,alert.key,now);
        db.prepare('UPDATE planner_push SET cursor=?,retryAt=0,failures=0 WHERE endpoint=? AND schedule=?')
          .run(now,row.endpoint,row.schedule);
      } else {
        const backoff=30000*2**Math.min(8,row.failures);
        const delay=Math.min(DAY,Math.max(backoff,result.retryMs||0));
        db.prepare('UPDATE planner_push SET retryAt=?,failures=failures+1 WHERE endpoint=?').run(now+delay,row.endpoint);
      }
    });
  }
}

export function startPushScheduler(db,credentials) {
  let active;
  function tick() {
    if (!credentials || active) return;
    active=pushTick(db,credentials).catch(()=>console.error('Planner push scheduler failed')).finally(()=>{active=null;});
  }
  tick();
  const timer=setInterval(tick,30000);
  timer.unref();
  return async ()=>{clearInterval(timer);await active;};
}
