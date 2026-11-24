import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.js';
import {register} from '../server/auth.js';
import {changePlanner,initPlanner,plannerInfo,smsTick} from '../server/planner.js';
import {readDate,inputDate,monthLength} from '../public/components/calendar.js';
import {dueAlerts,eventsInMonth} from '../public/planner/dates.js';
import {initPush,syncPush} from '../server/push.js';

test('SMS slots are per account and reusable; alarm-only and push schedules exceed 250',async t=>{
  const db=openDb(':memory:');t.after(()=>db.close());initPlanner(db);initPush(db);
  const sms=async()=>{};
  for(const owner of ['a','b']){
    db.prepare('INSERT INTO users(id,name,email,password) VALUES (?,?,?,?)').run(owner,owner,owner+'@example.test','unused');
    db.prepare('INSERT INTO planner_contact(owner,phone) VALUES (?,?)').run(owner,'09120000000');
  }
  const save=(owner,id,enabled)=>changePlanner(db,owner,'save',{owner,entry:{
    id,name:id,kind:'personal',type:'custom',date:'2027-03-21',daysBefore:1,annual:true,sms:enabled
  }},sms);
  for(let i=0;i<10;i++)await save('a','sms-'+i,true);
  await save('a','sms-0',true);
  await assert.rejects(save('a','extra',true),{status:409,message:'SMS occasion limit reached'});
  await save('b','extra',true);
  await save('a','sms-0',false);
  await save('a','extra',true);
  await changePlanner(db,'a','delete',{owner:'a',id:'extra'},sms);
  await save('a','sms-0',true);
  for(let i=0;i<251;i++)await save('a','alarm-'+i,false);
  const options={endpoint:'https://web.push.apple.com/test-schedule',source:'account',time:'09:00',timeZone:'Asia/Tehran'};
  syncPush(db,'a',options);
  const events=JSON.parse(db.prepare('SELECT schedule FROM planner_push').get().schedule).events;
  assert.equal(events.length,261);
  assert.ok(events.every(e=>e.id!=='extra'));
  db.prepare("UPDATE planner_events SET entry=json_set(entry,'$.sms',json('true')) WHERE owner='a' AND id='alarm-0'").run();
  initPlanner(db);
  const migrated=plannerInfo(db,'a',sms).entries;
  assert.equal(migrated.length,261);
  assert.equal(migrated.filter(e=>e.sms).length,10);
});

test('Jalali inputs, leap Esfand, annual recurrence and Iranian lunar alignment',()=>{
  assert.equal(readDate('۱۴۰۵/۱/۱','persian'),'2026-03-21');
  assert.equal(readDate('١٤٠٤/١٢/٣٠','persian'),null);
  assert.equal(monthLength(1403,12,'persian'),30);
  assert.equal(inputDate('2025-03-20','persian'),'1403/12/30');
  const events=[{id:'a',kind:'personal',annual:true,date:'2024-03-20',daysBefore:1,calendar:'persian'}];
  assert.equal(dueAlerts({events,timeZone:'UTC',from:'2025-03-19',to:'2025-03-21'})[0].date,'2025-03-21');
  const rows=eventsInMonth({year:2026,month:3,region:'IR'}).filter(r=>r.date==='2026-03-21');
  assert.deepEqual(rows.map(r=>r.id),['ir-nowruz']);
  const fullYear=Array.from({length:13},(_,i)=>eventsInMonth({year:i<10?2026:2027,month:(i+2)%12+1,region:'IR'})).flat()
    .filter(r=>r.date>='2026-03-21'&&r.date<='2027-03-20');
  assert.deepEqual(new Set(fullYear.filter(r=>r.calendar==='Hijri').map(r=>r.name.fa)),
    new Set(['روز پدر','روز مادر','روز جوان','روز پرستار','روز جانباز','روز دختر']));
  assert.ok(fullYear.some(r=>r.name.fa==='روز پدر'&&r.date==='2026-12-23'));
  assert.ok(fullYear.some(r=>r.name.fa==='چهارشنبه‌سوری'&&r.date==='2027-03-16'));
  assert.ok(!fullYear.some(r=>r.calendar==='Gregorian'));
});

test('account isolation, verified opt-in and deduplicated scheduled SMS',async()=>{
  const db=openDb(':memory:');initPlanner(db);
  try{
    const {id}=await register(db,{name:'Planner',email:'planner@example.test',password:crypto.randomUUID()});
    const now=Date.parse('2026-09-01T09:00Z'), sent=[];
    const send=async(...args)=>sent.push(args);
    const change=(key,b)=>changePlanner(db,id,key,{owner:id,...b},send,now);
    const entry={id:'event',name:'test',kind:'occasion',type:'custom',date:'2026-09-05',daysBefore:1,annual:false,sms:true};
    await assert.rejects(change('save',{entry}),{status:409});
    await assert.rejects(change('save',{owner:'other',entry}),{status:403});
    await change('request-code',{phone:'۰۹۱۲۰۰۰۰۰۰۰'});await assert.rejects(change('request-code',{phone:'09120000000'}),{status:429});
    await assert.rejects(change('verify',{code:'000000'}),{status:400});
    await change('verify',{code:sent[0][2]});
    await change('save',{entry,time:'09:00',zone:'UTC'});
    assert.equal(plannerInfo(db,'other',send).entries.length,0);
    for(const day of [2,2,4])await smsTick(db,send,Date.parse('2026-09-0'+day+'T09:00:15Z'));
    assert.deepEqual(sent.slice(1).map(x=>x[2]),['3','1']);
    await change('delete',{id:'event'}); assert.equal(plannerInfo(db,id,send).entries.length,0);
  }finally{db.close();}
});
