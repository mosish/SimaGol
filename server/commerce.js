import { createHash, randomUUID } from 'node:crypto';
import { settings, transaction } from './db.js';
import { recordNotification } from './notifications.js';

function fail(status=400, message='Invalid input') {
  throw Object.assign(new Error(message), {status});
}
function string(value, max, optional=false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail();
  return value.trim();
}
function integer(value, max, min=0) {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < min || n > max) fail();
  return n;
}
function flag(value) {
  if (value == null || value === false) return false;
  if (value === true || value === 'on') return true;
  fail();
}
function bilingual(body,prefix,max) {
  return {fa:string(body[prefix+'Fa'],max),en:string(body[prefix+'En'],max)};
}
function media(value, optional=false) {
  const path = string(value,250,optional);
  if (!path && optional) return '';
  if (!/^(images|uploads)\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(path)) fail();
  return path;
}
function rowOrder(row) {
  if (!row) return null;
  const {id,userId,created,status,snapshot} = row;
  return {id,userId,created,status,...JSON.parse(snapshot)};
}
export function order(db,id) {
  return rowOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(id));
}
export function orders(db,userId=null) {
  const rows = userId===null ? db.prepare('SELECT * FROM orders ORDER BY created DESC,rowid DESC').all()
    : db.prepare('SELECT * FROM orders WHERE userId=? ORDER BY created DESC,rowid DESC').all(userId);
  return rows.map(rowOrder);
}
function checkoutInput(body) {
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length>100) fail();
  const key=string(body.key,36);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(key)) fail();
  const ids=new Set();
  const items=body.items.map(row=>{
    const id=string(row?.id,80), qty=integer(row?.qty,1000,1);
    if (ids.has(id)) fail();
    ids.add(id);
    return {id,qty};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const phone=string(body.phone,40);
  const digitCount=(phone.match(/[0-9۰-۹٠-٩]/g)||[]).length;
  if(digitCount<7 || digitCount>15)fail();
  const digits=phone.replace(/[^\d۰-۹٠-٩]/g,'');
  if (!/^[\d۰-۹٠-٩+() -]+$/.test(phone) || digits.length<6 || digits.length>15) fail();
  return {key,items,phone,recipient:string(body.recipient,160),address:string(body.address,1000),
    method:string(body.method,20),slot:body.method==='scheduled'?string(body.slot,80):null,
    wrap:flag(body.wrap),message:string(body.message,1000,true),expectedTotal:integer(body.expectedTotal,Number.MAX_SAFE_INTEGER)};
}
export function placeOrder(db,userId,body) {
  const input=checkoutInput(body);
  const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return transaction(db,()=>{
    const previous=db.prepare('SELECT * FROM orders WHERE userId=? AND requestKey=?').get(userId,input.key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail(409,'Order key already used');
      return rowOrder(previous);
    }
    const config=settings(db);
    if (!Object.hasOwn(config.delivery,input.method) || !config.delivery[input.method].enabled) fail(409,'Delivery unavailable');
    const deliveryFee=config.delivery[input.method].fee, wrapFee=input.wrap?config.wrapFee:0;
    let slotLabel=null;
    if (input.slot) {
      const slot=config.slots.find(s=>s.id===input.slot);
      if (!slot || Date.parse(slot.ends)<=Date.now() || slot.booked>=slot.capacity) fail(409,'Time slot unavailable');
      slotLabel=slot.label;
    }
    let total=deliveryFee+wrapFee;
    const items=input.items.map(({id,qty})=>{
      const p=db.prepare('SELECT priceIrr,name,stock FROM products WHERE id=? AND hidden=0').get(id);
      if (!p || p.stock<qty) fail(409,'Stock unavailable');
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(qty,id);
      total+=p.priceIrr*qty;
      return {id,qty,unit:p.priceIrr,name:JSON.parse(p.name)};
    });
    if (!Number.isSafeInteger(total) || total!==input.expectedTotal) fail(409,'Price changed');
    const {recipient,address,phone,method,message,wrap}=input;
    const snapshot={items,recipient,address,phone,message,method,wrap,deliveryFee,wrapFee,slotLabel,total};
    const id=randomUUID();
    db.prepare(`INSERT INTO orders(id,userId,requestKey,fingerprint,created,status,slot,snapshot)
      VALUES (?,?,?,?,?,'placed',?,?)`).run(id,userId,input.key,fingerprint,new Date().toISOString(),input.slot,JSON.stringify(snapshot));
    recordNotification(db,id,userId,'placed');
    return order(db,id);
  });
}

const next = {placed:['preparing','cancelled'],preparing:['shipped','cancelled'],shipped:['delivered'],cancelled:[],delivered:[]};
export function transition(db,id,status) {
  return transaction(db,()=>{
    const current=order(db,id);
    if (!current) fail(404,'Order not found');
    if (!next[current.status].includes(status)) fail(409,'Invalid status transition');
    if (status==='cancelled') {
      for (const item of current.items) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.qty,item.id);
    }
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,id);
    recordNotification(db,id,current.userId,status);
    return order(db,id);
  });
}

function setOption(db,key,value) {
  db.prepare('UPDATE options SET value=? WHERE key=?').run(JSON.stringify(value),key);
}
function editId(db,id,table) {
  if (!id) return randomUUID();
  const known = db.prepare('SELECT id FROM '+table+' WHERE id=?').get(string(id,80));
  if (!known) fail(404,'Record not found');
  return known.id;
}
export function saveAdmin(db,action,body) {
  if (!body || typeof body!=='object') fail();
  return transaction(db,()=>{
    switch(action) {
      case 'product': {
        const id=editId(db,body.id,'products');
        const category=string(body.category,80);
        if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(category)) fail();
        db.prepare(`INSERT INTO products(id,category,name,description,image,priceIrr,stock,hidden)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,name=excluded.name,
          description=excluded.description,image=excluded.image,priceIrr=excluded.priceIrr,stock=excluded.stock,hidden=excluded.hidden`)
          .run(id,category,JSON.stringify(bilingual(body,'name',180)),JSON.stringify(bilingual(body,'description',3000)),
            media(body.image),integer(body.priceIrr,1000000000000),integer(body.stock,1000000),Number(flag(body.hidden)));
        return {id};
      }
      case 'category': {
        const id=editId(db,body.id,'categories');
        db.prepare('INSERT INTO categories(id,name) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name')
          .run(id,JSON.stringify(bilingual(body,'name',180)));
        return {id};
      }
      case 'slot': {
        const id=editId(db,body.id,'slots');
        const ends=string(body.ends,40), timestamp=Date.parse(ends);
        if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z$/.test(ends) || !Number.isFinite(timestamp)) fail();
        const capacity=integer(body.capacity,10000);
        const booked=db.prepare("SELECT count(*) count FROM orders WHERE slot=? AND status!='cancelled'").get(id).count;
        if (capacity<booked) fail(409,'Slot capacity below bookings');
        db.prepare(`INSERT INTO slots(id,label,ends,capacity) VALUES (?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET label=excluded.label,ends=excluded.ends,capacity=excluded.capacity`)
          .run(id,JSON.stringify(bilingual(body,'name',180)),new Date(timestamp).toISOString(),capacity);
        return {id};
      }
      case 'homepage': {
        if (!['hero','catalog'].includes(body.first)) fail();
        const enabled=flag(body.enabled);
        const text={fa:string(body.textFa,500,!enabled),en:string(body.textEn,500,!enabled)};
        const home={first:body.first,enabled,text,image:media(body.image,true)};
        db.prepare("INSERT INTO options(key,value) VALUES ('homepage',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(home));
        break;
      }
      case 'brand': {
        setOption(db,'hero',media(body.hero));
        setOption(db,'logo',media(body.logo,true));
        setOption(db,'showHero',flag(body.showHero));
        const mascot={};
        for (const slot of ['hero','empty','loading','404']) mascot[slot]=media(body['mascot_'+slot],true);
        setOption(db,'mascot',mascot);
        break;
      }
      case 'copy': {
        const key=string(body.key,200);
        if (['__proto__','prototype','constructor'].includes(key)) fail();
        const copy=JSON.parse(db.prepare("SELECT value FROM options WHERE key='copy'").get().value);
        setOption(db,'copy',{...copy,[key]:bilingual(body,'copy',3000)});
        break;
      }
      case 'delivery': {
        const delivery={};
        for (const method of ['standard','express','scheduled']) {
          delivery[method]={enabled:flag(body[method+'On']),fee:integer(body[method+'Fee'],1000000000000)};
        }
        setOption(db,'delivery',delivery);
        setOption(db,'wrapFee',integer(body.wrapFee,1000000000000));
        break;
      }
      default: fail(404,'Unknown action');
    }
    return {id:action};
  });
}
