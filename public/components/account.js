import {state,esc,t,label,price,field,button,select,selectedItems,api,num} from './ui.js';
export function auth() {
  return '<h2>'+label('Account')+'</h2>'+['Login','Register'].map(k=>'<details '+(k==='Login'?'open':'')+'><summary>'+label(k)+'</summary><form data-form="'+k+'">'+
    (k==='Register'?field('name','Name'):'')+field('email','Email','','email')+field('password','Password','','password')+'<small>'+label('Use at least 12 characters')+'</small>'+button(k)+'</form></details>').join('');
}
function openSlots() {
  return state.settings.slots.filter(slot => Date.parse(slot.ends) > Date.now() && slot.booked < slot.capacity);
}
export function checkout() {
  if(!state.me) return auth();
  if(!state.settings.ordersEnabled) return '<h2>'+label('Ordering is closed')+'</h2>';
  if(!selectedItems().length) return '<h2>'+label('Your bag is empty')+'</h2>';
  const methods=Object.entries(state.settings.delivery).filter(([id,v])=>v.enabled && (id!=='scheduled' || openSlots().length));
  if(!methods.length) return '<p>'+label('Delivery unavailable')+'</p>';
  return '<h2>'+label('Checkout')+'</h2><form data-form="checkout">'+field('recipient','Recipient',state.me.name)+field('phone','Phone','','tel')+
    select('saved','Address book',[['',t('Enter an address')],...state.me.addresses.map((a,i)=>[String(i),a])])+
    field('address','Delivery address')+select('method','Delivery',methods.map(([id,v])=>[id,t(id)+' · '+price(v.fee)]))+
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
  return '<article class="order"><h3>#'+esc(o.id.slice(0,8))+' · '+label(o.status)+'</h3><p><bdi>'+esc(new Intl.DateTimeFormat(state.lang,{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(o.created)))+'</bdi> · '+esc(price(o.total))+'</p>'+
    (staff?'<p>'+esc(o.recipient)+' · '+esc(o.phone)+'<br>'+esc(o.address)+'</p>':'')+
    '<a href="#invoice/'+esc(o.id)+'">'+label('Invoice')+'</a> '+(staff?'':'<button data-reorder="'+esc(o.id)+'">'+label('Reorder')+'</button>')+'</article>';
}
export function notificationList(notices) {
  if (!notices.length) return '<p>'+label('No notifications yet')+'</p>';
  const format = new Intl.DateTimeFormat(state.lang, {
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
export async function account() {
  if(!state.me) return auth();
  const [orders,notices]=await Promise.all([api('orders'),api('notifications')]);
  return '<h2>'+label('Account')+'</h2><p>'+esc(state.me.email)+'</p><form data-form="profile">'+field('name','Name',state.me.name)+
    '<label>'+label('Saved addresses, one per line')+'<textarea name="addresses">'+esc(state.me.addresses.join('\n'))+'</textarea></label>'+button('Save')+'</form>'+
    '<h3>'+label('Notifications')+'</h3><section id="notices">'+notificationList(notices)+'</section>'+
    '<h3>'+label('Order updates')+'</h3><section id="history">'+(orders.map(o=>orderCard(o)).join('')||label('No orders yet'))+'</section><button data-logout>'+label('Log out')+'</button>';
}
export function invoice(o) {
  return '<div class="invoice"><h2>'+label('Invoice')+' · SimaGol</h2><p><bdi>'+esc(o.id)+'</bdi> · '+label(o.status)+'</p><p>'+esc(o.recipient)+' · '+esc(o.address)+'</p>'+
    o.items.map(i=>'<div class="item-row"><span>'+esc(i.name[state.lang])+' × '+num(i.qty)+'</span><b>'+esc(price(i.unit*i.qty))+'</b></div>').join('')+
    '<p>'+label(o.method)+' · '+esc(price(o.deliveryFee))+' '+esc(o.slotLabel?.[state.lang]||'')+'</p><p>'+label('Gift wrap')+' · '+esc(price(o.wrapFee))+'</p><p>'+esc(o.message)+'</p>'+
    '<strong>'+label('Total')+' · '+esc(price(o.total))+'</strong><p>'+label('Payment on delivery')+'</p><button data-print>'+label('Print')+'</button></div>';
}
