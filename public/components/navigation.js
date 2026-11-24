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
  // The ends scale to the bar; the moving cutout stays the same size in CSS pixels.
  surface.innerHTML=`<svg width="100%" height="100%" focusable="false">
    <defs>
      <linearGradient id="dock-petal"><stop stop-color="var(--petal)" stop-opacity=".18"/>
        <stop offset=".025" stop-color="var(--petal)" stop-opacity=".86"/>
        <stop offset=".095" stop-color="var(--dock)"/><stop offset=".905" stop-color="var(--dock)"/>
        <stop offset=".975" stop-color="var(--petal)" stop-opacity=".86"/>
        <stop offset="1" stop-color="var(--petal)" stop-opacity=".18"/></linearGradient>
      <mask id="dock-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width="100%" height="100%" fill="white"/>
        <path class="dock-cutout" d="M-42 -2 C-30 -2 -29 7 -22 17 C-10 36 10 36 22 17 C29 7 30 -2 42 -2 Z" fill="black"/>
      </mask>
    </defs>
    <g mask="url(#dock-cut)">
      <svg viewBox="0 0 500 57" width="100%" height="100%" preserveAspectRatio="none">
        <path fill="url(#dock-petal)" d="M0 24 C8 24 8 9 19 4 Q26 0 42 0 H458 Q474 0 481 4 C492 9 492 24 500 24 L498 37 Q496 56 473 57 H27 Q4 56 2 37Z"/>
      </svg>
    </g></svg>`;
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
        action.innerHTML = '<i>'+icon(type)+'</i><span></span>';
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
    bar.querySelector('[data-quick="'+type+'"] span').textContent = fa ? persian : english;
  }
}
