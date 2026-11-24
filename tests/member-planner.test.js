import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb} from '../server/db.js';
import {register} from '../server/auth.js';
import {changePlanner,initPlanner,plannerInfo,smsTick} from '../server/planner.js';
import {readDate,inputDate,monthLength} from '../public/components/calendar.js';
import {dueAlerts,eventsInMonth} from '../public/planner/dates.js';

test('Jalali inputs, leap Esfand, annual recurrence and Iranian lunar alignment',()=>{
  assert.equal(readDate('۱۴۰۵/۱/۱','persian'),'2026-03-21');
  assert.equal(readDate('١٤٠٤/١٢/٣٠','persian'),null);
  assert.equal(monthLength(1403,12,'persian'),30);
  assert.equal(inputDate('2025-03-20','persian'),'1403/12/30');
  const events=[{id:'a',kind:'personal',annual:true,date:'2024-03-20',daysBefore:1,calendar:'persian'}];
  assert.equal(dueAlerts({events,timeZone:'UTC',from:'2025-03-19',to:'2025-03-21'})[0].date,'2025-03-21');
  const rows=eventsInMonth({year:2026,month:3,region:'IR'}).filter(r=>r.date==='2026-03-21');
  assert.ok(rows.some(r=>r.id==='ir-nowruz')&&rows.some(r=>r.calendar==='Hijri'&&r.holiday));
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
