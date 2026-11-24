import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog, settings } from './db.js';
import { notifications, markNotificationsRead } from './notifications.js';
import { placeOrder, transition, order, orders, saveAdmin } from './commerce.js';
import { register, login, getUser, newSession, logout, profile, setRole } from './auth.js';

const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
function fail(status, message) { throw Object.assign(new Error(message), {status}); }

async function bodyOf(req, limit) {
  const chunks=[];
  let size=0;
  for await(const chunk of req) {
    size+=chunk.length;
    if(size>limit) fail(413,'File too large');
    chunks.push(chunk);
  }
  let value;
  try { value=JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400,'Invalid input'); }
  if(!value || Array.isArray(value) || typeof value!=='object') fail(400,'Invalid input');
  return value;
}

async function media(dir, data) {
  if(typeof data!=='string' || !/^[A-Za-z0-9+/]+=*$/.test(data)) fail(400,'Invalid image');
  const bytes=Buffer.from(data,'base64');
  let ext;
  if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) ext='png';
  else if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) ext='jpg';
  else if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') ext='webp';
  if(!ext || bytes.length<16 || bytes.length>2*1024*1024) fail(422,'Invalid image');
  const name=createHash('sha256').update(bytes).digest('hex')+'.'+ext;
  await mkdir(join(dir,'uploads'),{recursive:true});
  await writeFile(join(dir,'uploads',name),bytes);
  return {path:'uploads/'+name};
}

export function createHandler({db,dir,origin,production,ordersEnabled}) {
  const attempts=new Map();
  function throttle(ip) {
    const now=Date.now();
    if(attempts.size>4096) {
      for(const [key,v] of attempts) if(v.until<=now) attempts.delete(key);
      if(attempts.size>4096 && !attempts.has(ip)) fail(429,'Try again later');
    }
    const record=attempts.get(ip);
    if(!record||record.until<=now) attempts.set(ip,{count:1,until:now+600000});
    else if(++record.count>30) fail(429,'Try again later');
  }
  return async function handle(req,res) {
    const send=(value,status=200)=>{
      res.statusCode=status;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(production) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const path=new URL(req.url,origin).pathname;
      const method=req.method;
      if(!path.startsWith('/api/')) {
        if(!['GET','HEAD'].includes(method)) fail(405,'Method unavailable');
        const unknownPage=path!=='/' && path!=='/index.html' && req.headers.accept?.includes('text/html') &&
          !/^\/(?:images|uploads|components)\//.test(path);
        const filename=path==='/'||unknownPage?'index.html':path.slice(1);
        if(unknownPage)res.statusCode=404;
        if(!/^(index\.html|shop\.css|app\.js|labels\.json|components\/[a-z]+\.js|images\/[a-z]+\.jpg|uploads\/[a-f0-9]{64}\.(png|jpg|webp))$/.test(filename)) fail(404,'Page not found');
        const bytes=await readFile(join(filename.startsWith('uploads/')?dir:publicDir,filename)).catch(()=>fail(404,'Page not found'));
        res.setHeader('Content-Type',types[extname(filename)]);
        res.end(method==='HEAD'?undefined:bytes);
        return;
      }
      const key=path.slice(5);
      const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sg_session='))?.slice(11)||'';
      const user=getUser(db,token);
      const permit=(roles)=>{
        if(!user) fail(401,'Please sign in');
        if(roles&&!roles.includes(user.role)) fail(403,'Access denied');
      };
      if(method==='GET') {
        if(key==='health') {db.prepare('SELECT 1').get();return send({ok:true});}
        if(key==='store') return send({catalog:catalog(db),settings:{...settings(db),ordersEnabled}});
        if(key==='me') return send(user);
        if(key==='orders') {permit();return send(orders(db,user.id));}
        if(key==='notifications') {permit();return send(notifications(db,user.id));}
        if(key.startsWith('orders/')) {
          permit();
          const o=order(db,key.slice(7));
          if(!o || (o.userId!==user.id && !['owner','florist'].includes(user.role))) fail(404,'Order not found');
          return send(o);
        }
        if(key==='admin') {
          permit(['owner','editor','florist']);
          const out={};
          if(user.role!=='editor') out.orders=orders(db);
          if(user.role!=='florist') out.products=catalog(db,true).products;
          if(user.role==='owner') out.clients=db.prepare('SELECT id,email,name,role FROM users ORDER BY name').all();
          return send(out);
        }
        fail(404,'Page not found');
      }
      if(method!=='POST') fail(405,'Method unavailable');
      if(req.headers.origin!==origin || req.headers['x-simagol']!=='1') fail(403,'Access denied');
      if(req.headers['content-type']?.split(';')[0]!=='application/json') fail(415,'Invalid input');
      if(key==='login'||key==='register') throttle(req.socket.remoteAddress);
      if(key==='admin/upload') permit(['owner','editor']);
      const b=await bodyOf(req,key==='admin/upload'?2900000:64000);
      const cookie=(value,seconds)=>res.setHeader('Set-Cookie','sg_session='+value+'; Max-Age='+seconds+'; Path=/; HttpOnly; SameSite=Lax'+(production?'; Secure':''));
      if(key==='register'||key==='login') {
        const account=await (key==='register'?register(db,b):login(db,b));
        if(token) logout(db,token);
        cookie(newSession(db,account.id),604800);
        return send(account,key==='register'?201:200);
      }
      if(key==='logout') {logout(db,token);cookie('',0);return send({ok:true});}
      permit();
      if(key==='profile') return send(profile(db,user.id,b));
      if(key==='notifications/read') return send(markNotificationsRead(db,user.id,b.through));
      if(key==='orders') {
        if(!ordersEnabled) fail(409,'Ordering is closed');
        return send(placeOrder(db,user.id,b),201);
      }
      if(key==='admin/status') {permit(['owner','florist']);return send(transition(db,b.id,b.status));}
      if(key==='admin/role') {permit(['owner']);return send(setRole(db,user.id,b.id,b.role));}
      if(key==='admin/upload') return send(await media(dir,b.data),201);
      if(['product','category','brand','copy','delivery','slot','homepage'].some(a=>key==='admin/'+a)) {
        permit(['owner','editor']);
        return send(saveAdmin(db,key.slice(6),b)??{ok:true});
      }
      fail(404,'Page not found');
    } catch(error) {
      if(!error.status) console.error('request failed',error.name,error.code||'internal');
      send({error:error.status?error.message:'Service unavailable'},error.status||500);
    }
  };
}
