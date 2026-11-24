import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {openDb} from '../server/db.js';
import {newSession} from '../server/auth.js';
import {createHandler} from '../server/http.js';

test('production defaults, role-specific editing, stored images and public entry points',async()=>{
  const db=openDb(':memory:');
  const dir=mkdtempSync(join(tmpdir(),'sg-release-'));
  const origin='https://shop.example';
  const serve=createHandler({db,dir,origin,production:true,ordersEnabled:false});
  for(const role of ['owner','florist','editor','customer']) {
    db.prepare('INSERT INTO users(id,role,email,name,password) VALUES (?,?,?,?,?)').run(role,role,role+'@example.test',role,'test');
  }
  const tokens=Object.fromEntries(['owner','florist','editor','customer'].map(id=>[id,newSession(db,id)]));
  async function call(path,{data,role='customer',method=data?'POST':'GET',headers={}}={}) {
    const req=Readable.from(data?[Buffer.from(JSON.stringify(data))]:[]);
    Object.assign(req,{url:path,method,socket:{remoteAddress:'local'},headers:{origin,'x-simagol':'1','content-type':'application/json',cookie:'sg_session='+tokens[role],...headers}});
    const response={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(bytes){this.bytes=bytes;}};
    await serve(req,response);
    return response;
  }
  try {
    const page=await call('/');
    assert.equal(page.statusCode,200);
    assert.match(String(page.bytes),/<html lang="fa" dir="rtl">/);
    assert.match(page.headers['Strict-Transport-Security'],/max-age/);
    assert.equal((await call('/missing',{headers:{accept:'text/html'}})).statusCode,404);
    for(const f of ['/shop.css','/app.js','/labels.json','/components/home.js','/images/roses.jpg']){
      assert.equal((await call(f)).statusCode,200);
    }
    assert.equal((await call('/api/orders',{data:{}})).statusCode,409);
    assert.equal((await call('/api/admin',{role:'editor'})).statusCode,200);
    assert.equal(JSON.parse((await call('/api/admin',{role:'florist'})).bytes).clients,undefined);
    const homepage={first:'catalog',enabled:true,textFa:'گل',textEn:'Flowers',image:'images/roses.jpg'};
    assert.equal((await call('/api/admin/homepage',{role:'florist',data:homepage})).statusCode,403);
    assert.equal((await call('/api/admin/homepage',{role:'editor',data:homepage})).statusCode,200);
    assert.equal(JSON.parse((await call('/api/store')).bytes).settings.homepage.first,'catalog');
    const image=readFileSync(new URL('../public/images/roses.jpg',import.meta.url));
    const uploaded=await call('/api/admin/upload',{role:'editor',data:{data:image.toString('base64')}});
    assert.equal(uploaded.statusCode,201);
    const stored=await call('/'+JSON.parse(uploaded.bytes).path);
    assert.deepEqual(stored.bytes,image);
    assert.equal((await call('/api/admin/upload',{role:'owner',data:{data:'dGVzdA=='}})).statusCode,422);
    assert.equal((await call('/api/profile',{data:{prefs:{favorites:['blush']}}})).statusCode,200);
    assert.deepEqual(JSON.parse((await call('/api/me')).bytes).prefs.favorites,['blush']);
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
