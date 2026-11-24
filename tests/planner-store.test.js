import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPlanner, savePlanner, loadPlanner, collectAlerts, upsert, removeEntry, validLink } from '../public/planner/store.js';
import { dueAlerts } from '../public/planner/dates.js';

const birthday = {
  id:'b1', kind:'personal',type:'birthday',name:'Alex',date:'2020-02-04',
  annual:true,daysBefore:2,recipient:'Family',link:'https://example.org/',notes:''
};
function memory() {
  const data = new Map();
  return { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v) };
}

test('persist and edit personal and custom flower-order occasions',()=>{
  const storage=memory();
  let state=loadPlanner(storage,new Date('2026-01-01T12:00Z'));
  state=upsert(state,birthday);
  const updated={...birthday,name:'Updated'};
  state=upsert(state,updated);
  const custom={...birthday,id:'custom',kind:'occasion',type:'custom',annual:false};
  state=upsert(state,custom);
  savePlanner(storage,state);
  assert.deepEqual(loadPlanner(storage).entries,[updated,custom]);
  assert.deepEqual(removeEntry(state,birthday.id).entries,[custom]);
  assert.throws(()=>upsert(state,{...birthday,date:'2026-02-31'}));
  assert.throws(()=>upsert(state,{...birthday,daysBefore:-1}));
  assert.equal(validLink('javascript:alert(1)'),false);
});

test('late opening catches reminder once and preserves its read state across subsequent scans',()=>{
  const start=new Date('2026-02-01T00:00Z'), end=new Date('2026-02-04T23:00Z');
  const state=upsert({...newPlanner(start),timeZone:'UTC'},birthday);
  const after=collectAlerts(state,end,dueAlerts);
  assert.equal(after.inbox.length,1);
  assert.equal(after.inbox[0].dueAt,'2026-02-02T09:00:00.000Z');
  const replay={...after,lastCheck:start.toISOString(),inbox:after.inbox.map(n=>({...n,read:true}))};
  assert.deepEqual(collectAlerts(replay,end,dueAlerts).inbox,replay.inbox);
  assert.equal(removeEntry(after,birthday.id).inbox.length,0);
  const storage=memory();
  savePlanner(storage,replay);
  assert.equal(loadPlanner(storage).inbox[0].read,true);
});

test('storage failures and invalid stored data are surfaced without silently replacing data',()=>{
  const broken={getItem:()=>'{',setItem:()=>assert.fail('unexpected write')};
  assert.throws(()=>loadPlanner(broken),SyntaxError);
  const unknown={getItem:()=>'{"version":2}',setItem:()=>assert.fail('unexpected write')};
  assert.throws(()=>loadPlanner(unknown),/storageInvalid/);
  assert.throws(()=>savePlanner({setItem:()=>{throw new Error('Quota exceeded');}},newPlanner()),/Quota exceeded/);
});
