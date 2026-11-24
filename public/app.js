import { $, state, t, label, esc, num, persist, api, mascot, changeBag, selectedItems, stored } from './components/ui.js';
import { icon } from './components/icons.js';
import { collection, product, bagView } from './components/store.js';
import { account, checkout, checkoutFields, invoice, orderCard, notificationList } from './components/account.js';
import { showHomepage } from './components/home.js';
import { admin } from './components/admin.js';

const modal=$('#panel');
const content=$('#panel-body');
let viewVersion=0;
let ready=false;
let returnTo='#account';
let idempotency=stored('lastCheckout',{});
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  const out=modal.open?$('#panel-status'):$('#feedback');
  out.textContent=message;
  toastTimer=setTimeout(()=>{out.textContent='';},6500);
}
function appearance() {
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==='fa'?'rtl':'ltr';
  document.documentElement.classList.toggle('dark',state.dark);
  document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  $('#language').textContent=state.lang==='fa'?'EN':'FA';
  $('#language').ariaLabel=state.lang==='fa'?'English':'فارسی';
  $('#theme').ariaLabel=t('Switch theme');
  $('#theme').setAttribute('aria-pressed',String(state.dark));
  $('#theme').innerHTML=icon(state.dark?'sun':'moon');
  $('.close').ariaLabel=t('Close');
  $('#search').ariaLabel=t('Search');$('#search').placeholder=t('Search');
  $('#bag').ariaLabel=t('Shopping bag');
  $('#count').textContent=num(Object.values(state.bag).filter(Number.isInteger).reduce((a,b)=>a+b,0));
  $('#hero-mascot').innerHTML=mascot('hero');
  $('.hero').hidden=state.settings.showHero===false;
  $('.hero-photo img').src='/'+(state.settings.hero||'images/hero.jpg');
  const logo=$('#logo');
  logo.hidden=!state.settings.logo;
  $('.seal').hidden=!logo.hidden;
  if(!logo.hidden) logo.src='/'+state.settings.logo;
  showHomepage();
  $('#staff-link').hidden=!state.me||state.me.role==='customer';
  collection();
}
function closeView() {
  history.replaceState(null,'','#catalog');
  if(modal.open) modal.close();
  collection();
}
async function route() {
  const version=++viewVersion;
  const h=location.hash;
  if(!ready) return;
  if(['','#','#catalog','#favorites'].includes(h)){
    if(modal.open)modal.close();
    collection();
    return;
  }
  let html;
  try {
    if(h==='#bag') html=bagView();
    else if(h==='#checkout'){returnTo='#checkout';html=checkout();}
    else if(h==='#account'){returnTo='#account';html=await account();}
    else if(h==='#admin') html=await admin();
    else if(h.startsWith('#invoice/')) html=invoice(await api('orders/'+encodeURIComponent(h.slice(9))));
    else {
      const p=state.catalog.products.find(o=>h==='#product/'+o.id);
      html=p?product(p):mascot('404')+'<h2>'+label('Page not found')+'</h2>';
    }
  } catch(e) {html='<h2>'+label(e.message)+'</h2>';}
  if(version!==viewVersion) return;
  content.innerHTML=html+'<p role="status" id="panel-status"></p>';
  modal.ariaLabel=content.querySelector('h2')?.textContent||t('SimaGol');
  if(!modal.open) modal.showModal();
  if(h==='#checkout' && content.querySelector('[data-form="checkout"]')) checkoutFields(content.querySelector('form'));
}
async function refresh() {
  const [shop,me]=await Promise.all([api('store'),api('me')]);
  state.catalog=shop.catalog;state.settings=shop.settings;state.me=me;
  persist('mascot',shop.settings.mascot);
  const bag={};
  for(const p of state.catalog.products) {
    const qty=state.bag[p.id];
    if(Number.isInteger(qty)&&qty>0&&p.stock>0)bag[p.id]=Math.min(p.stock,qty);
  }
  state.bag=bag;persist('bag',bag);
  state.favorites=me ? (me.prefs?.favorites || []) : stored('favorites',[]);
  if(!Array.isArray(state.favorites))state.favorites=[];
  if(me?.prefs?.lang)state.lang=me.prefs.lang;
  if(typeof me?.prefs?.dark==='boolean')state.dark=me.prefs.dark;
  ready=true;appearance();
}
async function preference() {
  persist('lang',state.lang);persist('dark',state.dark);
  appearance();await route();
  if(state.me) await api('profile','POST',{prefs:{lang:state.lang,dark:state.dark}});
}
$('#language').onclick=()=>{state.lang=state.lang==='fa'?'en':'fa';preference().catch(e=>notify(t(e.message)));};
$('#theme').onclick=()=>{state.dark=!state.dark;preference().catch(e=>notify(t(e.message)));};
$('#favorites').onclick=()=>{state.category='all';$('#search').value='';location.hash='favorites';$('#catalog').scrollIntoView();collection();};
$('#bag').onclick=()=>location.hash='bag';
$('.close').onclick=closeView;
modal.oncancel=e=>{e.preventDefault();closeView();};
$('#search').oninput=collection;
window.addEventListener('hashchange',route);

async function act(b) {
  if (b.dataset.readNotices) {
    await api('notifications/read','POST',{through:Number(b.dataset.readNotices)});
    const notices=await api('notifications');
    if(location.hash==='#account' && $('#notices')) $('#notices').innerHTML=notificationList(notices);
    return;
  }
  if(b.dataset.filter){state.category=b.dataset.filter;collection();return;}
  if(b.dataset.fav){
    const id=b.dataset.fav;
    const favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];
    if(state.me)await api('profile','POST',{prefs:{favorites}});
    else persist('favorites',favorites);
    state.favorites=favorites;collection();
    document.querySelector('[data-fav="'+CSS.escape(id)+'"]')?.focus();return;
  }
  if(b.dataset.add||b.dataset.sub){
    changeBag(b.dataset.add||b.dataset.sub,b.dataset.add?1:-1);appearance();
    if(location.hash==='#bag')await route();else location.hash='bag';return;
  }
  if(b.hasAttribute('data-logout')){
    await api('logout','POST',{});await refresh();location.hash='account';await route();return;
  }
  if(b.dataset.reorder){
    const o=await api('orders/'+b.dataset.reorder);await refresh();
    for(const i of o.items)changeBag(i.id,i.qty);
    appearance();location.hash='bag';return;
  }
  if(b.hasAttribute('data-print'))window.print();
  if(b.hasAttribute('data-retry'))boot();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(b)act(b).catch(err=>notify(t(err.message)));
});
document.addEventListener('change',e=>{
  const f=e.target.closest('form');
  if(!f)return;
  if(f.dataset.form==='checkout'){
    if(e.target.name==='saved'&&e.target.value!=='')f.elements.address.value=state.me.addresses[Number(e.target.value)];
    checkoutFields(f);
  }
  if(f.dataset.form==='copy'&&e.target.name==='key'){
    const pair=state.settings.copy[e.target.value]||state.dict[e.target.value];
    f.elements.copyFa.value=pair.fa;f.elements.copyEn.value=pair.en;
  }
});

function fileData(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(new Error('Invalid image'));
    reader.readAsDataURL(file);
  });
}
async function submit(form) {
  const k=form.dataset.form;
  const data=Object.fromEntries(new FormData(form));
  for(const el of form.querySelectorAll('[type=checkbox]'))data[el.name]=el.checked;
  if(k==='Register'||k==='Login'){
    await api(k.toLowerCase(),'POST',data);
    await refresh();if(location.hash!==returnTo)location.hash=returnTo;
  } else if(k==='profile'){
    await api('profile','POST',{name:data.name,addresses:data.addresses.split('\n').map(s=>s.trim()).filter(Boolean)});
    await refresh();
  } else if(k==='checkout'){
    if(!form.reportValidity())return;
    const items=selectedItems().map(p=>({id:p.id,qty:state.bag[p.id]}));
    const expectedTotal=selectedItems().reduce((n,p)=>n+p.priceIrr*state.bag[p.id],0)+state.settings.delivery[data.method].fee+(data.wrap?state.settings.wrapFee:0);
    delete data.saved;
    const fingerprint=JSON.stringify([state.me.id,items,data,expectedTotal]);
    // Retain only a digest of recipient details for a safe retry after a network failure.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint));
    const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    if(idempotency?.digest!==digest)idempotency={digest,key:crypto.randomUUID()};
    persist('lastCheckout',idempotency);
    const o=await api('orders','POST',{...data,slot:data.slot||'',items,expectedTotal,key:idempotency.key});
    state.bag={};persist('bag',{});idempotency={};persist('lastCheckout',{});
    location.hash='invoice/'+o.id;await refresh();
  } else if(k==='upload'){
    if(data.file.size>2097152)throw new Error('File too large');
    const out=await api('admin/upload','POST',{data:await fileData(data.file)});
    $('#upload-path').textContent=out.path;return;
  } else {
    await api('admin/'+k,'POST',data);await refresh();
  }
  await route();
}
document.addEventListener('submit',async e=>{
  const form=e.target;if(!form.dataset.form)return;
  e.preventDefault();
  const button=form.querySelector('[type=submit]');
  if(button.disabled)return;
  button.disabled=true;
  try {await submit(form);}
  catch(error){
    if(form.dataset.form==='checkout' && ['Price changed','Stock unavailable','Time slot unavailable','Delivery unavailable'].includes(error.message)){
      try {await refresh();await route();} catch {}
    }
    notify(t(error.message));
  }
  finally {button.disabled=false;}
});
setInterval(async()=>{
  if(document.hidden||!state.me||location.hash!=='#account'||!$('#history'))return;
  try {
    const [rows,notices]=await Promise.all([api('orders'),api('notifications')]);
    if(location.hash==='#account' && $('#notices')) $('#notices').innerHTML=notificationList(notices);
    if(location.hash==='#account'&&$('#history'))$('#history').innerHTML=rows.map(o=>orderCard(o)).join('')||label('No orders yet');
  }catch{ /* Keep the last known order history until the next successful read. */ }
},15000);
async function boot() {
  if(!['/','/index.html'].includes(location.pathname) && !location.hash)history.replaceState(null,'','/#missing');
  try {
    const r=await fetch('/labels.json');if(!r.ok)throw new Error();
    state.dict=await r.json();state.settings.mascot=stored('mascot',{});
    appearance();$('#products').innerHTML=mascot('loading')+label('Loading flowers');
    await refresh();await route();
  }catch{$('#products').innerHTML='<div class="empty">'+label('Service unavailable')+' <button data-retry>'+label('Retry')+'</button></div>';}
}
boot();
