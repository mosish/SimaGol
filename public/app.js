import {appearanceControls,accountTheme} from './components/appearance.js';
import { $, state, t, label, persist, api, mascot, changeBag, selectedItems, stored } from './components/ui.js';
import { icon } from './components/icons.js';
import { setupInstall } from './components/install.js';
import { renderGreeting } from './components/greeting.js';
import { renderNavigation } from './components/navigation.js';
import { collection, product, bagView } from './components/store.js';
import { account, checkout, checkoutFields, invoice, orderList, notificationList, addressDetails, deliveryText } from './components/account.js';
import { showHomepage } from './components/home.js';
import {calendarSystem,readDate} from './components/calendar.js';

const modal=$('#panel');
const content=$('#panel-body');
let viewVersion=0;
let ready=false;
let offline=false;
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
  updateTabs();
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==='fa'?'rtl':'ltr';
  renderGreeting($('.brand small'), state.me?.name, state.lang, t('Customer greeting'));
  drawControls(state.lang);
  document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  $('.close').ariaLabel=t('Close');
  $('#search').ariaLabel=t('Search');$('#search').placeholder=t('Search');
  $('#hero-mascot').innerHTML=mascot('hero');
  $('.hero').hidden=state.settings.showHero===false;
  $('.hero-photo img').src='/'+(state.settings.hero||'images/hero.jpg');
  const logo=$('#logo');
  logo.hidden=!state.settings.logo;
  $('.seal').hidden=!logo.hidden;
  if(!logo.hidden) logo.src='/'+state.settings.logo;
  showHomepage();
  $('#calendar').textContent=calendarSystem()==='persian'?t('Solar calendar'):t('Gregorian calendar');
  collection();
}
function closeView() {
  const tab=activeTab(location.hash);
  history.replaceState(null,'',tab==='profile'?'#account':tab==='bag'?'#bag':'#catalog');
  route();
}
function activeTab(hash) {
  if (hash==='#bag'||hash==='#checkout') return 'bag';
  if (hash==='#bouquet') return 'bouquet';
  if (hash==='#account'||hash.startsWith('#account/')||hash.startsWith('#invoice/')) return 'profile';
  return 'home';
}
function updateTabs() {
  const quantity=Object.values(state.bag).filter(Number.isInteger).reduce((sum,count)=>sum+count,0);
  renderNavigation(activeTab(location.hash),state.lang,quantity);
}
async function route() {
  const version=++viewVersion;
  const h=location.hash;
  const tab=activeTab(h);
  updateTabs();
  const page=$('#tab-page');
  const profilePage=h==='#account'||h.startsWith('#account/');
  const isPage=h==='#bag'||profilePage||h==='#bouquet';
  page.classList.toggle('dashboard-page',profilePage && Boolean(state.me) && !offline);
  const entering=isPage && page.dataset.route!==h;
  page.dataset.route=h;
  $('#home-view').hidden=isPage;
  page.hidden=!isPage;
  if (isPage && modal.open) modal.close();
  if (entering) page.replaceChildren();
  if (!isPage) page.replaceChildren();
  if(!ready) return;
  if(['','#','#catalog','#favorites'].includes(h)){
    if(modal.open)modal.close();
    collection();
    return;
  }
  let html;
  try {
    if(offline && (tab==='profile'||h==='#checkout')) html='<p>'+label('Connect to shop')+'</p><button class="cta" data-retry>'+label('Retry')+'</button>';
    else if(h==='#bag') html=bagView();
    else if(h==='#checkout'){returnTo='#checkout';html=checkout();}
    else if(profilePage){returnTo=h;html=await account(...h.split('/').slice(1));}
    else if(h==='#bouquet') html='<section class="bouquet-teaser"><span class="bouquet-mark">'+icon('bouquet')+'</span><h2>'+label('Bouquet studio')+'</h2><strong>'+label('Coming soon')+'</strong><p>'+label('Bouquet studio description')+'</p><a class="cta" href="/">'+label('Browse flowers')+'</a></section>';

    else if(h.startsWith('#invoice/')) html=invoice(await api('orders/'+encodeURIComponent(h.slice(9))));
    else {
      const p=state.catalog.products.find(o=>h==='#product/'+o.id);
      html=p?product(p):mascot('404')+'<h2>'+label('Page not found')+'</h2>';
    }
  } catch(e) {html='<h2>'+label(e.message)+'</h2>';}
  if(version!==viewVersion) return;
  if(isPage) {
    content.replaceChildren();
    page.innerHTML=html;
    if (h==='#bag') {
      page.querySelector('h2').textContent=t('Shopping bag');
      if (!selectedItems().length) page.insertAdjacentHTML('beforeend','<p><a class="cta" href="/">'+label('Browse flowers')+'</a></p>');
    }
    if (entering) page.focus();
    return;
  }
  content.innerHTML=html+'<p role="status" id="panel-status"></p>';
  modal.ariaLabel=content.querySelector('h2')?.textContent||t('SimaGol');
  if(!modal.open) modal.showModal();
  if(h==='#checkout' && content.querySelector('[data-form="checkout"]')) checkoutFields(content.querySelector('form'));
}
async function refresh() {
  const [shop,me]=await Promise.all([api('store'),api('me')]);
  state.catalog=shop.catalog;state.settings=shop.settings;state.me=me;
  offline=false;
  persist('publicCatalog',shop.catalog);
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
  accountTheme(me?.prefs);
  ready=true;appearance();
}
const drawControls=appearanceControls(async prefs=>{
  state.lang=prefs.lang;appearance();await route();
  if(state.me)try{await api('profile','POST',{prefs});}catch(e){notify(t(e.message));}
});
$('#calendar').onclick=()=>{localStorage.setItem('simagol.calendar',calendarSystem()==='persian'?'gregory':'persian');appearance();route();};
$('#favorites').onclick=()=>{state.category='all';$('#search').value='';location.hash=location.hash==='#favorites'?'catalog':'favorites';$('#catalog').scrollIntoView();collection();};
setupInstall($('#install-app'),(fa,en)=>notify(state.lang==='fa'?fa:en));
$('.close').onclick=closeView;
modal.oncancel=e=>{e.preventDefault();closeView();};
$('#search').oninput=collection;
window.addEventListener('hashchange',route);

async function act(b) {
  if (b.dataset.readNotices) {
    await api('notifications/read','POST',{through:Number(b.dataset.readNotices)});
    const notices=await api('notifications');
    if($('#notices')) $('#notices').innerHTML=notificationList(notices);
    return;
  }
  if (b.hasAttribute('data-default-address')) {
    const rows=[...state.me.addresses], index=Number(b.dataset.defaultAddress);
    if(index<1||index>=rows.length)return;
    rows.unshift(rows.splice(index,1)[0]);
    await api('profile','POST',{addresses:rows});await refresh();await route();return;
  }
  if (b.hasAttribute('data-delete-address')) {
    if (!confirm(t('Delete address?'))) return;
    const addresses=state.me.addresses.filter((_,i)=>i!==Number(b.dataset.deleteAddress));
    await api('profile','POST',{addresses});await refresh();await route();return;
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
    await api('logout','POST',{});localStorage.removeItem('simagol.planner.viewer');await refresh();location.hash='account';await route();return;
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
    if(e.target.name==='saved'){
      const a=addressDetails(e.target.value===''?'':state.me.addresses[Number(e.target.value)]);
      f.elements.address.value=deliveryText(a);
      f.elements.phone.value=a.phone||state.me.prefs?.contact?.phone||'';
      f.elements.recipient.value=a.recipient||state.me.name;
    }
    checkoutFields(f);
  }
});

async function submit(form) {
  const k=form.dataset.form;
  const data=Object.fromEntries(new FormData(form));
  for(const el of form.querySelectorAll('[type=checkbox]'))data[el.name]=el.checked;
  if(k==='Register'||k==='Login'){
    await api(k.toLowerCase(),'POST',data);
    await refresh();if(location.hash==='#account/planner-login'){location.assign('/planner/');return;}if(location.hash!==returnTo)location.hash=returnTo;
  } else if(k==='profile'){
    const {name,...contact}=data;
    if(contact.birthday){contact.birthday=readDate(contact.birthday);if(!contact.birthday)throw new Error('Invalid date');}
    await api('profile','POST',{name,contact});location.hash='account/personal';
    await refresh();
  } else if(k==='referral'){
    await api('profile','POST',{contact:{referral:data.referral}});
    await refresh();
  } else if(k==='address'){
    const addresses=[...state.me.addresses];
    const index=Number(data.index);
    delete data.index;
    if(index===-1) addresses.push(data);
    else addresses[index]=data;
    await api('profile','POST',{addresses});location.hash='account/addresses';
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
  const path=location.hash;
  if(document.hidden||!state.me)return;
  const history=$('#history'), notices=$('#notices');
  try {
    if(history) {
      const rows=await api('orders');
      if(location.hash===path && history.isConnected) history.innerHTML=orderList(rows,path.split('/')[2]);
    } else if(notices) {
      const items=await api('notifications');
      if(location.hash===path && notices.isConnected) notices.innerHTML=notificationList(items);
    }
  }catch{ /* Keep the last successful update. */ }
},15000);
async function boot() {
  if(!['/','/index.html'].includes(location.pathname) && !location.hash)history.replaceState(null,'','/#missing');
  try {
    const r=await fetch('/labels.json');if(!r.ok)throw new Error();
    state.dict=await r.json();state.settings.mascot=stored('mascot',{});
    appearance();$('#products').innerHTML=mascot('loading')+label('Loading flowers');
    await refresh();$('#feedback').replaceChildren();await route();
  }catch{
    const cached=stored('publicCatalog',null);
    if(cached && Array.isArray(cached.products) && Array.isArray(cached.categories)) state.catalog=cached;
    offline=true;state.me=null;ready=true;appearance();await route();
    $('#feedback').innerHTML=label('Connect to shop')+' <button data-retry>'+label('Retry')+'</button>';
  }
}
window.addEventListener('online',boot);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/planner/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
boot();
