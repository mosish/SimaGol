import {state,esc,t,label,api,field,select,button} from './ui.js';
import {homepageForm} from './home.js';
import {orderCard} from './account.js';
export const nextStatus = {placed:['preparing','cancelled'],preparing:['shipped','cancelled'],shipped:['delivered'],delivered:[],cancelled:[]};
const bilingual=(prefix,title,obj={})=>field(prefix+'Fa',title+' · FA',obj.fa)+field(prefix+'En',title+' · EN',obj.en);
function productEditor(p={name:{},description:{},stock:0,priceIrr:0,image:'images/roses.jpg'}) {
  return '<details><summary>'+esc(p.name[state.lang]||t('New product'))+'</summary><form data-form="product">'+
    '<input type="hidden" name="id" value="'+esc(p.id)+'">'+bilingual('name','Name',p.name)+bilingual('description','Description',p.description)+
    select('category','Category',state.catalog.categories.map(c=>[c.id,c.name[state.lang]]),p.category)+field('image','Image path',p.image)+
    field('priceIrr','Price in rial',p.priceIrr,'number')+field('stock','Stock',p.stock,'number')+
    '<label><input type="checkbox" name="hidden" '+(p.hidden?'checked':'')+'> '+label('Hide product')+'</label>'+button('Save')+'</form></details>';
}
export async function admin() {
  if(!state.me || state.me.role==='customer') return '<h2>'+label('Access denied')+'</h2>';
  const data=await api('admin'), owner=state.me.role==='owner', editor=owner||state.me.role==='editor';
  const settings=state.settings;
  let html='<h2>'+label('Staff')+'</h2>';
  if(data.orders) html+='<details open><summary>'+label('Orders')+'</summary>'+data.orders.map(o=>orderCard(o,true)+(nextStatus[o.status]?.length?
    '<form data-form="status"><input type="hidden" name="id" value="'+esc(o.id)+'">'+select('status','Status',nextStatus[o.status].map(id=>[id,t(id)]))+button('Update')+'</form>':'')).join('')+'</details>';
  if(editor){
    html+=homepageForm();
    html+='<details><summary>'+label('Catalog')+'</summary>'+data.products.map(p=>productEditor(p)).join('')+productEditor()+
      state.catalog.categories.concat([{id:'',name:{}}]).map(c=>'<form data-form="category"><input type="hidden" name="id" value="'+esc(c.id)+'">'+bilingual('name','Category',c.name)+button('Save')+'</form>').join('')+'</details>';
    html+='<details><summary>'+label('Homepage and media')+'</summary><form data-form="upload"><label>'+label('Upload image')+'<input type="file" name="file" required accept="image/png,image/jpeg,image/webp"></label>'+button('Upload')+'</form><p id="upload-path"></p><form data-form="brand">'+
      field('hero','Hero image',settings.hero)+field('logo','Logo',settings.logo,'text',false)+
      ['hero','empty','loading','404'].map(k=>field('mascot_'+k,'Sima · '+k,settings.mascot[k],'text',false)).join('')+
      '<label><input type="checkbox" name="showHero" '+(settings.showHero?'checked':'')+'> '+label('Show hero')+'</label>'+button('Save')+'</form></details>';
    const keys=Object.keys(state.dict);
    html+='<details><summary>'+label('Translations')+'</summary><form data-form="copy">'+select('key','Label',keys.map(k=>[k,k]))+
      bilingual('copy','Translation',settings.copy[keys[0]]||state.dict[keys[0]])+button('Save')+'</form></details>';
    html+='<details><summary>'+label('Delivery settings')+'</summary><form data-form="delivery">'+Object.entries(settings.delivery).map(([key,v])=>
      '<label><input type="checkbox" name="'+key+'On" '+(v.enabled?'checked':'')+'> '+label(key)+'</label>'+field(key+'Fee','Fee in rial',v.fee,'number')).join('')+
      field('wrapFee','Gift wrap fee in rial',settings.wrapFee,'number')+button('Save')+'</form><h3>'+label('Time slots')+'</h3>'+
      settings.slots.concat([{id:'',label:{},capacity:1,ends:''}]).map(s=>'<form data-form="slot"><input type="hidden" name="id" value="'+esc(s.id)+'">'+bilingual('name','Time slot',s.label)+field('ends','End time (UTC ISO)',s.ends)+field('capacity','Capacity',s.capacity,'number')+button('Save')+'</form>').join('')+'</details>';
  }
  if(owner) html+='<details><summary>'+label('Customers and roles')+'</summary>'+data.clients.map(c=>'<section><b>'+esc(c.name)+'</b><div>'+esc(c.email)+'</div>'+
    (data.orders||[]).filter(o=>o.userId===c.id).map(o=>'<a href="#invoice/'+esc(o.id)+'">#'+esc(o.id.slice(0,8))+'</a> ').join('')+
    '<form data-form="role"><input type="hidden" name="id" value="'+esc(c.id)+'">'+select('role','Role',['owner','editor','florist','customer'].map(k=>[k,t(k)]),c.role)+button('Save')+'</form></section>').join('')+'</details>';
  return html;
}
