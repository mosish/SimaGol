import {icon} from './icons.js';

const tabs = [
  ['home', '/', 'خانه', 'Home'],
  ['bag', '/#bag', 'لیست خرید', 'Shopping list'],
  ['bell', '/planner/', 'یادآوری', 'Reminders'],
  ['profile', '/#account', 'پروفایل', 'Profile'],
];

export function renderNavigation(active, lang, quantity = 0) {
  const bar = document.querySelector('.app-tabs');
  const fa = lang === 'fa';
  bar.setAttribute('aria-label', fa ? 'بخش‌های برنامه' : 'App navigation');
  for (const [key, href, persian, english] of tabs) {
    let link = bar.querySelector('[data-tab="'+key+'"]');
    if (!link) {
      link = document.createElement('a');
      link.dataset.tab = key;
      link.href = href;
      link.innerHTML = icon(key) + '<span></span>';
      bar.append(link);
    }
    link.lastElementChild.textContent = fa ? persian : english;
    if (key === 'bag' && quantity > 0) {
      link.lastElementChild.append(' ('+new Intl.NumberFormat(lang).format(quantity)+')');
    }
    if (active === key) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
