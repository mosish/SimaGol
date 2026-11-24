import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {openDb} from '../server/db.js';
import {getUser,login,newSession,register} from '../server/auth.js';
import {beginProvider,finishProvider,providerConfig,requestReset,requestSms,resetPassword,verifySms} from '../server/identity.js';

test('SMS sign-up and sign-in consume one challenge, throttle attempts and never trust a contact phone',async()=>{
  const db=openDb(':memory:');
  try{
    let code;
    const send=async(_phone,_kind,value)=>{code=value;};
    const phone='09121111111', now=Date.now();
    const request=await requestSms(db,send,{phone},now);
    assert.deepEqual(Object.keys(request),['challenge']);
    assert.throws(()=>verifySms(db,{...request,code:'000000'},now),/Invalid verification code/);
    const id=verifySms(db,{...request,code,register:true,name:'مریم'},now);
    assert.equal(getUser(db,newSession(db,id)).email,'');
    assert.throws(()=>verifySms(db,{...request,code},now),/Invalid verification code/);
    await assert.rejects(requestSms(db,send,{phone},now),/Try again later/);
    const next=await requestSms(db,send,{phone:'+989121111111'},now+61000);
    assert.equal(verifySms(db,{...next,code},now+61000),id);
    const expired=await requestSms(db,send,{phone},now+122000);
    assert.throws(()=>verifySms(db,{...expired,code},now+500000),/Invalid verification code/);
    await assert.rejects(requestSms(db,null,{phone}),/unavailable/);
  }finally{db.close();}
});

test('password reset consumes its email token once and revokes previous sessions',async()=>{
  const db=openDb(':memory:');
  try{
    const email='customer@example.test',user=await register(db,{email,password:'old-text-password',name:'Member'});
    const cookie=newSession(db,user.id);
    let url;
    requestReset(db,async(_to,link)=>{url=link;},email,'https://example.test');
    await Promise.resolve();
    const key=url.split('/').pop();assert.equal(key.length,43);
    await resetPassword(db,key,'a-fresh-secret-password');
    assert.equal(getUser(db,cookie),null);
    assert.equal((await login(db,{email,password:'a-fresh-secret-password'})).id,user.id);
    await assert.rejects(resetPassword(db,key,'another-new-password'),/expired/);
  }finally{db.close();}
});

test('Google and Apple callbacks bind the browser, nonce, signature and one-time state',async()=>{
  const db=openDb(':memory:');
  try{
    const providers=providerConfig({GOOGLE_CLIENT_ID:'google-id',GOOGLE_CLIENT_SECRET:'test',APPLE_CLIENT_ID:'apple-id',APPLE_CLIENT_SECRET:'test'});
    const pair=generateKeyPairSync('rsa',{modulusLength:2048});
    const jwk={...pair.publicKey.export({format:'jwk'}),kid:'one'};
    const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    for(const name of ['google','apple']){
      const origin='https://shop.example',p=providers[name];
      const start=beginProvider(db,providers,name,origin,'#checkout'), query=new URL(start.url).searchParams;
      query.set('code','test-code');
      const responder=async endpoint=>{
        if(endpoint===p.keys)return Response.json({keys:[jwk]});
        const data=enc({kid:'one',alg:'RS256'})+'.'+enc({sub:'subject',iss:p.issuer,aud:p.client,nonce:query.get('nonce'),exp:Date.now()/1000+30});
        return Response.json({id_token:data+'.'+sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url')});
      };
      await assert.rejects(finishProvider(db,providers,name,origin,query,'other',responder),/expired/);
      const verified=await finishProvider(db,providers,name,origin,query,start.browser,responder);
      assert.equal(verified.dest,'/#checkout');
      await assert.rejects(finishProvider(db,providers,name,origin,query,start.browser,responder),/expired/);
      const wrong=beginProvider(db,providers,name,origin,'#account');
      const tampered=new URL(wrong.url).searchParams;tampered.set('code','test-code');
      await assert.rejects(finishProvider(db,providers,name,origin,tampered,wrong.browser,responder),/verification failed/);
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM identities').get().n,2);
  }finally{db.close();}
});
