import {state,esc,label,field,select,button} from './ui.js';

export function showHomepage() {
  const main=document.querySelector('#home-view');
  const hero=document.querySelector('.hero');
  const catalog=document.querySelector('#catalog');
  const banner=document.querySelector('#banner');
  const layout=state.settings.homepage || {};
  banner.hidden=!layout.enabled;
  if(layout.enabled) {
    const image=layout.image?'<img src="/'+esc(layout.image)+'" alt="">':'';
    banner.innerHTML=image+'<p>'+esc(layout.text?.[state.lang])+'</p>';
  }
  const first=layout.first==='catalog'?catalog:hero;
  main.insertBefore(first,main.firstElementChild);
  first.after(banner);
}

export function homepageForm() {
  const layout=state.settings.homepage||{};
  return '<details><summary>'+label('Homepage sections')+'</summary><form data-form="homepage">'+
    select('first','First section',[['hero',label('Hero')],['catalog',label('Catalog')]],layout.first || 'hero')+
    '<label><input name="enabled" type="checkbox" '+(layout.enabled?'checked':'')+'> '+label('Show banner')+'</label>'+
    field('image','Banner image',layout.image,'text',false)+
    field('textFa','Banner · FA',layout.text?.fa,'text',false)+field('textEn','Banner · EN',layout.text?.en,'text',false)+button('Save')+'</form></details>';
}
