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

function createNavigation(bar) {
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
        if (restoreFocus) launcher.focus({preventScroll:true});
      };
      launcher.addEventListener('click', () => {
        if (!group.hidden) return close(true);
        group.hidden = false;
        launcher.setAttribute('aria-expanded','true');
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
      link.href = href;
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
  if (!bar.firstElementChild) createNavigation(bar);
  bar.dataset.active = active;
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
