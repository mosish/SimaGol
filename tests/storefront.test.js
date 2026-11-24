import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import { state, changeBag, price, t } from '../public/components/ui.js';
import { collection, product, bagView } from '../public/components/store.js';
import { checkout, checkoutFields, invoice, account } from '../public/components/account.js';
import { admin } from '../public/components/admin.js';

const fixture = name => JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const buyer = {id:'buyer',name:'Test Customer',email:'buyer@example.test',role:'customer',addresses:['Tehran']};
const order = {id:'order-12345',userId:buyer.id,created:'2026-11-24T12:00:00Z',status:'placed',
  items:[{id:'blush',name:{fa:'گل',en:'Snapshot rose'},qty:1,unit:1000}],method:'standard',total:1040,
  deliveryFee:40,wrapFee:0,address:'Street A',recipient:buyer.name,phone:'09000000000',message:'A gift'};
let nodes;
beforeEach(() => {
  nodes = new Map();
  globalThis.document = {querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector,{innerHTML:'',textContent:'',value:''});
    return nodes.get(selector);
  }};
  globalThis.location = {hash:'#catalog'};
  globalThis.localStorage = {setItem() {}};
  Object.assign(state,{lang:'fa',catalog:fixture('../server/catalog.json'),dict:fixture('../public/labels.json'),
    favorites:[],bag:{},category:'all',me:null,settings:{showHero:true,ordersEnabled:true,
      wrapFee:200,slots:[{id:'future',label:{fa:'فردا',en:'Tomorrow'},ends:'2099-01-01T00:00:00Z',booked:0,capacity:1}],
      delivery:{standard:{enabled:true,fee:40},scheduled:{enabled:true,fee:80},express:{enabled:false,fee:90}},copy:{},mascot:{}}});
});

test('FA/EN names, category filters, scoped favorite search and product detail', () => {
  const p=state.catalog.products[0];
  collection();
  assert(nodes.get('#products').innerHTML.includes(p.name.fa));
  assert(product(p).includes(p.description.fa));
  state.lang='en'; state.category=p.category; state.favorites=[p.id]; location.hash='#favorites';
  document.querySelector('#search').value=p.name.en;
  collection();
  assert(nodes.get('#products').innerHTML.includes(p.name.en));
  assert.equal((nodes.get('#products').innerHTML.match(/class="product"/g)||[]).length,1);
  assert(product(p).includes(p.description.en));
  document.querySelector('#search').value='no matching item';
  collection();
  assert(nodes.get('#products').innerHTML.includes(t('No flowers found')));
});

test('cart quantity limit and locale-specific checkout subtotal with gift wrap', () => {
  const p=state.catalog.products[0];
  changeBag(p.id,p.stock+5);
  assert.equal(state.bag[p.id],p.stock);
  assert(bagView().includes(price(p.stock*p.priceIrr)));
  assert(checkout().includes('data-form="Login"'));
  state.me=buyer;
  state.settings.ordersEnabled=false;
  assert(checkout().includes(t('Ordering is closed')));
  state.settings.ordersEnabled=true;
  assert(checkout().includes('name="recipient"'));
  assert(!checkout().includes('value="express"'));
  for (const lang of ['fa','en']) {
    state.lang=lang;
    state.settings.slots.push(
      {id:'expired',label:{fa:'دیروز',en:'Yesterday'},ends:'2000-01-01T00:00:00Z',booked:0,capacity:1},
      {id:'full',label:{fa:'تکمیل',en:'Full'},ends:'2099-02-01T00:00:00Z',booked:1,capacity:1}
    );
    const form={elements:{method:{value:'scheduled'},wrap:{checked:true}}};
    checkoutFields(form);
    assert(nodes.get('#slot-field').innerHTML.includes(state.settings.slots[0].label[lang]));
    assert(!/value="(?:expired|full)"/.test(nodes.get('#slot-field').innerHTML));
    assert(nodes.get('#checkout-total').textContent.includes(price(p.stock*p.priceIrr+80+200)));
    form.elements.method.value='standard';form.elements.wrap.checked=false;
    checkoutFields(form);
    assert.equal(nodes.get('#slot-field').innerHTML,'');
    assert(nodes.get('#checkout-total').textContent.includes(price(p.stock*p.priceIrr+40)));
  }
});

test('account history links to its invoice, and invoice renders purchased item snapshot', async tcase => {
  tcase.mock.method(globalThis,'fetch',async url => {
    if (url === '/api/notifications') return {ok:true,json:async()=>[{id:1,orderId:order.id,status:'placed',created:order.created,seen:false}]};
    assert.equal(url,'/api/orders'); return {ok:true,json:async()=>[order]};
  });
  state.me=buyer; state.lang='en';
  const history=await account();
  assert(history.includes('href="#invoice/'+order.id+'"'));
  assert(history.includes('data-read-notices="1"'));
  const receipt=invoice(order);
  assert(receipt.includes('Snapshot rose') && receipt.includes('Street A') && receipt.includes(price(1040)));
});

test('staff presenter shows forms appropriate to each role', async tcase => {
  const fetch=tcase.mock.method(globalThis,'fetch',async url => {
    assert.equal(url,'/api/admin');
    return {ok:true,json:async()=>({products:state.catalog.products,orders:[],clients:[buyer]})};
  });
  state.lang='en';state.me=buyer;
  assert((await admin()).includes(t('Access denied')));
  assert.equal(fetch.mock.callCount(),0);
  for (const [role,catalogAccess,canAssign] of [['owner',true,true],['editor',true,false],['florist',false,false]]) {
    state.me={...buyer,role};
    const html=await admin();
    assert.equal(html.includes('data-form="category"'),catalogAccess);
    assert.equal(html.includes('data-form="role"'),canAssign);
  }
});
