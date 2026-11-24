import {appearanceControls,accountTheme} from '../components/appearance.js';
import {api} from '../components/ui.js';
import {icon} from '../components/icons.js';
import {calendarSystem,dateLocale,calendarParts,monthStart,monthLength,addDays,inputDate,readDate} from '../components/calendar.js';
import { HOLIDAYS, eventsInMonth, dueAlerts, localDate } from './dates.js';
import { initDevice } from './device.js';
import { renderGreeting } from '../components/greeting.js';
import { renderNavigation } from '../components/navigation.js';
import { newPlanner, loadPlanner, savePlanner, collectAlerts, removeEntry, upsert, validLink, validZone, smsOccasionLimit } from './store.js';

const copy = {
  smsUsage:['مناسبت پیامکی: {used} از {limit}','SMS occasions: {used} of {limit}'],
  smsFull:['ظرفیت پیامک پر است. می‌توانی مناسبت را فقط با یادآوری ذخیره کنی یا پیامک یک مناسبت دیگر را خاموش کنی.','SMS slots are full. Save with a reminder only, or turn off SMS for another occasion.'],
  alarmOnly:['فقط یادآوری','Reminder only'], withSms:['یادآوری و پیامک','Reminder + SMS'],
  moreOptions:['موارد دیگر','More options'], customShort:['دلخواه','Custom'], flowerShort:['سفارش گل','Flowers'],
  calendarView:['تقویم','Calendar'],
  addReminder:['افزودن یادآوری','Add reminder'],
  addOnDay:['برای این روز مناسبتی ثبت کن','Add an occasion for this day'],
  anotherOnDay:['مناسبت جدید','New occasion'],

  legacy:['انتقال مناسبت‌های قبلی این مرورگر','Import previous browser occasions'],
  regionalList:['مناسبت‌های این ماه','Occasions this month'],
  deviceHelp:['برای اعلان پس‌زمینه، اعلان‌های دستگاه را فعال کنید.','Enable device notifications for background reminders.'],
  pendingSync:['تغییرات آفلاین در این مرورگر محفوظ است؛ همگام‌سازی کامل نشد.','Offline changes are saved on this device. Sync is pending.'],
  smsSetup:['ارسال پیامک پس از اتصال سرویس پیامکی فروشگاه فعال می‌شود.','SMS delivery becomes available once the shop connects its SMS service.'],
  system:['نوع تقویم','Calendar system'],solar:['شمسی','Solar Hijri'],gregorian:['میلادی','Gregorian'],
  solarDate:['تاریخ شمسی','Solar Hijri date'],worldDate:['تاریخ میلادی','Gregorian date'],
  signIn:['ورود یا ثبت‌نام برای ثبت مناسبت','Sign in or register to save an occasion'],
  online:['برای ذخیره به اینترنت وصل شوید.','Connect to save changes.'],
  smsOption:['یادآوری پیامکی','SMS reminder'],
  smsTitle:['یادآوری با پیامک','SMS reminders'],mobile:['شماره همراه خودت','Your mobile number'],
  sendCode:['ارسال کد تأیید','Send verification code'],code:['کد تأیید','Verification code'],verify:['تأیید شماره','Verify number'],
  coverage:['مناسبت‌های قمری ایران تا پایان ۱۴۰۵ تطبیق داده شده‌اند.','Iranian lunar observances are confirmed through 1405.'],

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
  reminders: ["یادآوری‌های من","My reminders"],
  settings: ["تنظیمات یادآوری","Reminder settings"],
  localTime: ["ساعت محلی یادآوری","Local reminder time"],
  zone: ["منطقه زمانی","Time zone"],
  saveSettings: ["ذخیره تنظیمات","Save settings"],
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
  lead: ["یادآوری (روز قبل)","Reminder (days before)"],
  holidayLead: ["برای این مناسبت، ۳ روز و ۱ روز زودتر یادآوری می‌شود.","You’ll receive reminders 3 days and 1 day before this occasion."],
  notes: ["یادداشت (اختیاری)","Note (optional)"],
  link: ["پیوند (اختیاری)","Link (optional)"],
  save: ["ذخیره","Save"],
  close: ["بستن","Close"],
  deleteTitle: ["این مناسبت حذف شود؟","Delete this occasion?"],
  cancel: ["نگه داشتن","Keep occasion"],
  delete: ["حذف","Delete"],
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
let owner='',verified=false,smsAvailable=false,phone='';
const viewerKey='simagol.planner.viewer';
function cachedViewer(){
  try{const v=JSON.parse(localStorage.getItem(viewerKey));return v?.expires>Date.now()?v.id:'';}catch{return '';}
}
async function remote(action,body){
  const res=await fetch('/api/planner'+(action?'/'+action:''),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','X-SimaGol':'1'},body:body?JSON.stringify({...body,owner}):undefined});
  if(!res.ok){if(res.status===401||res.status===403){verified=false;queueMicrotask(refreshGreeting);}throw new Error((await res.json()).error);}
  return res.json();
}
async function refreshGreeting(){
  const request=++profileRequest;
  let me,info;
  try{
    const res=await fetch('/api/me',{cache:'no-store'});if(!res.ok)throw Error();
    me=await res.json();
    if(me){const res=await fetch('/api/planner',{cache:'no-store'});if(!res.ok)throw Error();info=await res.json();if(info.owner!==me.id)throw Error();}
  }catch{me=undefined;}
  if(request!==profileRequest)return;
  const id=me===undefined?(!navigator.onLine?cachedViewer():''):me?.id||'';
  verified=Boolean(me);smsAvailable=!!info?.smsAvailable;phone=info?.verifiedPhone||'';
  if(me!==undefined){if(id && cachedViewer()!==id)localStorage.setItem(viewerKey,JSON.stringify({id,expires:Date.now()+24*3600000}));else if(!id)localStorage.removeItem(viewerKey);}
  if(owner!==id){$('#editor').close();$('#confirm').close();blocked='';}
  owner=id;customerName=me?.name||'';
  accountTheme(me?.prefs);if(me?.prefs?.lang)lang=me.prefs.lang;
  try{
    model=id?loadPlanner(localStorage,new Date(),id):newPlanner();

    if(info){
      blocked='';
      for(const pending of model.outbox||[]){
        let reply;
        try{reply=await remote(pending.action,pending.body);}catch{appearance();announce(text('pendingSync'));return;}
        if(owner!==id||request!==profileRequest)return;
        info.entries=reply.entries;model.outbox=model.outbox.filter(x=>x.key!==pending.key);savePlanner(localStorage,model,id);
      }
      model.entries=info.entries;if(info.time){model.time=info.time;model.timeZone=info.zone;}savePlanner(localStorage,model,id);}
  }catch{model=newPlanner();blocked='storageInvalid';}
  appearance();if(owner)scanAlerts();sync();
}
function requireAccount(){
  if(owner && cachedViewer()===owner && (verified || !navigator.onLine))return true;
  if(!navigator.onLine || owner){announce(text('online'));return false;}
  location.assign('/#account/planner-login');return false;
}
async function mutation(action,body){
  if(!requireAccount())return null;
  const id=owner;
  if(!navigator.onLine && ['save','delete'].includes(action) && !body.entry?.sms){
    const ok=commit(s=>{
      const next=action==='save'?upsert(s,body.entry):removeEntry(s,body.id);
      return {...next,outbox:[...(s.outbox||[]),{key:crypto.randomUUID(),action,body}]};
    });
    return ok?model:null;
  }
  try{if(!navigator.onLine)throw Error(text('online'));const info=await remote(action,body);if(owner!==id||cachedViewer()!==id)return null;
    model.entries=info.entries;phone=info.verifiedPhone;smsAvailable=info.smsAvailable;
    savePlanner(localStorage,model,owner);return info;
  }catch(e){
    if(e.message==='SMS occasion limit reached'){await refreshGreeting();announce(text('smsFull'));}
    else announce(e.message);
    return null;
  }
}
let blocked = '';
let model = newPlanner();
try {
  lang = JSON.parse(localStorage.getItem('simagol.lang')) === 'en' ? 'en' : 'fa';

} catch (error) { blocked = error instanceof SyntaxError || error.message === 'storageInvalid' ? 'storageInvalid' : 'storageError'; }
let selected = localDate(new Date(),model.timeZone);

let editTarget;
let deleteTarget;
let device;
const text = key => copy[key]?.[lang === 'fa' ? 0 : 1] || key;
const number = n => new Intl.NumberFormat(lang).format(n);
const locale = () => dateLocale(lang);
const dateText = (date, options = {dateStyle:'long'}) =>
  new Intl.DateTimeFormat(locale(),{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = event => typeof event.name === 'string' ? event.name : event.name[lang];
const button = (attr,id,label) => '<button type="button" data-'+attr+'="'+escape(id)+'">'+escape(text(label))+'</button>';
function announce(message) { $('#status').textContent=message; }
function commit(change) {
  if (!owner || cachedViewer()!==owner)return false;
  if (blocked) { announce(text(blocked)); return false; }
  try {
    const fresh = loadPlanner(localStorage,new Date(),owner);
    const next = change(fresh);
    savePlanner(localStorage,next,owner);
    model = next;
    return true;
  } catch (error) {
    const key = error.message === 'invalid' ? 'invalid' :
      (error instanceof SyntaxError || error.message === 'storageInvalid' ? 'storageInvalid' : 'storageError');
    announce(text(key));
    return false;
  }
}
function snapshot() { return {authenticated:verified,entries:model.entries,time:model.time,timeZone:model.timeZone,lang}; }
function sync() { if (device) Promise.resolve(device.sync()).catch(e=>announce(e.message)); }
function displayDate(date) {
  selected=date;

}
function appearance() {
  let quantity=0;
  try { quantity=Object.values(JSON.parse(localStorage.getItem('simagol.bag'))||{}).filter(Number.isInteger).reduce((a,b)=>a+b,0); } catch {}
  renderNavigation('bell', lang, quantity);
  renderGreeting($('.brand small'), customerName, lang);
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='fa'?'rtl':'ltr';
  drawControls(lang);
  document.title=text('title')+' | '+text('brand');
  document.querySelectorAll('[data-label]').forEach(el => el.textContent=text(el.dataset.label));
  $('#previous').textContent=lang==='fa'?'›':'‹'; $('#previous').ariaLabel=text('previous');
  $('#next').textContent=lang==='fa'?'‹':'›'; $('#next').ariaLabel=text('next');
  $('.planner-views').setAttribute('aria-label',text('title'));
  $('#calendar-system').setAttribute('aria-label',text('system'));
  $('#jump-month').ariaLabel=lang==='fa'?'ماه':'Month';
  $('#jump-year').ariaLabel=lang==='fa'?'سال':'Year';
  $('#prefs').hidden=!owner;
  $('#sms-settings').hidden=!verified;$('#sms-phone').hidden=!smsAvailable;$('#sms-help').hidden=smsAvailable;
  if(!verified||!smsAvailable)$('#sms-code').hidden=true;$('#verified').textContent=phone;
  $('#legacy').hidden=!verified||!localStorage.getItem('simagol.planner.v1')||!!localStorage.getItem('simagol.planner.imported');
  $('#sms-option').hidden=!verified||!smsAvailable||!phone;
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
function occasionTile(entry) {
  const kind=text(entry.kind==='occasion'?'flowerOccasion':entry.type);
  return '<article class="event-row occasion-tile"><div class="tile-head"><time datetime="'+escape(entry.date)+'">'+
    '<strong>'+escape(dateText(entry.date,{day:'numeric'}))+'</strong>'+escape(dateText(entry.date,{month:'short'}))+'</time>'+
    '<div><h4>'+escape(title(entry))+'</h4><p class="meta">'+escape([kind,dateText(entry.date,{year:'numeric'}),entry.annual?text('yearly'):''].filter(Boolean).join(' · '))+'</p></div></div>'+
    (entry.recipient?'<p>'+escape(text('recipient'))+' · '+escape(entry.recipient)+'</p>':'')+
    (entry.notes?'<p>'+escape(entry.notes)+'</p>':'')+
    '<small class="tile-channel">'+icon('bell')+escape(text(entry.sms?'withSms':'alarmOnly'))+'</small>'+
    '<div class="row-actions">'+button('edit',entry.id,'edit')+button('delete',entry.id,'delete')+
    (entry.link && validLink(entry.link)?'<a href="'+escape(entry.link)+'" target="_blank" rel="noopener noreferrer">'+text('openLink')+'</a>':'')+'</div></article>';
}
function holidayRow(h,includeDate=true) {
  const existing=model.entries.find(x=>x.holidayId===h.id);
  const action=existing?'edit':'choose';
  const value=existing?existing.id:h.id+'@'+h.date;
  const label=text(existing?'edit':'addReminder')+' · '+title(h);
  return '<article class="occasion-line"><div><strong>'+escape(title(h))+'</strong>'+
    (includeDate?'<small>'+escape(dateText(h.date))+'</small>':'')+'</div><button type="button" class="occasion-add" data-'+action+'="'+escape(value)+'" aria-label="'+escape(label)+'" title="'+escape(label)+'">'+(existing?'✓':'+')+'</button></article>';
}
const rangeStart='1900-01-01',rangeEnd='2100-12-31';
function updateMonthControls(y,m,system){
  const [minYear,minMonth]=calendarParts(rangeStart,system),[maxYear,maxMonth]=calendarParts(rangeEnd,system);
  const months=$('#jump-month'),years=$('#jump-year');
  const firstMonth=y===minYear?minMonth:1,lastMonth=y===maxYear?maxMonth:12;
  const monthKey=[lang,system,firstMonth,lastMonth].join('-');
  if(months.dataset.key!==monthKey){
    months.replaceChildren();
    for(let n=firstMonth;n<=lastMonth;n++)months.add(new Option(dateText(monthStart(y,n,system),{month:'long'}),n));
    months.dataset.key=monthKey;
  }
  const yearKey=lang+system;
  if(years.dataset.key!==yearKey){
    years.replaceChildren();
    for(let n=minYear;n<=maxYear;n++)years.add(new Option(number(n).replace(/[٬,]/g,''),n));
    years.dataset.key=yearKey;
  }
  months.value=m;years.value=y;
  $('#calendar-system input[value="'+system+'"]').checked=true;
}
function jumpTo(y,m){
  const system=calendarSystem(),day=calendarParts(selected,system)[2];
  const date=addDays(monthStart(y,m,system),Math.min(day,monthLength(y,m,system))-1);
  displayDate(date<rangeStart?rangeStart:date>rangeEnd?rangeEnd:date);
  calendar();
}
function calendar() {
  const system=calendarSystem();
  const [y,m]=calendarParts(selected,system);
  const first=monthStart(y,m,system),last=monthLength(y,m,system);
  const end=addDays(first,last-1),gregorianMonths=new Set([first.slice(0,7),end.slice(0,7)]);
  const rows=[...gregorianMonths].flatMap(key=>{const [year,month]=key.split('-').map(Number);return eventsInMonth({year,month,region:'IR',events:model.entries});}).filter(r=>r.date>=first&&r.date<=end);
  const today=localDate(new Date(),model.timeZone);
  updateMonthControls(y,m,system);
  $('#month-title').textContent=dateText(first,{month:'long',year:'numeric'});
  $('#previous').disabled=first<='1900-01-01';$('#next').disabled=end>='2100-12-31';
  const start=system==='persian'?6:0;
  $('#weekdays').innerHTML=Array.from({length:7},(_,i)=>'<span>'+text('week'+((start+i)%7))+'</span>').join('');
  const offset=(7+new Date(first).getUTCDay()-start)%7;
  const cells=Array(offset).fill('<span></span>');
  for(let day=1;day<=last;day++) {
    const date=addDays(first,day-1);
    const count=rows.filter(x=>x.date===date && !(x.source==='holiday' && model.entries.some(e=>e.holidayId===x.id))).length;
    const label=dateText(date)+(count?' · '+number(count)+' '+text('dailyEvents'):'');
    cells.push('<button type="button" '+(date<rangeStart||date>rangeEnd?'disabled ':'')+'data-day="'+date+'" aria-label="'+escape(label)+'" aria-pressed="'+(date===selected)+'" '+
      (date===today?'aria-current="date" ':'')+(count?'class="has-events"':'')+'>'+number(day)+'</button>');
  }
  $('#days').innerHTML=cells.join('');
  $('#selected-title').textContent=dateText(selected,{weekday:'long',month:'long',day:'numeric'});
  const picked=rows.filter(x=>x.date===selected && !(x.source==='holiday' && model.entries.some(e=>e.holidayId===x.id)));
  const dayEvents=picked.map(x=>x.source==='holiday'?holidayRow(x,false):eventRow(x)).join('');
  const addLabel=text(picked.length?'anotherOnDay':'addOnDay');
  $('#selected').innerHTML=dayEvents+'<button type="button" class="add-on-day" data-add-on-day aria-haspopup="dialog"><span>'+addLabel+'</span><b aria-hidden="true">+</b></button>';
  $('#regional').innerHTML=rows.filter(x=>x.source==='holiday').map(h=>holidayRow(h)).join('')||text('noDay');
  $('#sheet-title').textContent=$('#selected-title').textContent;
  $('#sheet-events').innerHTML=$('#selected').innerHTML;
  $('#coverage').textContent=end>'2027-03-20'?text('coverage'):'';

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
  const used=model.entries.filter(e=>e.sms).length;
  $('#sms-usage').textContent=owner?text('smsUsage').replace('{used}',number(used)).replace('{limit}',number(smsOccasionLimit)):'';
  $('#entries').innerHTML=[...model.entries].sort((a,b)=>a.date.localeCompare(b.date)).map(occasionTile).join('')||
    '<p class="hint">'+text('empty')+'</p>';
}
const form=$('#event-form');
const field=name=>form.elements.namedItem(name);
for(const slot of form.querySelectorAll('[data-kind-icon]'))slot.innerHTML=icon(slot.dataset.kindIcon);
const more=$('#event-more');
form.addEventListener('invalid',event=>{
  if(more.contains(event.target))more.open=true;
},true);
function configureReminder() {
  const occasion = field('type').value==='occasion';
  field('daysBefore').disabled=occasion;
  field('daysBefore').closest('label').hidden=occasion;
  $('#holiday-lead').hidden=!occasion;
}
const quickTypes=['birthday','anniversary','custom'];
function openEditor(entry,holiday,quickType) {
  if(!owner && navigator.onLine){
    try{sessionStorage.setItem('simagol.newReminder',JSON.stringify({date:holiday?.date||selected,holidayId:holiday?.id,quickType}));}catch{}
  }
  if(!requireAccount())return;
  if($('#day-sheet').open)$('#day-sheet').close();
  editTarget=entry;
  form.reset();
  const rule=holiday || HOLIDAYS.find(h=>h.id===entry?.holidayId);
  form.dataset.holiday=rule?.id||'';
  $('#form-title').textContent=text(entry?'editDate':'newDate');
  field('type').value=rule || entry?.kind==='occasion' ? 'occasion' : entry?.type || quickType || 'birthday';
  $('#event-kind').disabled=!!rule;
  more.open=false;
  field('name').value=entry?.name || (rule?title(rule):'');
  field('date').value=inputDate(entry?.date||holiday?.date||selected);
  field('date').placeholder=calendarSystem()==='persian'?'1405/01/01':'2026/03/21';
  field('date').previousElementSibling.textContent=text(calendarSystem()==='persian'?'solarDate':'worldDate');
  field('sms').checked=!!entry?.sms;
  const full=!entry?.sms && model.entries.filter(e=>e.sms).length>=smsOccasionLimit;
  field('sms').disabled=full;
  $('#sms-limit-note').hidden=!full||!smsAvailable||!phone;
  field('date').disabled=!!rule;
  field('annual').checked=entry?.annual ?? true;
  field('annual').disabled=!!rule;
  field('daysBefore').value=entry?.daysBefore ?? 1;
  for(const key of ['recipient','notes','link'])field(key).value=entry?.[key]||'';
  $('#form-error').textContent='';
  configureReminder();
  $('#editor').showModal();
  (matchMedia('(pointer: coarse)').matches?$('#form-title'):field('name')).focus({preventScroll:true});
}
function scanAlerts() {
  if (blocked || !owner || cachedViewer()!==owner) return;
  const detected=Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(model.followZone && detected && detected!==model.timeZone){
    if(commit(s=>({...s,timeZone:detected}))){
      $('#zone').value=detected;
      if(verified&&navigator.onLine)remote('settings',{zone:detected,time:model.time}).catch(()=>announce(text('pendingSync')));
      sync();
    }
  }
  const count=model.inbox.length;
  if (commit(s=>collectAlerts(s,new Date(),dueAlerts)) && count!==model.inbox.length) inbox();
}
function moveMonth(delta) {
  const sys=calendarSystem(),[y,m]=calendarParts(selected,sys);const [nextYear,nextMonth]=calendarParts(monthStart(y,m+delta,sys),sys);jumpTo(nextYear,nextMonth);
}
const drawControls=appearanceControls(async prefs=>{
  lang=prefs.lang;appearance();sync();
  if(verified)try{await api('profile','POST',{prefs});}catch(e){announce(e.message);}
});
$('#calendar-system').onchange=e=>{localStorage.setItem('simagol.calendar',e.target.value);render();};
$('#jump-month').onchange=$('#jump-year').onchange=()=>jumpTo(Number($('#jump-year').value),Number($('#jump-month').value));
let activeView='calendar';
let plannerReady=false;
function displayView(){
  const name=location.hash.slice(1);
  const quickType=quickTypes.find(type=>name==='new/'+type);
  const creating=name==='new'||!!quickType;
  if(creating && !plannerReady)return;
  if(creating)history.replaceState(null,'','#'+activeView);
  else activeView=['occasions','reminders'].includes(name)?name:'calendar';
  document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==activeView);
  document.querySelectorAll('.planner-views a').forEach(link=>{
    if(link.hash==='#'+activeView)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  if(creating)openEditor(undefined,undefined,quickType);
}
function resumeEditor(){
  let intent;
  try{intent=JSON.parse(sessionStorage.getItem('simagol.newReminder'));sessionStorage.removeItem('simagol.newReminder');}catch{}
  if(!owner||!intent||$('#editor').open||!/^\d{4}-\d{2}-\d{2}$/.test(intent.date))return;
  displayDate(intent.date);calendar();
  const holiday=HOLIDAYS.find(h=>h.id===intent.holidayId);
  openEditor(undefined,holiday?{...holiday,date:intent.date}:undefined,quickTypes.includes(intent.quickType)?intent.quickType:undefined);
}
$('#close-day').onclick=()=>$('#day-sheet').close();
window.addEventListener('hashchange',displayView);
displayView();
$('#cancel').onclick=()=>$('#editor').close();
$('#keep').onclick=()=>$('#confirm').close();
$('#today').onclick=()=>{displayDate(localDate(new Date(),model.timeZone));calendar();};
$('#previous').onclick=()=>moveMonth(-1);
$('#next').onclick=()=>moveMonth(1);
$('#event-kind').onchange=configureReminder;
$('#remove').onclick=async()=>{
  if(!await mutation('delete',{id:deleteTarget}))return;
  if(commit(s=>removeEntry(s,deleteTarget))){
    $('#confirm').close();render();announce(text('deleted'));sync();
  }
};
document.addEventListener('click',event=>{
  const b=event.target.closest('button');
  if(!b) return;
  if(b.dataset.day) { selected=b.dataset.day;calendar();document.querySelector('[data-day="'+selected+'"]')?.focus({preventScroll:true}); if(matchMedia('(max-width:760px)').matches)$('#day-sheet').showModal(); }
  if(b.dataset.choose){const [id,date]=b.dataset.choose.split('@');openEditor(undefined,{...HOLIDAYS.find(x=>x.id===id),date});}
  if(b.hasAttribute('data-add-on-day'))openEditor(undefined,undefined,'custom');
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
form.onsubmit=async e=>{
  e.preventDefault();
  if(!requireAccount())return;
  const type=field('type').value;
  const rule=HOLIDAYS.find(h=>h.id===form.dataset.holiday);
  const entry={
    id:editTarget?.id||crypto.randomUUID(),kind:type==='occasion'?'occasion':'personal',
    type:type==='occasion'?'custom':type,name:field('name').value.trim(),date:readDate(field('date').value),calendar:editTarget?.calendar||(!editTarget?calendarSystem():'gregory'),sms:field('sms').checked,annual:field('annual').checked,
    daysBefore:type==='occasion'?1:Number(field('daysBefore').value),recipient:field('recipient').value.trim(),
    notes:field('notes').value.trim(),link:field('link').value.trim()
  };
  if(rule) {entry.holidayId=rule.id;entry.region=rule.region;}
  if(!validLink(entry.link)) {more.open=true;field('link').focus();$('#form-error').textContent=text('invalidLink');return;}
  if(!entry.name) {$('#form-error').textContent=text('invalid');return;}
  if(!entry.date){$('#form-error').textContent=text('invalid');return;}
  if(rule){const prior=model.entries.find(x=>x.holidayId===rule.id);if(prior)entry.id=prior.id;}
  if(!await mutation('save',{entry,time:model.time,zone:model.timeZone})){ $('#form-error').textContent=$('#status').textContent;return; }
  $('#editor').close();displayDate(entry.date);render();if(!rule && !editTarget)location.hash='occasions';announce(text('saved'));sync();
};
$('#follow-zone').onchange=e=>{
  $('#zone').disabled=e.target.checked;
  if(e.target.checked)$('#zone').value=Intl.DateTimeFormat().resolvedOptions().timeZone;
};
$('#prefs').onsubmit=async e=>{
  e.preventDefault();
  const timeZone=$('#zone').value.trim(), time=$('#time').value;
  if(!timeZone||!validZone(timeZone)){announce(text('invalidZone'));return;}
  if(!await mutation('settings',{zone:timeZone,time}))return;
  if(commit(s=>({...collectAlerts(s,new Date(),dueAlerts),time,timeZone,followZone:$('#follow-zone').checked}))){
    render();announce(text('saved'));sync();
  }
};
window.addEventListener('storage',e=>{
  if(e.key===viewerKey || e.key===null){refreshGreeting();return;}
  if(!owner||e.key!=='simagol.planner.v1.'+owner)return;
  try{const latest=loadPlanner(localStorage,new Date(),owner);model=latest;render();}
  catch{announce(text('storageInvalid'));}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scanAlerts();});
window.addEventListener('pageshow',scanAlerts);
window.addEventListener('pageshow',event=>{if (event.persisted) refreshGreeting();});
document.addEventListener('visibilitychange',()=>{if (!document.hidden) refreshGreeting();});
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data==='planner-reminder')scanAlerts();});
setInterval(()=>{if(!document.hidden)scanAlerts();},30000);
$('#legacy').onclick=async()=>{
  if(!verified || !confirm(lang==='fa'?'مناسبت‌های قدیمی این مرورگر متعلق به شماست و به حسابتان اضافه شود؟':'Import your old browser entries into this account?'))return;
  try{
    const old=loadPlanner(localStorage);
    for(const entry of old.entries){if(!model.entries.some(x=>x.id===entry.id) && !await mutation('save',{entry,zone:model.timeZone,time:model.time}))return;}
    localStorage.setItem('simagol.planner.imported','1');appearance();
  }catch{announce(text('storageInvalid'));}
};
$('#sms-phone').onsubmit=async e=>{e.preventDefault();if(await mutation('request-code',{phone:e.target.phone.value}))$('#sms-code').hidden=false;};
$('#sms-code').onsubmit=async e=>{e.preventDefault();const code=e.target.code.value.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));if(await mutation('verify',{code})){e.target.reset();e.target.hidden=true;appearance();}};
window.addEventListener('online',refreshGreeting);
appearance();await refreshGreeting();
plannerReady=true;displayView();if(owner)resumeEditor();
if(blocked)announce(text(blocked));
initDevice({getSnapshot:snapshot,onMessage:announce,onChange:scanAlerts})
  .then(result=>{device=result;}).catch(error=>announce(error.message));
