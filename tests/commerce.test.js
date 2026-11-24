import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, catalog, settings } from '../server/db.js';
import { order, orders, placeOrder, saveAdmin, transition } from '../server/commerce.js';

function fixture(t) {
  const db = openDb(':memory:');
  t.after(() => db.close());
  for (const user of ['a', 'b']) {
    db.prepare('INSERT INTO users(id,name,email,password,role) VALUES (?,?,?,?,?)').run(user,user,user+'@example.com','hash','customer');
  }
  const p = catalog(db).products[0];
  const body = {key:randomUUID(), items:[{id:p.id,qty:1}], method:'standard', recipient:'Customer',
    phone:'09123456789', address:'Sample delivery address', expectedTotal:p.priceIrr + settings(db).delivery.standard.fee};
  return {db,p,body};
}

test('retries preserve stock, enforce ownership and bind a key to its checkout', t => {
  const {db,p,body} = fixture(t);
  const first = placeOrder(db,'a',body);
  assert.deepEqual(placeOrder(db,'a',body),first);
  assert.throws(() => placeOrder(db,'a',{...body,address:'A different address'}), /key/i);
  assert.equal(catalog(db).products[0].stock,p.stock-1);
  assert.equal(orders(db,'b').length,0);
  assert.equal(order(db,first.id).total,body.expectedTotal);
});

test('invalid pricing, unavailable stock and duplicate lines cannot partially reserve items', t => {
  const {db,p,body} = fixture(t);
  for (const patch of [{expectedTotal:0},{items:[...body.items,...body.items]},
    {items:[...body.items,{id:'missing',qty:1}]},{items:[{id:p.id,qty:0.5}]}]) {
    assert.throws(() => placeOrder(db,'a',{...body,...patch}));
    assert.equal(catalog(db).products[0].stock,p.stock);
    assert.equal(orders(db).length,0);
  }
});

test('a cancelled reservation releases its slot and stock exactly once', t => {
  const {db,p,body} = fixture(t);
  const {id} = saveAdmin(db,'slot',{id:'',nameFa:'فردا',nameEn:'Tomorrow',ends:new Date(Date.now()+86400000).toISOString(),capacity:'1'});
  const scheduled={...body,method:'scheduled',slot:id,wrap:true,expectedTotal:p.priceIrr+settings(db).delivery.scheduled.fee+settings(db).wrapFee};
  const first=placeOrder(db,'a',scheduled);
  assert.throws(()=>placeOrder(db,'b',{...scheduled,key:randomUUID()}),/slot/i);
  assert.throws(()=>transition(db,first.id,'delivered'), /transition/i);
  transition(db,first.id,'cancelled');
  assert.throws(()=>transition(db,first.id,'cancelled'), /transition/i);
  assert.equal(catalog(db).products[0].stock,p.stock);
  assert.equal(placeOrder(db,'b',{...scheduled,key:randomUUID()}).slotLabel.en,'Tomorrow');
});

test('catalog writes preserve order snapshots and prevent sale of hidden products', t => {
  const {db,p,body}=fixture(t);
  const first=placeOrder(db,'a',body);
  saveAdmin(db,'product',{id:p.id,nameFa:p.name.fa,nameEn:'New name',descriptionFa:p.description.fa,
    descriptionEn:p.description.en,image:p.image,category:p.category,stock:2,priceIrr:25,hidden:true});
  assert(!catalog(db).products.some(i=>i.id===p.id));
  assert(catalog(db,true).products.some(i=>i.id===p.id));
  assert.deepEqual(order(db,first.id).items[0].name,p.name);
  assert.throws(()=>placeOrder(db,'a',{...body,key:randomUUID()}), /Stock/);
});

test('restart preserves catalog edits, disabled delivery and mascot settings', t => {
  const dir=mkdtempSync(join(tmpdir(),'simagol-commerce-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'shop.sqlite');
  let db=openDb(path);
  try {
    saveAdmin(db,'category',{id:'bouquet',nameFa:'گل',nameEn:'New category'});
    saveAdmin(db,'brand',{showHero:false,hero:'images/hero.jpg',mascot_empty:'uploads/sample.png'});
    saveAdmin(db,'copy',{key:'Shop',copyFa:'فروشگاه',copyEn:'Florist'});
    saveAdmin(db,'delivery',{standardFee:'1',expressFee:'2',scheduledFee:'3',wrapFee:'4'});
  } finally {db.close();}
  db=openDb(path);
  try {
    assert.equal(catalog(db).categories[0].name.en,'New category');
    const config=settings(db);
    assert.equal(config.showHero,false);
    assert.equal(config.mascot.empty,'uploads/sample.png');
    assert.equal(config.copy.Shop.en,'Florist');
    assert.deepEqual(config.delivery.standard,{enabled:false,fee:1});
  } finally {db.close();}
});

test('expired slots and disabled methods cannot be reserved', t => {
  const {db,p,body}=fixture(t);
  const {id}=saveAdmin(db,'slot',{nameFa:'دیروز',nameEn:'Yesterday',ends:new Date(0).toISOString(),capacity:2});
  assert.throws(()=>placeOrder(db,'a',{...body,slot:id,method:'scheduled'}), /slot/i);
  saveAdmin(db,'delivery',{standardFee:'500000',expressFee:'0',scheduledFee:'0',wrapFee:'0'});
  assert.throws(()=>placeOrder(db,'a',body), /Delivery unavailable/);
  assert.equal(catalog(db).products[0].stock,p.stock);
});
