import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.js';
import { createHandler } from '../server/http.js';
import { Readable } from 'node:stream';

test('store API and authenticated customer journey', async () => {
  const dir=mkdtempSync(join(tmpdir(),'simagol-test-'));
  const db=openDb(':memory:');
  const origin='http://localhost:3000';
  const handle=createHandler({db,dir,origin,production:false,ordersEnabled:true});
  let cookie='';
  async function call(method,url,data,other={}) {
    const req=Readable.from(data?[Buffer.from(JSON.stringify(data))]:[]);
    Object.assign(req,{url,method,socket:{remoteAddress:'local'},headers:{origin,'x-simagol':'1','content-type':'application/json',cookie,...other}});
    const headers={};
    const res={statusCode:200,setHeader:(k,v)=>headers[k.toLowerCase()]=v,end(v){this.body=v}};
    await handle(req,res);
    if(headers['set-cookie']) cookie=headers['set-cookie'].split(';')[0];
    return [res.statusCode,JSON.parse(res.body),headers];
  }
  try {
    assert.equal((await call('GET','/api/admin'))[0],401);
    assert.equal((await call('GET','/api/planner'))[0],401);
    assert.equal((await call('POST','/api/planner/save',{}))[0],401);
    assert.equal((await call('POST','/api/login',{}, {origin:'https://other.example'}))[0],403);
    const [,shop]=await call('GET','/api/store');
    assert.equal(shop.catalog.products.length,4);
    assert.equal((await call('POST','/api/register',{name:'Test Buyer',email:'buyer@example.test',password:'only-for-this-test-786'}))[0],201);
    assert.equal((await call('GET','/api/me'))[1].name,'Test Buyer');
    assert.equal((await call('GET','/api/admin'))[0],403);
    const p=shop.catalog.products[0];
    const body={key:crypto.randomUUID(),items:[{id:p.id,qty:1}],recipient:'Test Buyer',address:'Sample Street 12, Tehran',phone:'09121234567',method:'standard',wrap:false,slot:'',message:'',expectedTotal:p.priceIrr+shop.settings.delivery.standard.fee};
    const [status,created]=await call('POST','/api/orders',body);
    assert.equal(status,201);
    assert.equal((await call('POST','/api/orders',body))[1].id,created.id);
    assert.equal((await call('GET','/api/orders'))[1].length,1);
    const [,notices]=await call('GET','/api/notifications');
    assert.equal(notices[0].orderId,created.id);
    assert.equal((await call('POST','/api/notifications/read',{through:notices[0].id}))[0],200);
    assert.equal((await call('GET','/api/notifications'))[1][0].seen,true);
    await call('POST','/api/logout',{});
    assert.equal((await call('GET','/api/notifications'))[0],401);
    assert.equal((await call('GET','/api/orders'))[0],401);
    await call('POST','/api/register',{name:'Another Buyer',email:'other@example.test',password:'only-for-this-test-789'});
    assert.equal((await call('GET','/api/orders/'+created.id))[0],404);
    assert.deepEqual((await call('GET','/api/notifications'))[1],[]);
  } finally { db.close();rmSync(dir,{recursive:true,force:true}); }
});
