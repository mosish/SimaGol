import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { openDb } from '../server/db.js';
import { initPush, pushCredentials, sendWake, syncPush, deletePush, pushTick } from '../server/push.js';
import { createHandler } from '../server/http.js';
import { Readable } from 'node:stream';

const endpoint='https://web.push.apple.com/test-token';
const input={endpoint,time:'09:00',timeZone:'Asia/Tehran',events:[{
  id:'test-one',kind:'personal',annual:true,date:'2000-12-04',daysBefore:1,name:'Private name',notes:'Private note'
}]};
const when=Date.parse('2026-12-03T05:30:00Z');
function setup(t) {
  const db=openDb(':memory:');
  t.after(()=>db.close());initPush(db);
  for(const id of ['a','b']) db.prepare('INSERT INTO users(id,name,email,password) VALUES (?,?,?,?)').run(id,id,id+'@example.test','unused');
  return db;
}
test('enrollment whitelists scheduling fields, validates providers, and enforces ownership',t=>{
  const db=setup(t);
  syncPush(db,'a',input,when-60000);
  const data=db.prepare('SELECT schedule FROM planner_push').get().schedule;
  assert(!data.includes('Private'));
  assert.throws(()=>syncPush(db,'b',input),e=>e.status===409);
  deletePush(db,'b',input);
  assert.equal(db.prepare('SELECT count(*) n FROM planner_push').get().n,1);
  for (const patch of [{endpoint:'http://web.push.apple.com/x'},{endpoint:'https://127.0.0.1/token'},
    {endpoint:'https://web.push.apple.com.example.org/x'},{timeZone:'unknown/zone'},{time:'25:00'}])
    assert.throws(()=>syncPush(db,'a',{...input,...patch}),e=>e.status===400);
  deletePush(db,'a',input);
  assert.equal(db.prepare('SELECT count(*) n FROM planner_push').get().n,0);
});
test('delivery recurs across years, deduplicates successful retries and bounds missed alerts',async t=>{
  const db=setup(t);let sends=0;
  const sender=async()=>{sends++;return {status:201};};
  syncPush(db,'a',input,when-60000);
  await pushTick(db,{},when,sender);assert.equal(sends,0);
  await pushTick(db,{},when+100,sender);assert.equal(sends,1);
  db.prepare('UPDATE planner_push SET cursor=?').run(when-60000);
  await pushTick(db,{},when+1000,sender);assert.equal(sends,1);
  await pushTick(db,{},Date.parse('2027-12-10T05:31:00Z'),sender);assert.equal(sends,1);
  await pushTick(db,{},Date.parse('2028-12-03T05:31:00Z'),sender);assert.equal(sends,2);
});
test('temporary failures respect Retry-After and expired subscriptions are removed',async t=>{
  const db=setup(t);let tries=0;
  syncPush(db,'a',input,when-60000);
  const sender=async()=>++tries===1?{status:429,retryMs:120000}:{status:410};
  await pushTick(db,{},when+1,sender);await pushTick(db,{},when+61000,sender);
  assert.equal(tries,1);
  await pushTick(db,{},when+121000,sender);
  assert.equal(tries,2);assert.equal(db.prepare('SELECT count(*) n FROM planner_push').get().n,0);
});
test('empty push carries a verifiable ES256 origin-scoped VAPID JWT',async()=>{
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const credentials=pushCredentials(pair.privateKey.export({type:'pkcs8',format:'pem'}),'mailto:push@example.test');
  const mock=async(url,req)=>{
    assert.equal(url,endpoint);assert.equal(req.body,undefined);assert.equal(req.redirect,'error');
    const [,jwt,key]=req.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
    assert.equal(key,credentials.publicKey);assert.equal(Buffer.from(key,'base64url').length,65);
    const [header,payload,sig]=jwt.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(payload,'base64url')),{aud:new URL(endpoint).origin,exp:Math.floor(when/1000)+3600,sub:'mailto:push@example.test'});
    assert(verify('sha256',Buffer.from(header+'.'+payload),{key:pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')));
    return new Response(null,{status:201});
  };
  assert.equal((await sendWake(endpoint,credentials,'sampletopic',when,mock)).status,201);
});
test('HTTP exposes only public key, enforces session ownership and same-origin sync/delete',async t=>{
  const db=setup(t), origin='http://localhost:3000';
  const handler=createHandler({db,origin,dir:'.',pushCredentials:{publicKey:'public',key:'secret'}});
  let cookie='';
  const call=async(path,body,headers={})=>{
    const request=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);
    Object.assign(request,{method:body?'POST':'GET',url:'/api/'+path,socket:{remoteAddress:'local'},
      headers:{origin,'x-simagol':'1','content-type':'application/json',cookie,...headers}});
    const response={statusCode:200,setHeader(k,v){if(k==='Set-Cookie')cookie=v.split(';')[0];},end(v){this.body=JSON.parse(v);}};
    await handler(request,response);
    return response;
  };
  assert.deepEqual((await call('push/config')).body,{enabled:true,publicKey:'public'});
  assert.equal((await call('push/sync',input)).statusCode,401);
  await call('register',{name:'Demo',email:'demo@example.test',password:'integration-only-secret'});
  assert.equal((await call('push/sync',input,{origin:'https://foreign.example'})).statusCode,403);
  assert.equal((await call('push/sync',input)).statusCode,200);
  assert.equal((await call('push/delete',{endpoint})).statusCode,200);
});
