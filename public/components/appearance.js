import {icon} from './icons.js';
import {stored,persist} from './ui.js';

const modes=['dark','auto','light'];
const legacy=stored('dark',null);
let mode=stored('themeMode',typeof legacy==='boolean'?(legacy?'dark':'light'):'auto');
if(!modes.includes(mode))mode='auto';

function paint(){
  const hour=new Date().getHours();
  const dark=mode==='dark'||(mode==='auto'&&(hour<7||hour>=19));
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.classList.toggle('dark',dark);
}
export function accountTheme(prefs){
  const value=prefs?.themeMode ?? (typeof prefs?.dark==='boolean'&&!stored('themeMode',null)?(prefs.dark?'dark':'light'):null);
  if(modes.includes(value)){mode=value;persist('themeMode',mode);paint();}
}
function choice(name,value,content){
  return `<label class="preference-choice"><input type="radio" name="${name}" value="${value}"><span>${content}</span></label>`;
}
export function appearanceControls(onChange){
  const host=document.querySelector('.appearance-controls');
  host.innerHTML='<fieldset class="preference-group" id="theme">'+
    choice('theme','dark',icon('moon'))+choice('theme','auto',icon('automatic'))+choice('theme','light',icon('sun'))+'</fieldset>'+
    '<fieldset class="preference-group" dir="ltr" id="language">'+choice('language','fa','فا')+choice('language','en','EN')+'</fieldset>';
  const theme=host.querySelector('#theme'), languages=host.querySelector('#language');
  let lang=stored('lang','fa');
  function draw(value){
    lang=value;paint();
    const fa=lang==='fa';
    theme.setAttribute('aria-label',fa?'حالت نمایش':'Color theme');
    languages.setAttribute('aria-label',fa?'زبان سایت':'Site language');
    const names=fa?['حالت تیره','خودکار','حالت روشن']:['Dark mode','Automatic','Light mode'];
    for(const radio of host.querySelectorAll('input')){
      const isMode=radio.name==='theme';
      const label=isMode?names[modes.indexOf(radio.value)]:(radio.value==='fa'?'فارسی':'English');
      radio.setAttribute('aria-label',label);radio.parentElement.title=label;
      radio.checked=radio.value===(isMode?mode:lang);
    }
  }
  host.onchange=e=>{
    if(e.target.name==='theme'){mode=e.target.value;persist('themeMode',mode);}
    else {lang=e.target.value;persist('lang',lang);}
    draw(lang);onChange({lang,themeMode:mode});
  };
  window.addEventListener('storage',event=>{
    if(event.key==='simagol.themeMode' || event.key===null){
      const saved=stored('themeMode','auto');mode=modes.includes(saved)?saved:'auto';draw(lang);
    }
  });
  window.addEventListener('focus',paint);
  document.addEventListener('visibilitychange',paint);
  setInterval(paint,30000);
  draw(lang);
  return draw;
}
