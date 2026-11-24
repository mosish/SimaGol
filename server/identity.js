import {randomBytes,randomInt,randomUUID,createHash,createPublicKey,verify} from 'node:crypto';
import {transaction} from './db.js';
import {phoneOf} from './planner.js';
import {passwordHash} from './auth.js';

const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const minute=60000;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

function identity(db,provider,subject,name,create=true){
  const row=db.prepare('SELECT userId FROM identities WHERE provider=? AND subject=?').get(provider,subject);
  if(row)return row.userId;
  if(!create)fail(404,'Register this mobile number first');
  const id=randomUUID();
  // Non-email accounts use a unique internal key that email login cannot match.
  db.prepare("INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,'','customer')").run(id,provider+':'+id,name);
  db.prepare('INSERT INTO identities VALUES(?,?,?)').run(provider,subject,id);
  return id;
}

export async function requestSms(db,sms,body,now=Date.now()){
  if(!sms)fail(503,'SMS sign-in unavailable');
  const phone=phoneOf(body.phone);
  db.prepare('DELETE FROM login_codes WHERE at<?').run(now-86400000);
  const counts=db.prepare('SELECT max(at) AS last,count(*) AS n FROM login_codes WHERE phone=?').get(phone);
  if(counts.last>now-minute||counts.n>=5||db.prepare('SELECT count(*) AS n FROM login_codes').get().n>=150)fail(429,'Try again later');
  const id=token(), code=String(randomInt(100000,1000000));
  db.prepare('UPDATE login_codes SET tries=0 WHERE phone=?').run(phone);
  db.prepare('INSERT INTO login_codes VALUES(?,?,?,?,5)').run(hash(id),phone,hash(id+code),now);
  try{await sms(phone,'code',code);}catch{db.prepare('UPDATE login_codes SET tries=0 WHERE id=?').run(hash(id));fail(503,'SMS sign-in unavailable');}
  return {challenge:id};
}
export function verifySms(db,b,now=Date.now()){
  if(typeof b.challenge!=='string'||b.challenge.length!==43||!/^\d{6}$/.test(String(b.code)))fail(400,'Invalid verification code');
  const id=hash(b.challenge);
  const row=db.prepare('UPDATE login_codes SET tries=tries-1 WHERE id=? AND at>? AND tries>0 RETURNING *').get(id,now-5*minute);
  if(!row||row.digest!==hash(b.challenge+b.code))fail(400,'Invalid verification code');
  const name=typeof b.name==='string'?b.name.trim():'';
  if(b.register===true&&(!name||name.length>120))fail(400,'Invalid name');
  db.prepare('UPDATE login_codes SET tries=0 WHERE id=?').run(id);
  return transaction(db,()=>identity(db,'sms',row.phone,name,b.register===true));
}

const issuers={
  google:{scope:'openid',issuer:'https://accounts.google.com',auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',keys:'https://www.googleapis.com/oauth2/v3/certs'},
  apple:{scope:null,issuer:'https://appleid.apple.com',auth:'https://appleid.apple.com/auth/authorize',token:'https://appleid.apple.com/auth/token',keys:'https://appleid.apple.com/auth/keys'}
};
export function providerConfig(env=process.env){
  const config={};
  for(const [name,issuer] of Object.entries(issuers)){
    const prefix=name.toUpperCase(),client=env[prefix+'_CLIENT_ID'],secret=env[prefix+'_CLIENT_SECRET'];
    if(client&&secret)config[name]={...issuer,client,secret};
  }
  return config;
}
export function beginProvider(db,providers,name,origin,back){
  const p=Object.hasOwn(providers,name)&&providers[name];
  if(!p)fail(503,'Sign-in method unavailable');
  const state=token(),browser=token(),nonce=token(),verifier=token();
  db.prepare('DELETE FROM oauth_flows WHERE expires<=?').run(Date.now());
  const dest=back==='#checkout'?'/#checkout':back==='#account/planner-login'?'/planner/':'/#account';
  db.prepare('INSERT INTO oauth_flows VALUES(?,?,?,?,?,?,?)').run(hash(state),hash(browser),name,nonce,verifier,dest,Date.now()+10*minute);
  const url=new URL(p.auth);
  const params={client_id:p.client,response_type:'code',redirect_uri:origin+'/api/identity/'+name+'/callback',state,nonce};
  if(p.scope)params.scope=p.scope;
  if(name==='google'){params.code_challenge=createHash('sha256').update(verifier).digest('base64url');params.code_challenge_method='S256';}
  url.search=new URLSearchParams(params);
  return {browser,url:String(url)};
}
export async function finishProvider(db,providers,name,origin,query,browser,request=fetch){
  const p=Object.hasOwn(providers,name)&&providers[name];
  if(!p||!browser)fail(400,'Sign-in expired');
  const flow=db.prepare('DELETE FROM oauth_flows WHERE state=? AND browser=? AND provider=? AND expires>? RETURNING *')
    .get(hash(query.get('state')||''),hash(browser),name,Date.now());
  if(!flow||!query.get('code'))fail(400,'Sign-in expired');
  const params={grant_type:'authorization_code',code:query.get('code'),client_id:p.client,client_secret:p.secret,redirect_uri:origin+'/api/identity/'+name+'/callback'};
  if(name==='google')params.code_verifier=flow.verifier;
  let sub;
  try{
    const options={redirect:'error',signal:AbortSignal.timeout(10000)};
    const response=await request(p.token,{...options,method:'POST',body:new URLSearchParams(params)});
    if(!response.ok)throw Error();
    const {id_token}=await response.json();
    const parts=id_token.split('.');
    if(parts.length!==3)throw Error();
    const decode=s=>JSON.parse(Buffer.from(s,'base64url'));
    const head=decode(parts[0]), claims=decode(parts[1]);
    if(head.alg!=='RS256'||typeof head.kid!=='string')throw Error();
    const keys=await request(p.keys,{...options,signal:AbortSignal.timeout(10000)});
    if(!keys.ok)throw Error();
    const jwk=(await keys.json()).keys.find(k=>k.kid===head.kid&&k.kty==='RSA');
    if(!jwk||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error();
    if(claims.iss!==p.issuer||claims.aud!==p.client||claims.nonce!==flow.nonce||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000||
      typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255)throw Error();
    sub=claims.sub;
  }catch{fail(401,'Provider verification failed');}
  return {id:transaction(db,()=>identity(db,name,sub,'کاربر سیماگل')),dest:flow.dest};
}
export function recoveryMailer(env=process.env){
  if(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM)return null;
  return async(to,url)=>{
    const result=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[to],subject:'SimaGol · بازیابی رمز عبور',text:'برای انتخاب رمز جدید تا ۱۵ دقیقه این پیوند را باز کنید.\n'+url})});
    if(!result.ok)throw Error('Mail delivery failed');
  };
}
export function requestReset(db,mail,email,origin){
  if(!mail)fail(503,'Password recovery unavailable');
  const row=db.prepare("SELECT id,email FROM users WHERE email=? AND password<>''").get(String(email||'').trim().toLowerCase());
  const now=Date.now();
  db.prepare('DELETE FROM password_resets WHERE expires<=?').run(now);
  if(row&&!db.prepare('SELECT 1 FROM password_resets WHERE userId=? AND expires>?').get(row.id,now+14*minute)){
    const secret=token();
    db.prepare('INSERT OR REPLACE INTO password_resets VALUES(?,?,?)').run(hash(secret),row.id,now+15*minute);
    Promise.resolve().then(()=>mail(row.email,origin+'/#account/reset/'+secret)).catch(()=>{db.prepare('DELETE FROM password_resets WHERE digest=?').run(hash(secret));});
  }
  return {ok:true};
}
export async function resetPassword(db,secret,password){
  const digest=hash(String(secret||''));
  if(!db.prepare('SELECT 1 FROM password_resets WHERE digest=? AND expires>?').get(digest,Date.now()))fail(400,'Reset link expired');
  const encoded=await passwordHash(password);
  transaction(db,()=>{
    const row=db.prepare('DELETE FROM password_resets WHERE digest=? AND expires>? RETURNING userId').get(digest,Date.now());
    if(!row)fail(400,'Reset link expired');
    db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded,row.userId);
    db.prepare('DELETE FROM sessions WHERE userId=?').run(row.userId);
  });
  return {ok:true};
}
