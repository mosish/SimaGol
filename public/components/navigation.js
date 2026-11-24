import {icon} from './icons.js';

const tabs = [
  ['home', '/', 'خانه', 'Home'],
  ['bouquet', '/#bouquet', 'ساخت دسته‌گل', 'Bouquet studio'],
  ['plus', '/planner/#new', 'ایجاد یادآوری', 'Create reminder'],
  ['bell', '/planner/', 'یادآوری', 'Reminders'],
  ['profile', '/#account', 'پروفایل', 'Profile'],
];

export function renderNavigation(active, lang, quantity = 0) {
  const cart = document.querySelector('.header-cart');
  cart.innerHTML = icon('bag') + (quantity ? '<sup>'+new Intl.NumberFormat(lang).format(quantity)+'</sup>' : '');
  cart.setAttribute('aria-label',(lang==='fa'?'سبد خرید':'Shopping bag')+' ('+new Intl.NumberFormat(lang).format(quantity)+')');
  const bar = document.querySelector('.app-tabs');
  const fa = lang === 'fa';
  bar.setAttribute('aria-label', fa ? 'بخش‌های برنامه' : 'App navigation');
  for (const [key, href, persian, english] of tabs) {
    let link = bar.querySelector('[data-tab="'+key+'"]');
    if (!link) {
      link = document.createElement('a');
      link.dataset.tab = key;
      link.href = href;
      if(key==='plus')link.className='create-reminder';
      link.innerHTML = icon(key) + '<span></span>';
      bar.append(link);
    }
    link.lastElementChild.textContent = fa ? persian : english;
    if(key==='plus')link.title=link.lastElementChild.textContent;
    if (active === key) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
