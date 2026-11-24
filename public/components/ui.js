export const $ = (s) => document.querySelector(s);
export function stored(key, fallback) {
  try { return JSON.parse(localStorage.getItem('simagol.' + key)) ?? fallback; }
  catch { return fallback; }
}
export function persist(key, value) {
  try { localStorage.setItem('simagol.' + key, JSON.stringify(value)); } catch {}
}
export const state = {
  lang: stored('lang', 'fa') === 'en' ? 'en' : 'fa',
  dark: stored('dark', false) === true, bag: stored('bag', {}), favorites: stored('favorites', []),
  category: 'all', catalog: { products: [], categories: [] }, settings: {}, me: null, dict: {},
};
if (!Array.isArray(state.favorites)) state.favorites = [];
if (!state.bag || typeof state.bag !== 'object' || Array.isArray(state.bag)) state.bag = {};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (v) => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[v]);
export const t = (key) => state.settings.copy?.[key]?.[state.lang] || state.dict[key]?.[state.lang] || key;
export const label = (key) => esc(t(key));
export const num = (n) => new Intl.NumberFormat(state.lang === 'fa' ? 'fa-IR' : 'en').format(n);
export const price = (n) => num(n / 10) + ' ' + t('toman');
export function field(name, title, value = '', type = 'text', required = true) {
  return '<label>' + label(title) + '<input name="' + esc(name) + '" type="' + type +
    '" value="' + esc(value) + '"' + (required ? ' required' : '') + '></label>';
}
export const button = (key) => '<button class="cta" type="submit">' + label(key) + '</button>';
export const option = (value, title, selected) => '<option value="' + esc(value) + '"' +
  (value === selected ? ' selected' : '') + '>' + esc(title) + '</option>';
export function select(name, title, choices, selected) {
  return '<label>' + label(title) + '<select name="' + esc(name) + '">' +
    choices.map(([id, text]) => option(id, text, selected)).join('') + '</select></label>';
}
export async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, { method, headers: {
    'Content-Type':'application/json', 'X-SimaGol':'1'
  }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Service unavailable');
  return data;
}
export function mascot(place) {
  const path = state.settings.mascot?.[place];
  return path ? '<img class="mascot" alt="" src="/' + esc(path) + '">' :
    '<small class="mascot-placeholder">' + label('Sima image placeholder') + '</small>';
}
export function selectedItems() {
  return state.catalog.products.filter(p => Number.isInteger(state.bag[p.id]) && state.bag[p.id] > 0);
}
export function changeBag(id, delta) {
  const p = state.catalog.products.find(item => item.id === id);
  if (!p) return;
  const count = Math.max(0, Math.min(p.stock, (state.bag[id] || 0) + delta));
  if (count) state.bag[id] = count;
  else delete state.bag[id];
  persist('bag', state.bag);
}
