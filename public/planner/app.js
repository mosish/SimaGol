import { HOLIDAYS, holidayDate, eventsInMonth, dueAlerts, localDate } from './dates.js';
import { initDevice } from './device.js';
import { renderGreeting } from '../components/greeting.js';
import { renderNavigation } from '../components/navigation.js';
import { newPlanner, loadPlanner, savePlanner, collectAlerts, removeEntry, upsert, validLink, validZone } from './store.js';

const copy = {
  followZone: ["همگام با منطقهٔ زمانی دستگاه","Use device time zone"],
  iran: ["ایران","Iran"],
  flowerOccasion: ["مناسبت سفارش گل","Flower-order occasion"],
  orderFlowers: ["سفارش گل","Order flowers"],
  skip: ["رفتن به تقویم","Skip to calendar"],
  brand: ["سیماگل","SimaGol"],
  shop: ["فروشگاه گل","Flower shop"],
  myDates: ["مناسبت‌های من","My occasions"],
  title: ["تقویم مناسبت‌ها","Occasion calendar"],
  subtitle: ["تولدها، سالگردها و روزهای ویژه را برای کسانی که دوستشان دارید به خاطر بسپارید.","Keep birthdays, anniversaries and days that matter to the people you love in one place."],
  add: ["افزودن مناسبت","Add an occasion"],
  today: ["امروز","Today"],
  previous: ["ماه قبل","Previous month"],
  next: ["ماه بعد","Next month"],
  region: ["تقویم مناسبت‌های منطقه","Regional calendar"],
  us: ["ایالات متحده","United States"],
  india: ["هند","India"],
  reminders: ["یادآوری‌های من","My reminders"],
  settings: ["تنظیمات یادآوری","Reminder settings"],
  localTime: ["ساعت محلی یادآوری","Local reminder time"],
  zone: ["منطقه زمانی","Time zone"],
  saveSettings: ["ذخیره تنظیمات","Save settings"],
  deviceHelp: ["مناسبت‌ها روی همین مرورگر ذخیره می‌شوند. برای دریافت اعلان در پس‌زمینه، اعلان‌های دستگاه را فعال کنید.","Your planner is saved in this browser. Enable device notifications for background reminders."],
  install: ["نصب برنامه","Install app"],
  enable: ["فعال کردن اعلان‌های دستگاه","Enable device notifications"],
  disable: ["خاموش کردن اعلان‌های دستگاه","Disable device notifications"],
  kind: ["نوع مناسبت","Occasion type"],
  birthday: ["تولد","Birthday"],
  anniversary: ["سالگرد","Anniversary"],
  custom: ["مناسبت دلخواه","Custom occasion"],
  name: ["نام مناسبت","Occasion name"],
  date: ["تاریخ میلادی","Date (Gregorian)"],
  annual: ["تکرار هر سال","Repeat yearly"],
  recipient: ["گیرنده (اختیاری)","Recipient (optional)"],
  lead: ["چند روز پیش از مناسبت؟","Days before the occasion"],
  holidayLead: ["برای این مناسبت، ۳ روز و ۱ روز زودتر یادآوری می‌شود.","You’ll receive reminders 3 days and 1 day before this occasion."],
  notes: ["یادداشت (اختیاری)","Note (optional)"],
  link: ["پیوند (اختیاری)","Link (optional)"],
  save: ["ذخیره","Save"],
  close: ["بستن","Close"],
  deleteTitle: ["این مناسبت حذف شود؟","Delete this occasion?"],
  cancel: ["نگه داشتن","Keep occasion"],
  delete: ["حذف","Delete"],
  regionalList: ["فهرست مناسبت‌های این منطقه","Browse this region’s occasions"],
  edit: ["ویرایش","Edit"],
  empty: ["هنوز مناسبتی ذخیره نکرده‌اید.","You haven’t saved an occasion yet."],
  noDay: ["برای این روز مناسبتی ثبت نشده است.","No occasions on this date."],
  noAlerts: ["یادآوری‌ها در زمان تعیین‌شده اینجا نمایش داده می‌شوند.","Reminders appear here when they are due."],
  readAll: ["علامت‌گذاری همه به‌عنوان خوانده‌شده","Mark all as read"],
  unread: ["خوانده‌نشده","unread"],
  light: ["حالت روشن","Light mode"],
  dark: ["حالت تاریک","Dark mode"],
  newDate: ["مناسبت جدید","New occasion"],
  editDate: ["ویرایش مناسبت","Edit occasion"],
  choose: ["ذخیره این مناسبت","Save this occasion"],
  openLink: ["مشاهده پیوند","Open link"],
  saved: ["ذخیره شد.","Saved."],
  deleted: ["مناسبت حذف شد.","Occasion deleted."],
  invalid: ["تاریخ و فیلدهای فرم را بررسی کنید.","Check the date and form fields."],
  invalidLink: ["پیوند باید با http یا https شروع شود.","Enter a link starting with http or https."],
  invalidZone: ["منطقه زمانی معتبر وارد کنید؛ مانند Asia/Tehran.","Enter a time zone such as Asia/Tehran."],
  storageError: ["ذخیره در این مرورگر امکان‌پذیر نیست. فضای ذخیره و تنظیمات مرورگر را بررسی کنید.","Saving in this browser failed. Check available storage and browser settings."],
  storageInvalid: ["داده‌های ذخیره‌شده قابل خواندن نیستند. برای حفظ آن‌ها ذخیره‌سازی متوقف شده است.","Saved planner data could not be read. Saving is paused to preserve it."],
  daysBefore: ["روز پیش از مناسبت","days before the occasion"],
  onDate: ["در روز مناسبت","On the occasion date"],
  notifyDate: ["تاریخ مناسبت","Occasion date"],
  inboxTime: ["زمان یادآوری","Reminder time"],
  yearly: ["هر سال","Yearly"],
  regional: ["مناسبت منطقه‌ای","Regional occasion"],
  savedHoliday: ["در مناسبت‌های من","In my occasions"],
  dailyEvents: ["مناسبت","occasions"],
  week0: ["یکشنبه","Sun"],
  week1: ["دوشنبه","Mon"],
  week2: ["سه‌شنبه","Tue"],
  week3: ["چهارشنبه","Wed"],
  week4: ["پنجشنبه","Thu"],
  week5: ["جمعه","Fri"],
  week6: ["شنبه","Sat"],
};
const $ = selector => document.querySelector(selector);
let lang = 'fa';
let customerName = '';
let profileRequest = 0;
async function refreshGreeting() {
  const request = ++profileRequest;
  let name = '';
  try {
    const response = await fetch('/api/me', {cache:'no-store'});
    if (response.ok) name = (await response.json())?.name || '';
  } catch { /* Offline planners keep the guest wordmark. */ }
  if (request === profileRequest) {
    customerName = name;
    renderGreeting($('.brand small'), customerName, lang);
  }
}
let dark = false;
let blocked = '';
let model = newPlanner();
try {
  lang = JSON.parse(localStorage.getItem('simagol.lang')) === 'en' ? 'en' : 'fa';
  dark = JSON.parse(localStorage.getItem('simagol.dark')) === true;
  model = loadPlanner(localStorage);
} catch (error) { blocked = error instanceof SyntaxError || error.message === 'storageInvalid' ? 'storageInvalid' : 'storageError'; }
let selected = localDate(new Date(),model.timeZone);
let [year,month] = selected.split('-').map(Number);
let editTarget;
let deleteTarget;
let device;
const text = key => copy[key]?.[lang === 'fa' ? 0 : 1] || key;
const number = n => new Intl.NumberFormat(lang).format(n);
const locale = () => lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'en-US-u-ca-gregory';
const dateText = (date, options = {dateStyle:'long'}) =>
  new Intl.DateTimeFormat(locale(),{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = (y,m,d) => [String(y),String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
const title = event => typeof event.name === 'string' ? event.name : event.name[lang];
const button = (attr,id,label) => '<button type="button" data-'+attr+'="'+escape(id)+'">'+escape(text(label))+'</button>';
function announce(message) { $('#status').textContent=message; }
function commit(change) {
  if (blocked) { announce(text(blocked)); return false; }
  try {
    const fresh = loadPlanner(localStorage);
    const next = change(fresh);
    savePlanner(localStorage,next);
    model = next;
    return true;
  } catch (error) {
    const key = error.message === 'invalid' ? 'invalid' :
      (error instanceof SyntaxError || error.message === 'storageInvalid' ? 'storageInvalid' : 'storageError');
    announce(text(key));
    return false;
  }
}
function snapshot() { return {entries:model.entries,time:model.time,timeZone:model.timeZone,lang}; }
function sync() { if (device) Promise.resolve(device.sync()).catch(e=>announce(e.message)); }
function storePreference(key,val) {
  try { localStorage.setItem('simagol.'+key,JSON.stringify(val)); }
  catch { announce(text('storageError')); }
}
function displayDate(date) {
  selected=date;
  [year,month]=date.split('-').map(Number);
}
function appearance() {
  renderNavigation('bell', lang);
  renderGreeting($('.brand small'), customerName, lang);
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  document.documentElement.classList.toggle('dark',dark);
  document.title=text('title')+' | '+text('brand');
  document.querySelectorAll('[data-label]').forEach(el => el.textContent=text(el.dataset.label));
  $('#language').textContent=lang==='fa'?'EN':'FA';
  $('#language').ariaLabel=lang==='fa'?'English':'فارسی';
  $('#theme').textContent=text(dark?'light':'dark');
  $('#theme').setAttribute('aria-pressed',String(dark));
  $('#previous').textContent=lang==='fa'?'›':'‹'; $('#previous').ariaLabel=text('previous');
  $('#next').textContent=lang==='fa'?'‹':'›'; $('#next').ariaLabel=text('next');
  $('#zone').value=model.timeZone;
  $('#follow-zone').checked=model.followZone===true;
  $('#zone').disabled=model.followZone===true;
  $('#time').value=model.time;
  render();
}
function row(heading,meta,actions='',body='') {
  return '<article class="event-row"><h4>'+escape(heading)+'</h4><p class="meta">'+escape(meta)+'</p>'+body+
    (actions?'<div class="row-actions">'+actions+'</div>':'')+'</article>';
}
function eventRow(entry) {
  const meta = [dateText(entry.date),text(entry.kind==='occasion'?'flowerOccasion':entry.type),entry.annual?text('yearly'):'',entry.recipient].filter(Boolean).join(' · ');
  const actions = button('edit',entry.id,'edit')+button('delete',entry.id,'delete')+
    (entry.link && validLink(entry.link)?'<a href="'+escape(entry.link)+'" target="_blank" rel="noopener noreferrer">'+text('openLink')+'</a>':'');
  return row(title(entry),meta,actions,entry.notes?'<p>'+escape(entry.notes)+'</p>':'');
}
function holidayRow(h) {
  const existing=model.entries.find(x=>x.holidayId===h.id);
  return row(title(h),dateText(holidayDate(h.id,year)),existing?button('edit',existing.id,'savedHoliday'):button('choose',h.id,'choose'));
}
function calendar() {
  const rows=eventsInMonth({year,month,region:model.region,events:model.entries});
  const first=iso(year,month,1);
  const today=localDate(new Date(),model.timeZone);
  $('#region').value=model.region;
  $('#month-title').textContent=dateText(first,{month:'long',year:'numeric'});
  $('#previous').disabled=year===1900 && month===1;
  $('#next').disabled=year===2100 && month===12;
  const start=lang==='fa'?6:0;
  $('#weekdays').innerHTML=Array.from({length:7},(_,i)=>'<span>'+text('week'+((start+i)%7))+'</span>').join('');
  const offset=(7+new Date(first+'T12:00:00Z').getUTCDay()-start)%7;
  const last=new Date(Date.UTC(year,month,0)).getUTCDate();
  const cells=Array(offset).fill('<span></span>');
  for(let day=1;day<=last;day++) {
    const date=iso(year,month,day);
    const count=rows.filter(x=>x.date===date && !(x.source==='holiday' && model.entries.some(e=>e.holidayId===x.id))).length;
    const label=dateText(date)+(count?' · '+number(count)+' '+text('dailyEvents'):'');
    cells.push('<button type="button" data-day="'+date+'" aria-label="'+escape(label)+'" aria-pressed="'+(date===selected)+'" '+
      (date===today?'aria-current="date" ':'')+(count?'class="has-events"':'')+'>'+number(day)+'</button>');
  }
  $('#days').innerHTML=cells.join('');
  $('#selected-title').textContent=dateText(selected,{weekday:'long',month:'long',day:'numeric'});
  const picked=rows.filter(x=>x.date===selected && !(x.source==='holiday' && model.entries.some(e=>e.holidayId===x.id)));
  $('#selected').innerHTML=picked.map(x=>x.source==='holiday'?holidayRow(x):eventRow(x)).join('')||'<p class="hint">'+text('noDay')+'</p>';
  $('#regional').innerHTML=HOLIDAYS.filter(x=>x.region===model.region).sort((a,b)=>holidayDate(a.id,year).localeCompare(holidayDate(b.id,year))).map(holidayRow).join('');
}
function inbox() {
  const unread=model.inbox.filter(x=>!x.read).length;
  $('#unread').textContent=unread?number(unread)+' '+text('unread'):'';
  $('#inbox').innerHTML=model.inbox.map(n=>{
    const due=new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeStyle:'short',timeZone:model.timeZone}).format(new Date(n.dueAt));
    return row(title(n),text('notifyDate')+' · '+dateText(n.date),'<a href="/#catalog">'+text('orderFlowers')+'</a>','<p>'+escape(text('inboxTime')+' · '+due)+'</p>');
  }).join('')||'<p class="hint">'+text('noAlerts')+'</p>';
  if(unread) $('#inbox').insertAdjacentHTML('afterbegin','<button class="minor" data-read>'+text('readAll')+'</button>');
}
function render() {
  calendar(); inbox();
  $('#entries').innerHTML=[...model.entries].sort((a,b)=>a.date.localeCompare(b.date)).map(eventRow).join('')||
    '<p class="hint">'+text('empty')+'</p>';
}
const form=$('#event-form');
const field=name=>form.elements.namedItem(name);
function configureReminder() {
  const occasion = field('type').value==='occasion';
  field('daysBefore').disabled=occasion;
  field('daysBefore').closest('label').hidden=occasion;
  $('#holiday-lead').hidden=!occasion;
}
function openEditor(entry,holiday) {
  editTarget=entry;
  form.reset();
  const rule=holiday || HOLIDAYS.find(h=>h.id===entry?.holidayId);
  form.dataset.holiday=rule?.id||'';
  $('#form-title').textContent=text(entry?'editDate':'newDate');
  field('type').value=rule || entry?.kind==='occasion' ? 'occasion' : entry?.type || 'birthday';
  field('type').disabled=!!rule;
  field('name').value=entry?.name || (rule?title(rule):'');
  field('date').value=entry?.date || (rule?holidayDate(rule.id,year):selected);
  field('date').disabled=!!rule;
  field('annual').checked=entry?.annual ?? true;
  field('annual').disabled=!!rule;
  field('daysBefore').value=entry?.daysBefore ?? 1;
  for(const key of ['recipient','notes','link'])field(key).value=entry?.[key]||'';
  $('#form-error').textContent='';
  configureReminder();
  $('#editor').showModal();field('name').focus();
}
function scanAlerts() {
  if (blocked) return;
  const detected=Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(model.followZone && detected && detected!==model.timeZone){
    if(commit(s=>({...s,timeZone:detected}))){
      $('#zone').value=detected;
      sync();
    }
  }
  const count=model.inbox.length;
  if (commit(s=>collectAlerts(s,new Date(),dueAlerts)) && count!==model.inbox.length) inbox();
}
function moveMonth(delta) {
  const d=new Date(Date.UTC(year,month-1+delta,1));
  displayDate(d.toISOString().slice(0,10)); calendar();
}
$('#language').onclick=()=>{
  lang=lang==='fa'?'en':'fa';storePreference('lang',lang);appearance();sync();
};
$('#theme').onclick=()=>{dark=!dark;storePreference('dark',dark);appearance();};
$('#region').onchange=e=>{commit(s=>({...s,region:e.target.value}));calendar();};
$('#new').onclick=()=>openEditor();
$('#cancel').onclick=()=>$('#editor').close();
$('#keep').onclick=()=>$('#confirm').close();
$('#today').onclick=()=>{displayDate(localDate(new Date(),model.timeZone));calendar();};
$('#previous').onclick=()=>moveMonth(-1);
$('#next').onclick=()=>moveMonth(1);
field('type').onchange=configureReminder;
$('#remove').onclick=()=>{
  if(commit(s=>removeEntry(s,deleteTarget))){
    $('#confirm').close();render();announce(text('deleted'));sync();
  }
};
document.addEventListener('click',event=>{
  const b=event.target.closest('button');
  if(!b) return;
  if(b.dataset.day) { selected=b.dataset.day;calendar();document.querySelector('[data-day="'+selected+'"]')?.focus(); }
  if(b.dataset.choose) openEditor(undefined,HOLIDAYS.find(x=>x.id===b.dataset.choose));
  if(b.dataset.edit) { const entry=model.entries.find(x=>x.id===b.dataset.edit);if(entry)openEditor(entry); }
  if(b.dataset.delete) {
    deleteTarget=b.dataset.delete;
    $('#delete-name').textContent=model.entries.find(x=>x.id===deleteTarget)?.name||'';
    $('#confirm').showModal();$('#keep').focus();
  }
  if(b.hasAttribute('data-read')){
    const keys=new Set(model.inbox.map(n=>n.key));
    if(commit(s=>({...s,inbox:s.inbox.map(n=>keys.has(n.key)?{...n,read:true}:n)}))) inbox();
  }
});
form.onsubmit=e=>{
  e.preventDefault();
  const type=field('type').value;
  const rule=HOLIDAYS.find(h=>h.id===form.dataset.holiday);
  const entry={
    id:editTarget?.id||crypto.randomUUID(),kind:type==='occasion'?'occasion':'personal',
    type:type==='occasion'?'custom':type,name:field('name').value.trim(),date:field('date').value,annual:field('annual').checked,
    daysBefore:type==='occasion'?1:Number(field('daysBefore').value),recipient:field('recipient').value.trim(),
    notes:field('notes').value.trim(),link:field('link').value.trim()
  };
  if(rule) {entry.holidayId=rule.id;entry.region=rule.region;}
  if(!validLink(entry.link)) {$('#form-error').textContent=text('invalidLink');return;}
  if(!entry.name) {$('#form-error').textContent=text('invalid');return;}
  const ok=commit(s=>{
    const caught=collectAlerts(s,new Date(),dueAlerts);
    const prior=rule && caught.entries.find(x=>x.holidayId===rule.id);
    return upsert(caught,prior?{...entry,id:prior.id}:entry);
  });
  if(!ok){$('#form-error').textContent=$('#status').textContent;return;}
  $('#editor').close();displayDate(entry.date);render();announce(text('saved'));sync();
};
$('#follow-zone').onchange=e=>{
  $('#zone').disabled=e.target.checked;
  if(e.target.checked)$('#zone').value=Intl.DateTimeFormat().resolvedOptions().timeZone;
};
$('#prefs').onsubmit=e=>{
  e.preventDefault();
  const timeZone=$('#zone').value.trim(), time=$('#time').value;
  if(!timeZone||!validZone(timeZone)){announce(text('invalidZone'));return;}
  if(commit(s=>({...collectAlerts(s,new Date(),dueAlerts),time,timeZone,followZone:$('#follow-zone').checked}))){
    render();announce(text('saved'));sync();
  }
};
window.addEventListener('storage',e=>{
  if(e.key!=='simagol.planner.v1' && e.key!==null)return;
  try{const latest=loadPlanner(localStorage);model=latest;render();}
  catch{announce(text('storageInvalid'));}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scanAlerts();});
window.addEventListener('pageshow',scanAlerts);
window.addEventListener('pageshow',event=>{if (event.persisted) refreshGreeting();});
document.addEventListener('visibilitychange',()=>{if (!document.hidden) refreshGreeting();});
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data==='planner-reminder')scanAlerts();});
setInterval(()=>{if(!document.hidden)scanAlerts();},30000);
appearance();scanAlerts();
refreshGreeting();
if(blocked)announce(text(blocked));
try {
  device=await initDevice({getSnapshot:snapshot,onMessage:announce,onChange:scanAlerts});
} catch(error) { announce(error.message); }
