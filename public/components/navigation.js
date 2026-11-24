import {icon} from './icons.js';

const tabs = [
  ['home', '/', 'خانه', 'Home'],
  ['bouquet', '/#bouquet', 'ساخت دسته‌گل', 'Bouquet studio'],
  ['plus', null, 'ایجاد یادآوری', 'Create reminder'],
  ['bell', '/planner/', 'یادآوری', 'Reminders'],
  ['profile', '/#account', 'پروفایل', 'Profile'],
];

const shortcuts = [
  ['birthday', 'تولد', 'Birthday'],
  ['anniversary', 'سالگرد', 'Anniversary'],
  ['custom', 'مناسبت دلخواه', 'Custom occasion'],
];

// Carry the indicator position across the storefront and planner documents.
const handoffKey='simagol.dockPosition';
function dockStart(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(handoffKey));
    sessionStorage.removeItem(handoffKey);
    if(saved && saved.path===location.pathname && Date.now()-saved.time<15000 &&
      Number.isFinite(saved.position) && saved.position>=0 && saved.position<=100)return saved.position;
  }catch{}
}

function positionDock(bar){
  const key=bar.querySelector('[aria-expanded="true"]')?'plus':bar.dataset.active;
  const index=tabs.findIndex(([tab])=>tab===key);
  bar.dataset.indicator=index<0?'':key;
  if(index<0)return;
  const rtl=document.documentElement.dir==='rtl';
  const x=(rtl?tabs.length-1-index:index)*20+10;
  bar.style.setProperty('--dock-x',x+'%');
}

function createDockSurface(bar){
  const surface=document.createElement('div');
  surface.className='dock-surface';
  surface.setAttribute('aria-hidden','true');
  // Scale the sloping shoulders to the width, keeping the corners and notch in pixels.
  surface.innerHTML=`<svg width="100%" height="100%" focusable="false">
    <defs>
      <linearGradient id="dock-fill">
        <stop stop-color="var(--dock)" stop-opacity=".95"/>
        <stop offset=".04" stop-color="var(--dock)"/>
        <stop offset=".96" stop-color="var(--dock)"/>
        <stop offset="1" stop-color="var(--dock)" stop-opacity=".95"/>
      </linearGradient>
      <mask id="dock-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width="100%" height="100%" fill="white"/>
        <path class="dock-cutout" d="M-60 -3 V0 C-41 0 -34 8 -25 20 C-18 30 -11 35 0 35 C11 35 18 30 25 20 C34 8 41 0 60 0 V-3 Z" fill="black"/>
      </mask>
    </defs>
    <path class="dock-outline" fill="url(#dock-fill)" mask="url(#dock-cut)"/></svg>`;
  const outline=surface.querySelector('.dock-outline');
  function shapeDock(width,height){
    const shoulder=width*.29;
    const right=width-shoulder;
    const bottom=height-15;
    outline.setAttribute('d',[
      'M0 25 Q0 17 9 14',                         // Rounded tip into the rising edge.
      `C25 10 ${shoulder-16} 0 ${shoulder} 0 H${right}`,
      `C${right+16} 0 ${width-25} 10 ${width-9} 14 Q${width} 17 ${width} 25`,
      `V${bottom} Q${width} ${height} ${width-16} ${height} H16 Q0 ${height} 0 ${bottom} Z`
    ].join(' '));
  }
  shapeDock(bar.clientWidth,bar.clientHeight);
  new ResizeObserver(([entry])=>shapeDock(entry.contentRect.width,entry.contentRect.height)).observe(bar);
  const orb=document.createElement('i');
  orb.className='dock-orb';
  orb.setAttribute('aria-hidden','true');
  orb.innerHTML=tabs.map(([key])=>'<i data-glyph="'+key+'">'+icon(key)+'</i>').join('');
  bar.append(surface,orb);
  bar.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.pathname===location.pathname)return;
    try{
      const position=parseFloat(getComputedStyle(bar).getPropertyValue('--dock-x'));
      sessionStorage.setItem(handoffKey,JSON.stringify({position,path:link.pathname,time:Date.now()}));
    }catch{}
  },true);
}

function createNavigation(bar) {
  createDockSurface(bar);
  for (const [key, href] of tabs) {
    if (key === 'plus') {
      const launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.dataset.tab = key;
      launcher.setAttribute('aria-controls', 'quick-reminders');
      launcher.setAttribute('aria-expanded', 'false');
      launcher.innerHTML = '<i class="nav-symbol">'+icon('plus')+'</i>';
      const group = document.createElement('div');
      group.id = 'quick-reminders';
      group.hidden = true;
      for (const [type] of shortcuts) {
        const action = document.createElement('a');
        action.href = '/planner/#new/'+type;
        action.dataset.quick = type;
        action.innerHTML = '<i>'+icon(type)+'</i>';
        group.append(action);
      }
      const close = (restoreFocus = false) => {
        if (group.hidden) return;
        group.hidden = true;
        launcher.setAttribute('aria-expanded','false');
        positionDock(bar);
        if (restoreFocus) launcher.focus({preventScroll:true});
      };
      launcher.addEventListener('click', () => {
        if (!group.hidden) return close(true);
        group.hidden = false;
        launcher.setAttribute('aria-expanded','true');
        positionDock(bar);
      });
      group.addEventListener('click', event => { if (event.target.closest('a')) close(true); });
      document.addEventListener('pointerdown', event => {
        if (!group.contains(event.target) && !launcher.contains(event.target)) close();
      });
      document.addEventListener('focusin', event => {
        if (!group.contains(event.target) && event.target !== launcher) close();
      });
      document.addEventListener('keydown', event => { if (event.key === 'Escape') close(true); });
      window.addEventListener('hashchange', () => close());
      window.addEventListener('pagehide', () => close());
      bar.append(launcher,group);
    } else {
      const link = document.createElement('a');
      link.dataset.tab = key;
      link.href = key==='home' && location.pathname==='/' ? '#' : href;
      link.innerHTML = '<i class="nav-symbol">'+icon(key)+'</i><span></span>';
      bar.append(link);
    }
  }
}

export function renderNavigation(active, lang, quantity = 0) {
  const cart = document.querySelector('.header-cart');
  cart.innerHTML = icon('bag') + (quantity ? '<sup>'+new Intl.NumberFormat(lang).format(quantity)+'</sup>' : '');
  cart.setAttribute('aria-label',(lang==='fa'?'سبد خرید':'Shopping bag')+' ('+new Intl.NumberFormat(lang).format(quantity)+')');
  const bar = document.querySelector('.app-tabs');
  const fa = lang === 'fa';
  bar.setAttribute('aria-label', fa ? 'بخش‌های برنامه' : 'App navigation');
  const first=!bar.firstElementChild;
  if (first) createNavigation(bar);
  bar.dataset.active = active;
  if(first){
    const start=dockStart();
    if(start===undefined)positionDock(bar);
    else bar.style.setProperty('--dock-x',start+'%');
    bar.getBoundingClientRect();
    bar.classList.add('dock-ready');
  }
  positionDock(bar);
  for (const [key, , persian, english] of tabs) {
    const item = bar.querySelector('[data-tab="'+key+'"]');
    const label = fa ? persian : english;
    if (key === 'plus') {
      item.setAttribute('aria-label',label);
      item.title = label;
    } else {
      item.lastElementChild.textContent = label;
      if (active === key) item.setAttribute('aria-current','page');
      else item.removeAttribute('aria-current');
    }
  }
  for (const [type, persian, english] of shortcuts) {
    const action = bar.querySelector('[data-quick="'+type+'"]');
    const label = fa ? persian : english;
    action.setAttribute('aria-label',label);
    action.title=label;
  }
}
