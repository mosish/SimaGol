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
  return '<label class="'+name+'-choice"><input type="radio" name="'+name+'" value="'+value+'"><span class="'+name+'-choice-content">'+content+'</span></label>';
}
export function appearanceControls(onChange){
  const host=document.querySelector('.appearance-controls');
  host.innerHTML='<fieldset dir="ltr" class="theme-toggle" id="theme">'+`<span class="theme-scene" aria-hidden="true">
      <svg class="theme-stars" viewBox="0 0 150 44" fill="currentColor">
        <path d="m18 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1Zm91 17 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5ZM77 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" />
        <circle cx="40" cy="25" r=".9" /><circle cx="92" cy="15" r=".8" /><circle cx="129" cy="9" r="1" /><circle cx="63" cy="36" r=".7" /><circle cx="139" cy="35" r=".8" />
      </svg>
      <svg class="theme-clouds theme-clouds-back" viewBox="0 0 150 44" fill="currentColor">
        <path d="M-10 44V33Q-1 20 10 30Q20 15 33 28Q47 22 51 35Q62 31 67 44ZM84 44Q85 29 98 32Q100 20 113 24Q125 11 135 25Q147 19 159 30V44Z" />
      </svg>
      <svg class="theme-clouds theme-clouds-front" viewBox="0 0 150 44" fill="currentColor">
        <path d="M-10 44V39Q0 29 12 38Q22 27 34 38Q45 32 53 44ZM96 44Q98 35 109 38Q116 26 128 36Q143 26 159 37V44Z" />
      </svg>
      <span class="theme-thumb"><span class="theme-orb"><i></i><i></i><i></i></span></span>
    </span>`+
    choice('theme','dark',icon('moon'))+choice('theme','auto','Auto')+choice('theme','light',icon('sun'))+'</fieldset>'+
    '<fieldset dir="ltr" class="language-toggle" id="language">'+`<span class="language-scene" aria-hidden="true">
      <svg viewBox="0 0 100 44" fill="none" stroke="currentColor" stroke-width=".7">
        <circle cx="50" cy="22" r="31" /><ellipse cx="50" cy="22" rx="16" ry="31" />
        <path d="M19 22h62M24 8q26 12 52 0M24 36q26-12 52 0M50-9v62" />
      </svg>
      <span class="language-thumb"></span>
    </span>`+choice('language','fa','FA')+choice('language','en','EN')+'</fieldset>';
  const theme=host.querySelector('#theme'), languages=host.querySelector('#language');
  let lang=stored('lang','fa');
  function draw(value){
    lang=value;paint();
    const fa=lang==='fa';
    theme.dataset.mode=mode;languages.dataset.language=lang;
    theme.setAttribute('aria-label',fa?'حالت نمایش':'Color theme');
    languages.setAttribute('aria-label',fa?'زبان سایت':'Site language');
    const names=fa?['حالت تیره','خودکار','حالت روشن']:['Dark mode','Automatic','Light mode'];
    theme.querySelector('[value=auto]+span').textContent=fa?'خودکار':'Auto';
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
