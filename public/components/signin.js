import {state,t,label,esc,api} from './ui.js';
import {icon} from './icons.js';

const symbols={
  google:'<path fill="#4285f4" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3-4.5 3-7.6Z"/><path fill="#34a853" d="M12 22c2.8 0 5.2-.9 6.8-2.5l-3.4-2.6c-.9.6-2 .9-3.4.9-2.7 0-5-1.8-5.8-4.2H2.7v2.7A10.3 10.3 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.2 13.6a6 6 0 0 1 0-3.4V7.5H2.7a10 10 0 0 0 0 8.8z"/><path fill="#ea4335" d="M12 6c1.6 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10.3 10.3 0 0 0-9.3 5.5l3.5 2.7C7 7.8 9.3 6 12 6Z"/>',
  apple:'<path fill="currentColor" d="M16.4 1c.2 1.5-.5 2.8-1.3 3.7-.9 1-2.2 1.6-3.4 1.4-.2-1.4.5-2.8 1.3-3.7.9-.9 2.3-1.5 3.4-1.4ZM20.4 17c-.4 1-1 2.1-1.8 3.2-.9 1.2-1.9 2.6-3.3 2.6-1.3.1-1.8-.8-3.5-.8-1.6 0-2.2.8-3.4.8-1.3 0-2.3-1.2-3.3-2.6C2.6 16.8 1.8 11 4.2 8.2 5.4 6.8 7 6 8.8 6c1.5 0 2.5.9 3.6.9s2.6-1 4.1-1c1.4 0 2.9.6 4 2-3.5 2-3.7 6.7-.1 9.1Z"/>',
  sms:'<path d="m7 3 2.4 4.3-2 2.4a15 15 0 0 0 6.9 6.9l2.4-2L21 17c.3 2.6-1.3 4.5-3.8 4C10.3 19.6 4.5 13.8 3 6.8 2.5 4.3 4.4 2.7 7 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>'
};
const glyph=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+symbols[k]+'</svg>';
const methods=()=>state.settings.authMethods||{};
function input(name,key,type,attrs){
  return '<label class="auth-field"><span>'+label(key)+'</span><input name="'+name+'" type="'+type+'" '+attrs+' required></label>';
}
function contents(register,method,challenge=''){
  const base=register?'Register':'Login';
  const recovery=method==='forgot'||method==='reset',sms=method==='sms';
  const title=recovery?(method==='forgot'?'Forgot password':'Choose new password'):register?'Create account':'Welcome back';
  const action=method==='reset'?'Save new password':method==='forgot'?'Send reset link':sms?(challenge?'Verify code':'Send code'):base;
  const providers=['apple','google','sms'].map(k=>{
    const key={apple:'Continue with Apple',google:'Continue with Google',sms:'Continue with mobile'}[k];
    return '<button type="button" data-provider="'+k+'" title="'+label(key)+'" aria-label="'+label(key)+'">'+glyph(k)+'</button>';
  }).join('');
  const locked=sms&&!methods().sms||method==='forgot'&&!methods().recovery;
  return '<div class="auth-face"><div class="auth-intro"><i>'+icon('flower')+'</i><h2>'+label(title)+'</h2></div>'+
    (method==='email'?'<div class="auth-providers" dir="ltr">'+providers+'</div><div class="auth-divider">'+label('or')+'</div>':'')+
    '<form data-form="'+base+'" data-method="'+method+'" data-challenge="'+esc(challenge)+'">'+
    (register&&!recovery?input('name','Name','text','autocomplete="name" maxlength="120"'):'')+
    (method==='email'||method==='forgot'?input('email','Email','email','dir="ltr" autocomplete="email" maxlength="254"'):'')+
    (sms?input('phone','Mobile number','tel','dir="ltr" autocomplete="tel" maxlength="16"'):'')+
    (sms&&challenge?input('code','Verification code','text','dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6"'):'')+
    (method==='email'||method==='reset'?'<div class="auth-password">'+input('password',method==='reset'?'Choose new password':'Password','password',
      'autocomplete="'+(register||recovery?'new-password':'current-password')+'" '+(register||recovery?'minlength="12"':''))+
      '<button type="button" data-auth="reveal" aria-label="'+label('Show password')+'" aria-pressed="false">'+glyph('eye')+'</button></div>':'')+
    ((register||method==='reset')&&!sms?'<small>'+label('Use at least 12 characters')+'</small>':'')+
    (!recovery?'<div class="auth-options"><label><input type="checkbox" name="remember">'+label('Remember me')+'</label>'+
      (!register&&!sms?'<button type="button" data-auth="forgot">'+label('Forgot password')+'</button>':'')+'</div>':'')+
    '<p class="auth-status" role="status">'+(locked?label(sms?'SMS sign-in unavailable':'Password recovery unavailable'):'')+'</p>'+
    '<button class="cta" type="submit" '+(locked?'disabled':'')+'>'+label(action)+'</button></form></div>'+
    '<div class="auth-footer">'+(method==='email'?label(register?'Already registered?':'New to SimaGol?')+' ':'')+
    '<button type="button" data-auth="'+(method==='email'?(register?'login':'register'):'email')+'">'+
    label(method==='email'?(register?'Login':'Register'):'Back to email')+'</button></div>';
}
export function auth(){
  const hash=globalThis.location?.hash||'';
  return '<section class="auth-card">'+contents(false,hash.startsWith('#account/reset/')?'reset':'email')+
    (hash==='#account/provider-error'?'<p role="alert">'+label('Provider verification failed')+'</p>':'')+'</section>';
}
function change(card,register,method,challenge){
  const f=card.querySelector('form'),from=card.offsetHeight;
  const values=new FormData(f);
  card.innerHTML=contents(register,method,challenge);
  const form=card.querySelector('form');
  for(const key of ['email','name','phone'])if(form.elements[key]&&values.has(key))form.elements[key].value=values.get(key);
  if(form.elements.remember)form.elements.remember.checked=values.has('remember');
  if(challenge)form.elements.phone.readOnly=true;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    card.animate([{height:from+'px'},{height:card.offsetHeight+'px'}],{duration:250,easing:'ease-out'});
  }
  const target=card.querySelector('h2');target.tabIndex=-1;target.focus({preventScroll:true});
}
export async function authClick(button){
  const card=button.closest('.auth-card'),form=card.querySelector('form');
  const register=form.dataset.form==='Register',action=button.dataset.auth,provider=button.dataset.provider;
  if(provider==='sms')return change(card,register,'sms');
  if(provider){
    if(!methods()[provider]){card.querySelector('.auth-status').textContent=t('Sign-in method unavailable');return;}
    const {url}=await api('identity/provider','POST',{provider,back:location.hash});location.assign(url);return;
  }
  if(action==='reveal'){
    const pwd=form.elements.password,show=pwd.type==='password';
    pwd.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.ariaLabel=t(show?'Hide password':'Show password');return;
  }
  change(card,action==='register'||(action==='email'&&register),action==='forgot'?'forgot':'email');
}
export async function sendAuth(form,data){
  const method=form.dataset.method,card=form.closest('.auth-card');
  if(method==='sms'){
    if(!form.dataset.challenge){
      const result=await api('identity/sms/request','POST',{phone:data.phone});
      if(form.isConnected)change(card,form.dataset.form==='Register','sms',result.challenge);
      return false;
    }
    const code=data.code.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
    await api('identity/sms/verify','POST',{...data,code,challenge:form.dataset.challenge,register:form.dataset.form==='Register'});
  }else if(method==='forgot'){
    await api('identity/forgot','POST',{email:data.email});
    card.querySelector('.auth-status').textContent=t('Check recovery email');return false;
  }else if(method==='reset'){
    await api('identity/reset','POST',{token:location.hash.split('/').pop(),password:data.password});
    state.me=null;history.replaceState(null,'','/#account');change(card,false,'email');
    card.querySelector('.auth-status').textContent=t('Password updated');return false;
  }else await api(form.dataset.form.toLowerCase(),'POST',data);
  return true;
}
