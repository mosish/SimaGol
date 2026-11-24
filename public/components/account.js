import {dateLocale,inputDate,calendarSystem} from './calendar.js';
import {state,esc,t,label,price,field,button,select,selectedItems,api,num} from './ui.js';
import {icon} from './icons.js';
import {auth} from './signin.js';
function openSlots() {
  return state.settings.slots.filter(slot => Date.parse(slot.ends) > Date.now() && slot.booked < slot.capacity);
}
export function checkout() {
  if(!state.me) return auth();
  if(!state.settings.ordersEnabled) return '<h2>'+label('Ordering is closed')+'</h2>';
  if(!selectedItems().length) return '<h2>'+label('Your bag is empty')+'</h2>';
  const methods=Object.entries(state.settings.delivery).filter(([id,v])=>v.enabled && (id!=='scheduled' || openSlots().length));
  if(!methods.length) return '<p>'+label('Delivery unavailable')+'</p>';
  const saved=addressDetails(state.me.addresses[0]||'');
  return '<h2>'+label('Checkout')+'</h2><form data-form="checkout">'+field('recipient','Recipient',saved.recipient||state.me.name)+field('phone','Phone',saved.phone||state.me.prefs?.contact?.phone||'','tel')+
    select('saved','Address book',[['',t('Enter an address')],...state.me.addresses.map((a,i)=>[String(i),deliveryText(a)])],state.me.addresses.length?'0':'')+
    field('address','Delivery address',deliveryText(saved))+select('method','Delivery',methods.map(([id,v])=>[id,t(id)+' · '+price(v.fee)]))+
    '<div id="slot-field"></div><label><input type="checkbox" name="wrap"> '+label('Gift wrap')+' · '+esc(price(state.settings.wrapFee))+'</label>'+
    field('message','Card message','','text',false)+'<p>'+label('Payment on delivery')+'</p><strong id="checkout-total"></strong>'+button('Place order')+'</form>';
}
export function checkoutFields(form) {
  const method=form.elements.method.value;
  const slot=document.querySelector('#slot-field');
  if(method==='scheduled' && !form.elements.slot) slot.innerHTML=select('slot','Time slot',openSlots().map(s=>[s.id,s.label[state.lang]]));
  if(method!=='scheduled') slot.innerHTML='';
  const total=selectedItems().reduce((n,p)=>n+p.priceIrr*state.bag[p.id],0)+state.settings.delivery[method].fee+(form.elements.wrap.checked?state.settings.wrapFee:0);
  document.querySelector('#checkout-total').textContent=t('Total')+' · '+price(total);
}
export function orderCard(o,staff=false) {
  return '<article class="order"><h3>#'+esc(o.id.slice(0,8))+' · '+label(o.status)+'</h3><p><bdi>'+esc(new Intl.DateTimeFormat(dateLocale(state.lang),{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(o.created)))+'</bdi> · '+esc(price(o.total))+'</p>'+
    (staff?'<p>'+esc(o.recipient)+' · '+esc(o.phone)+'<br>'+esc(o.address)+'</p>':'')+
    '<a href="#invoice/'+esc(o.id)+'">'+label('Invoice')+'</a> '+(staff?'':'<button data-reorder="'+esc(o.id)+'">'+label('Reorder')+'</button>')+'</article>';
}
export function notificationList(notices) {
  if (!notices.length) return '<p>'+label('No notifications yet')+'</p>';
  const format = new Intl.DateTimeFormat(dateLocale(state.lang), {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran'
  });
  const entries = notices.map(n => '<li><a href="#invoice/'+esc(n.orderId)+'"><bdi>#'+
    esc(n.orderId.slice(0,8))+'</bdi></a> · '+label(n.status)+' · <time datetime="'+
    esc(n.created)+'">'+esc(format.format(new Date(n.created)))+'</time>'+
    (n.seen?'':' <strong>'+label('Unread')+'</strong>')+'</li>');
  const action = notices.some(n=>!n.seen) ? '<button data-read-notices="'+esc(notices[0].id)+'">'+
    label('Mark all as read')+'</button>' : '';
  return '<ul>'+entries.join('')+'</ul>'+action;
}
const sections = [
  ['wallet','Wallet','wallet'], ['orders','My orders','orders'], ['addresses','My addresses','pin'],
  ['favorites','Favorites','bookmark'], ['notifications','Notifications','bell']
];
const statuses=['placed','preparing','shipped','delivered','cancelled'];
export function addressDetails(value) { return typeof value==='string'?{address:value}:value; }
export function deliveryText(value) {
  const a=addressDetails(value);
  return [a.city,a.address,a.postal].filter(Boolean).join('، ');
}
function detailCell(title,value) {
  return '<div><dt>'+label(title)+'</dt><dd><bdi>'+esc(value||'—')+'</bdi></dd></div>';
}
function panelHeading(title,action='',count='') {
  return '<div class="account-heading"><h2>'+label(title)+(count?' <small>'+esc(count)+'</small>':'')+'</h2>'+action+'</div>';
}
function actionLink(href,title,glyph) {
  return '<a class="account-action" href="'+href+'">'+icon(glyph)+label(title)+'</a>';
}
function personalPanel(mode) {
  const {name,email,prefs}=state.me, c=prefs?.contact||{};
  if(mode==='edit') return panelHeading('Edit details')+'<form class="contact-form" data-form="profile">'+
    field('name','Name',name)+field('family','Family name',c.family,'text',false)+field('phone','Mobile number',c.phone,'tel',false)+
    field('birthday',calendarSystem()==='persian'?'Solar birthday':'Gregorian birthday',inputDate(c.birthday),'text',false)+field('city','City',c.city,'text',false)+
    '<div class="form-actions">'+button('Save')+'<a href="#account/personal">'+label('Cancel edit')+'</a></div></form>';
  const birthday=c.birthday?new Intl.DateTimeFormat(dateLocale(state.lang),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(c.birthday)):'';
  return panelHeading('Personal details',actionLink('#account/personal/edit','Edit details','edit'))+
    '<dl class="profile-fields">'+detailCell('Name',name)+detailCell('Family name',c.family)+detailCell('Mobile number',c.phone)+
    detailCell('Birthday',birthday)+detailCell('Email',email)+detailCell('City',c.city)+'</dl>'+
    '<section class="account-block"><h3>'+label('Referral code')+'</h3><form class="referral-form" data-form="referral"><input aria-label="'+label('Referral code')+'" maxlength="40" name="referral" value="'+esc(c.referral)+'">'+button('Save')+'</form></section>';
}
function addressForm(index,a) {
  return '<form class="contact-form" data-form="address"><input type="hidden" name="index" value="'+index+'">'+
    field('title','Address title',a.title,'text',false)+field('city','City',a.city,'text',false)+
    field('recipient','Recipient',a.recipient,'text',false)+field('phone','Mobile number',a.phone,'tel',false)+field('postal','Postal code',a.postal,'text',false)+
    '<label class="wide">'+label('Delivery address')+'<textarea name="address" maxlength="500" required>'+esc(a.address)+'</textarea></label>'+
    '<div class="form-actions">'+button('Save')+'<a href="#account/addresses">'+label('Cancel edit')+'</a></div></form>';
}
function addressPanel(mode) {
  const rows=state.me.addresses.map(addressDetails);
  if(mode==='new') return panelHeading('Add address')+addressForm(-1,{});
  const match=/^edit-(\d+)$/.exec(mode);
  if(match && rows[Number(match[1])]) return panelHeading('Edit address')+addressForm(Number(match[1]),rows[Number(match[1])]);
  return panelHeading('My addresses',actionLink('#account/addresses/new','Add address','plus'),'('+num(rows.length)+')')+
    (rows.map((a,i)=>'<article class="address-card"><div class="address-bar"><strong>'+esc(a.title||a.city||t('Delivery address'))+'</strong>'+
      (i===0?'<span class="default-address">'+label('Default address')+'</span>':'')+'<div class="address-actions">'+
      actionLink('#account/addresses/edit-'+i,'Edit','edit')+'<button class="danger-link" data-delete-address="'+i+'">'+icon('trash')+label('Remove')+'</button></div></div>'+
      '<p>'+esc(a.address)+'</p><dl class="address-meta">'+detailCell('City',a.city)+detailCell('Postal code',a.postal)+detailCell('Recipient',a.recipient)+detailCell('Phone',a.phone)+'</dl>'+
      (i>0?'<button class="default-action" data-default-address="'+i+'">'+label('Make default')+'</button>':'')+'</article>').join('')||
      '<div class="profile-empty">'+icon('pin')+'<p>'+label('No saved addresses')+'</p></div>');
}
export function orderList(rows,filter) {
  const filtered=statuses.includes(filter)?rows.filter(o=>o.status===filter):rows;
  return filtered.map(o=>orderCard(o)).join('')||'<p class="profile-empty">'+icon('orders')+label('No matching orders')+'</p>';
}
function orderPanel(rows,filter) {
  const chips=['all',...statuses].map(s=>'<a class="chip" '+(filter===s?'aria-current="true" ':'')+'href="#account/orders/'+s+'">'+label(s==='all'?'All orders':s)+'</a>').join('');
  return '<nav class="order-filters" aria-label="'+label('My orders')+'">'+chips+'</nav><section id="history">'+orderList(rows,filter)+'</section>';
}
function savedFlowers() {
  const products=state.catalog.products.filter(p=>state.favorites.includes(p.id));
  return products.map(p=>'<a class="saved-flower" href="#product/'+esc(p.id)+'"><img src="/'+esc(p.image)+'" alt=""><span>'+esc(p.name[state.lang])+'</span><b>'+esc(price(p.priceIrr))+'</b></a>').join('') || '<p>'+label('No saved flowers')+'</p><a href="/">'+label('Browse flowers')+'</a>';
}
export async function account(section='personal',mode='') {
  if(!state.me) return auth();
  const current=sections.find(([key])=>key===section)||['personal','Personal details','profile'];
  const contact=state.me.prefs?.contact||{};
  let panel;
  switch(current[0]) {
    case 'orders': panel=panelHeading('My orders')+orderPanel(await api('orders'),statuses.includes(mode)?mode:'all');break;
    case 'notifications': panel=panelHeading(current[1])+'<section class="account-block" id="notices">'+notificationList(await api('notifications'))+'</section>';break;
    case 'addresses': panel=addressPanel(mode);break;
    case 'favorites': panel=panelHeading(current[1])+'<div class="account-block">'+savedFlowers()+'</div>';break;
    case 'wallet': panel=panelHeading(current[1])+'<div class="account-block wallet-info">'+icon('wallet')+'<p>'+label('Wallet status')+'</p></div>';break;
    default: panel=personalPanel(mode);
  }
  const links=sections.map(([key,title,glyph])=>'<a '+(key===current[0]?'aria-current="page" ':'')+'href="#account/'+key+'">'+icon(glyph)+'<span>'+label(title)+'</span>'+icon('chevron')+'</a>').join('');
  return '<div class="profile-dashboard"><aside class="profile-menu"><a class="customer-id" href="#account/personal" '+(current[0]==='personal'?'aria-current="page"':'')+'>'+
    '<strong>'+esc([state.me.name,contact.family].filter(Boolean).join(' '))+'</strong>'+icon('chevron')+'</a>'+
    '<div class="identity-line"><bdi>'+esc(contact.phone||state.me.email)+'</bdi><span>'+label('Customer account')+'</span></div>'+
    '<nav aria-label="'+label('Account')+'">'+links+'</nav><button class="account-exit" data-logout>'+icon('logout')+label('Log out')+'</button></aside>'+
    '<section class="profile-content">'+panel+'</section></div>';
}
export function invoice(o) {
  return '<div class="invoice"><h2>'+label('Invoice')+' · SimaGol</h2><p><bdi>'+esc(o.id)+'</bdi> · '+label(o.status)+'</p><p>'+esc(o.recipient)+' · '+esc(o.address)+'</p>'+
    o.items.map(i=>'<div class="item-row"><span>'+esc(i.name[state.lang])+' × '+num(i.qty)+'</span><b>'+esc(price(i.unit*i.qty))+'</b></div>').join('')+
    '<p>'+label(o.method)+' · '+esc(price(o.deliveryFee))+' '+esc(o.slotLabel?.[state.lang]||'')+'</p><p>'+label('Gift wrap')+' · '+esc(price(o.wrapFee))+'</p><p>'+esc(o.message)+'</p>'+
    '<strong>'+label('Total')+' · '+esc(price(o.total))+'</strong><p>'+label('Payment on delivery')+'</p><button data-print>'+label('Print')+'</button></div>';
}
