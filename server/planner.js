import {randomInt,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {validEntry,validZone} from '../public/planner/store.js';
import {dueAlerts,HOLIDAYS} from '../public/planner/dates.js';

const ids=new Set(HOLIDAYS.map(h=>h.id));
const minute=60000;
function fail(status,message){throw Object.assign(new Error(message),{status});}
export function initPlanner(db){
  db.exec(`CREATE TABLE IF NOT EXISTS planner_events(owner TEXT REFERENCES users(id) ON DELETE CASCADE,id TEXT,entry TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(owner,id));
  CREATE TABLE IF NOT EXISTS planner_contact(owner TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, phone TEXT, pending TEXT, challenge TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, lastCode INTEGER DEFAULT 0, time TEXT DEFAULT '09:00', zone TEXT DEFAULT 'Asia/Tehran');
  CREATE TABLE IF NOT EXISTS sms_attempts(owner TEXT,phone TEXT,at INTEGER);
  CREATE TABLE IF NOT EXISTS planner_sms_sent(owner TEXT,occurrence TEXT,at INTEGER,state TEXT,PRIMARY KEY(owner,occurrence));`);
}
export function smsProvider(env=process.env){
  if(!env.KAVENEGAR_API_KEY||!env.SMS_OTP_TEMPLATE||!env.SMS_REMINDER_TEMPLATE)return null;
  return async(phone,kind,token)=>{
    const res=await fetch('https://api.kavenegar.com/v1/'+encodeURIComponent(env.KAVENEGAR_API_KEY)+'/verify/lookup.json',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),body:new URLSearchParams({receptor:phone,template:kind==='code'?env.SMS_OTP_TEMPLATE:env.SMS_REMINDER_TEMPLATE,token})
    });
    const data=await res.json();if(!res.ok||data.return?.status!==200)throw new Error('SMS provider rejected request');
  };
}
const entries=(db,user)=>db.prepare('SELECT entry FROM planner_events WHERE owner=? ORDER BY id').all(user).map(row=>JSON.parse(row.entry));
export function plannerInfo(db,user,sms){
  const c=db.prepare('SELECT phone,time,zone FROM planner_contact WHERE owner=?').get(user)||{};
  return {owner:user,entries:entries(db,user),smsAvailable:Boolean(sms),verifiedPhone:c.phone||'',time:c.time,zone:c.zone};
}
function phoneOf(value){
  const v=String(value||'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/^\+98/,'0');
  if(!/^09\d{9}$/.test(v))fail(400,'Invalid mobile number');return v;
}
export async function changePlanner(db,user,action,b,sms,now=Date.now()){
  if(b.owner!==user)fail(403,'Account changed');
  db.prepare('INSERT OR IGNORE INTO planner_contact(owner) VALUES (?)').run(user);
  const c=db.prepare('SELECT * FROM planner_contact WHERE owner=?').get(user);
  if(action==='save'){
    const e=b.entry;
    if(!validEntry(e)||!/^[a-zA-Z0-9_-]{1,90}$/.test(e.id)||(e.holidayId&&!ids.has(e.holidayId))||
       ![undefined,'persian','gregory'].includes(e.calendar)||
       (e.sms!==undefined&&typeof e.sms!=='boolean')||
       ['recipient','notes','link'].some(k=>typeof (e[k]??'')!=='string'||(e[k]||'').length>(k==='notes'?1000:k==='link'?2048:140)))fail(400,'Invalid reminder');
    if(e.sms&&(!c.phone||!sms))fail(409,'Verify a mobile number first');
    if(!db.prepare('SELECT 1 FROM planner_events WHERE owner=? AND id=?').get(user,e.id)&&entries(db,user).length>=250)fail(409,'Reminder limit reached');
    if(typeof b.zone==='string' && validZone(b.zone) && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time))db.prepare('UPDATE planner_contact SET time=?,zone=? WHERE owner=?').run(b.time,b.zone,user);
    db.prepare('INSERT INTO planner_events VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET entry=excluded.entry,updated=excluded.updated').run(user,e.id,JSON.stringify(e),now);
  }else if(action==='delete'){
    if(typeof b.id!=='string')fail(400,'Invalid reminder');db.prepare('DELETE FROM planner_events WHERE owner=? AND id=?').run(user,b.id);
  }else if(action==='settings'){
    if(typeof b.zone!=='string'||!validZone(b.zone)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time))fail(400,'Invalid reminder settings');
    db.prepare('UPDATE planner_contact SET time=?,zone=? WHERE owner=?').run(b.time,b.zone,user);
  }else if(action==='request-code'){
    if(!sms)fail(503,'SMS unavailable');const phone=phoneOf(b.phone);
    db.prepare('DELETE FROM sms_attempts WHERE at<?').run(now-86400000);
    const attempts=db.prepare('SELECT COUNT(*) AS n FROM sms_attempts WHERE owner=? OR phone=?').get(user,phone).n;
    if(now-c.lastCode<minute || attempts>=5 || db.prepare('SELECT COUNT(*) AS n FROM sms_attempts').get().n>=100)fail(429,'Please try again later');
    const code=String(randomInt(100000,1000000)),salt=randomBytes(16).toString('hex');
    db.prepare('INSERT INTO sms_attempts VALUES(?,?,?)').run(user,phone,now);
    db.prepare('UPDATE planner_contact SET pending=?,challenge=?,expires=?,attempts=0,lastCode=? WHERE owner=?').run(phone,salt+':'+scryptSync(code,salt,32).toString('hex'),now+5*minute,now,user);
    try{await sms(phone,'code',code);}catch{fail(503,'SMS unavailable');}
  }else if(action==='verify'){
    if(!sms||!c.challenge||c.expires<now||c.attempts>=5||typeof b.code!=='string'||!/^\d{6}$/.test(b.code))fail(400,'Invalid verification code');
    const [salt,hash]=c.challenge.split(':');
    db.prepare('UPDATE planner_contact SET attempts=attempts+1 WHERE owner=?').run(user);
    if(!timingSafeEqual(scryptSync(b.code,salt,32),Buffer.from(hash,'hex')))fail(400,'Invalid verification code');
    db.prepare('UPDATE planner_contact SET phone=pending,pending=NULL,challenge=NULL WHERE owner=?').run(user);
  }else fail(404,'Page not found');
  return plannerInfo(db,user,sms);
}
export async function smsTick(db,sms,now=Date.now()){
  if(!sms)return;
  db.prepare('DELETE FROM planner_sms_sent WHERE at<?').run(now-7*86400000);
  const records=db.prepare("SELECT e.*,c.phone,c.time,c.zone FROM planner_events e JOIN planner_contact c USING(owner) WHERE json_extract(entry,'$.sms')=1 AND c.phone IS NOT NULL").all();
  for(const r of records){
    for(const a of dueAlerts({events:[JSON.parse(r.entry)],from:Math.max(r.updated,now-3600000),to:now,time:r.time,timeZone:r.zone})){
      const current=db.prepare('SELECT e.entry,e.updated,c.time,c.zone,c.phone FROM planner_events e JOIN planner_contact c USING(owner) WHERE owner=? AND id=?').get(r.owner,r.id);
      if(!current||current.updated!==r.updated||current.entry!==r.entry||current.phone!==r.phone||current.zone!==r.zone||current.time!==r.time)continue;
      if(!db.prepare('INSERT OR IGNORE INTO planner_sms_sent VALUES(?,?,?,?)').run(r.owner,a.key,now,'pending').changes)continue;
      let result='sent';try{await sms(r.phone,'reminder',String(a.daysBefore));}catch{result='unconfirmed';console.error('Reminder SMS delivery unconfirmed');}
      db.prepare('UPDATE planner_sms_sent SET state=? WHERE owner=? AND occurrence=?').run(result,r.owner,a.key);
    }
  }
}
