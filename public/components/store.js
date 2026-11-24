import { $,state,t,label,esc,num,price,mascot,selectedItems } from './ui.js';
import { icon } from './icons.js';
const normalize = s => s.toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,' ').trim();
export function collection() {
  const fav = location.hash === '#favorites';
  const q = normalize($('#search').value);
  const cats = state.catalog.categories;
  $('#filters').innerHTML = [['all',t('All flowers')], ...cats.map(c => [c.id,c.name[state.lang]])]
    .map(([id,name]) => '<button class="chip '+(state.category===id?'active':'')+'" data-filter="'+esc(id)+'" aria-pressed="'+(id===state.category)+'">'+esc(name)+'</button>').join('');
  $('.section-title h2').textContent = t(fav?'Favorites':'collection');
  const rows = state.catalog.products.filter(p => (!fav || state.favorites.includes(p.id)) &&
    (state.category==='all' || state.category===p.category) && normalize(p.name[state.lang]+' '+p.description[state.lang]).includes(q));
  $('#results').textContent = num(rows.length)+' '+t('products');
  $('#products').innerHTML = rows.map(p => {
    const id=esc(p.id), name=esc(p.name[state.lang]), saved=state.favorites.includes(p.id);
    const category=cats.find(c=>c.id===p.category);
    return '<article class="product"><a class="pic" href="#product/'+id+'" aria-label="'+name+'"><img src="/'+esc(p.image)+'" alt=""></a>'+
      '<button class="heart '+(saved?'on':'')+'" data-fav="'+id+'" aria-label="'+label('Favorites')+' · '+name+'" aria-pressed="'+saved+'">'+icon('heart')+'</button>'+
      '<div class="card-content"><span class="category">'+esc(category?.name[state.lang])+'</span><h3><a href="#product/'+id+'">'+name+'</a></h3>'+
      '<div class="card-info"><span class="price">'+esc(price(p.priceIrr))+'</span><button class="plus" '+(!p.stock?'disabled':'')+' aria-label="'+label('Add to bag')+' · '+name+'" data-add="'+id+'">'+icon('plus')+'</button></div></div></article>';
  }).join('') || '<div class="empty">'+mascot('empty')+label('No flowers found')+'</div>';
}
export function product(p) {
  return '<img class="detail-photo" src="/'+esc(p.image)+'" alt=""><h2>'+esc(p.name[state.lang])+'</h2><p>'+esc(p.description[state.lang])+
    '</p><div class="detail-actions"><b>'+esc(price(p.priceIrr))+'</b><button class="cta" data-add="'+esc(p.id)+'" '+(!p.stock?'disabled':'')+'>'+label(p.stock?'Add to bag':'Sold out')+'</button></div>';
}
export function bagView() {
  const items=selectedItems();
  return '<h2>'+label('Shopping bag')+'</h2>'+(items.length ? items.map(p=>'<div class="item-row"><b>'+esc(p.name[state.lang])+'</b><span>'+
    esc(price(p.priceIrr*state.bag[p.id]))+'</span><div class="stepper"><button data-sub="'+esc(p.id)+'" aria-label="'+label('Remove')+'">−</button>'+
    num(state.bag[p.id])+'<button data-add="'+esc(p.id)+'" aria-label="'+label('Add to bag')+'" '+(state.bag[p.id]>=p.stock?'disabled':'')+'>+</button></div></div>').join('')+
    '<p>'+label('Subtotal')+' · '+esc(price(items.reduce((sum,p)=>sum+p.priceIrr*state.bag[p.id],0)))+'</p><a class="cta" href="#checkout">'+label('Checkout')+'</a>':
    mascot('empty')+label('Your bag is empty'));
}
