import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHandler} from '../server/http.js';
import {openDb} from '../server/db.js';
import vm from 'node:vm';

const prefix='public/planner/';
const manifest=JSON.parse(readFileSync(prefix+'manifest.json'));
test('standalone shell, PNG dimensions and iOS launch assets are consistent',()=>{
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/planner/');
  for(const size of [192,512]){
    const icon=manifest.icons.find(i=>i.sizes===size+'x'+size);
    const png=readFileSync(join(prefix,icon.src));
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
  }
  const html=readFileSync(prefix+'index.html','utf8');
  assert.match(html,/apple-touch-startup-image/);
  for(const [,file] of html.matchAll(/href="\.\/(images\/[^"]+)"/g)) assert.ok(existsSync(prefix+file));
});
test('offline install caches the working planner without private endpoints',async()=>{
  const handlers={};let paths;
  const code=readFileSync(prefix+'sw.js','utf8');
  const context={self:{location:{origin:'https://shop.example'},addEventListener:(type,fn)=>handlers[type]=fn},
    caches:{open:async()=>({addAll:async list=>{paths=list.map(r=>r.path)}})},
    Request:class{constructor(path){this.path=path}},URL};
  vm.runInNewContext(code,context);
  let installed;
  handlers.install({waitUntil:p=>installed=p});
  await installed;
  const db=openDb(':memory:');
  try {
    const handle=createHandler({db,dir:'.',origin:'https://shop.example',production:true,ordersEnabled:false});
    for(const path of paths){
      const res={statusCode:200,setHeader(){},end(v){this.bytes=v}};
      await handle({url:path,method:'GET',headers:{},socket:{}},res);
      assert.equal(res.statusCode,200,path);
      assert.ok(res.bytes?.length,path);
    }
  } finally {db.close();}
  assert.ok(paths.includes('/planner/') && paths.includes('/planner/store.js'));
  let intercepted=false;
  handlers.fetch({request:{url:'https://shop.example/api/me',method:'GET'},respondWith:()=>{intercepted=true}});
  assert.equal(intercepted,false);
});
