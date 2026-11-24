import {icon} from './icons.js';
import {stored,persist} from './ui.js';

const modes=['dark','auto','light'];
let mode=window.SimaGolTheme.preference();
function paint(){window.SimaGolTheme.paint(mode);}
export function accountTheme(prefs){
  const value=prefs?.themeMode ?? (typeof prefs?.dark==='boolean'&&!stored('themeMode',null)?(prefs.dark?'dark':'light'):null);
  if(modes.includes(value)){mode=value;persist('themeMode',mode);paint();}
}
function choice(name,value,content){
  return `<label class="preference-choice"><input type="radio" name="${name}" value="${value}"><span>${content}</span></label>`;
}
export function appearanceControls(onChange){
  const host=document.querySelector('.appearance-controls');
  host.innerHTML=`<fieldset class="theme-tools" id="theme">
    <label class="garden-switch"><input type="checkbox" role="switch" name="night">
      <span class="garden-scene" aria-hidden="true">
        <svg viewBox="0 0 92 36" preserveAspectRatio="none" focusable="false">
          <g class="garden-stars" fill="#fff5de"><circle cx="13" cy="8" r="1"/><circle cx="31" cy="6" r=".8"/><circle cx="46" cy="10" r="1.1"/><circle cx="54" cy="4" r=".6"/></g>
          <path class="garden-far" d="M-12 22Q2 7 17 13T46 12Q57 5 69 10T104 10V40H-12Z"/>
          <path class="garden-mid" d="M-12 25Q6 15 22 20T55 17Q73 9 104 22V40H-12Z"/>
          <path class="garden-near" d="M-12 30Q5 19 25 27T57 28Q76 19 104 24V40H-12Z"/>
          <g class="garden-stems" fill="none" stroke-width="1" stroke-linecap="round"><path d="M42 33q-1-4-3-7m2 4q2-3 4-3m32 0q1-4 4-7m-3 5-2-2"/></g>
          <g class="garden-buds"><circle cx="39" cy="25.5" r="1.6"/><circle cx="81" cy="19.5" r="1.5"/></g>
        </svg>
        <i class="garden-orb"></i>
      </span>
    </label>
    <button class="theme-auto" type="button">${icon('automatic')}</button></fieldset>`+
    '<fieldset class="preference-group" dir="ltr" id="language">'+choice('language','fa','فا')+choice('language','en','EN')+'</fieldset>';
  const theme=host.querySelector('#theme'), languages=host.querySelector('#language');
  const night=theme.querySelector('input'), auto=theme.querySelector('button');
  function refreshMode(){
    paint();
    night.checked=document.documentElement.dataset.theme==='dark';
    auto.setAttribute('aria-pressed',String(mode==='auto'));
  }
  let lang=stored('lang','fa');
  function draw(value){
    lang=value;refreshMode();
    const fa=lang==='fa';
    theme.setAttribute('aria-label',fa?'حالت نمایش':'Color theme');
    languages.setAttribute('aria-label',fa?'زبان سایت':'Site language');
    night.setAttribute('aria-label',fa?'حالت شب':'Night mode');
    night.parentElement.title=fa?'تغییر روز و شب':'Switch day and night';
    auto.setAttribute('aria-label',fa?'خودکار':'Automatic');
    auto.title=fa?'تغییر خودکار روز و شب':'Automatic day and night';
    for(const radio of languages.querySelectorAll('input')){
      const label=radio.value==='fa'?'فارسی':'English';
      radio.setAttribute('aria-label',label);radio.parentElement.title=label;
      radio.checked=radio.value===lang;
    }
  }
  function setMode(value){
    mode=value;persist('themeMode',mode);
    draw(lang);onChange({lang,themeMode:mode});
  }
  night.onchange=()=>setMode(night.checked?'dark':'light');
  auto.onclick=()=>setMode(mode==='auto'?document.documentElement.dataset.theme:'auto');
  languages.onchange=e=>{
    lang=e.target.value;persist('lang',lang);
    draw(lang);onChange({lang,themeMode:mode});
  };
  window.addEventListener('storage',event=>{
    if(event.key==='simagol.themeMode' || event.key===null){
      const saved=stored('themeMode','auto');mode=modes.includes(saved)?saved:'auto';draw(lang);
    }
  });
  window.addEventListener('focus',refreshMode);
  document.addEventListener('visibilitychange',refreshMode);
  setInterval(refreshMode,30000);
  draw(lang);
  return draw;
}
