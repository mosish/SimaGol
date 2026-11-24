// Date strings are Gregorian civil dates. UTC arithmetic here counts calendar
// days; the selected time zone is applied only when converting to an instant.
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isoDay = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

import {iranRules,lunarYearMasks} from './iran.js';
import {calendarParts,addDays,monthStart,monthLength} from '../components/calendar.js';
const iran = iranRules.map(rule=>({...rule,region:'IR',name:{fa:rule.title,en:rule.title}}));
const lunarMonths=[];
let stamp=(2396005-2440588)*DAY;
for(const [year,mask] of lunarYearMasks.entries()){
  for(let month=1;month<=12;month++){
    const length=29+((mask>>(12-month))&1);
    lunarMonths.push({year:year+1264,month,start:new Date(stamp).toISOString().slice(0,10),length});
    stamp+=length*DAY;
  }
}
const yearCache=new Map();
function iranYear(year) {
  if(yearCache.has(year))return yearCache.get(year);
  const result=new Map();
  for(const rule of iran){
    let months=[];
    if(rule.calendar==='Hijri'){
      months=lunarMonths.filter(m=>m.month===rule.month && Math.abs(Number(m.start.slice(0,4))-year)<=1);
    }else{
      const sys=rule.calendar==='Persian'?'persian':'gregory';
      const years=sys==='persian'?[year-622,year-621]:[year];
      months=years.map(y=>({year:y,start:monthStart(y,rule.month,sys),length:monthLength(y,rule.month,sys)}));
    }
    for(const m of months){
      let day=rule.day;
      const weekday=(rule.weekday+6)%7;
      if(rule.rule==='single event' && rule.year!==m.year)continue;
      if(rule.rule==='end of month')day=m.length;
      if(rule.rule==='nth weekday of month')day=1+(weekday-new Date(m.start).getUTCDay()+7)%7+(rule.nth-1)*7;
      if(rule.rule==='last weekday of month')day=m.length-(new Date(addDays(m.start,m.length-1)).getUTCDay()-weekday+7)%7+(rule.offset||0);
      if(!day || day>m.length)continue;
      const date=addDays(m.start,day-1);
      if(!date.startsWith(year+'-') || (rule.calendar==='Hijri' && date>'2027-03-20'))continue;
      if(!result.has(rule.id))result.set(rule.id,[]);
      result.get(rule.id).push(date);
    }
  }
  yearCache.set(year,result);
  return result;
}

const common = [
  ['valentines', "Valentine's Day", 'روز ولنتاین', { month: 2, day: 14 }],
  ['women', "International Women's Day", 'روز جهانی زن', { month: 3, day: 8 }],
  ['mothers', "Mother's Day", 'روز مادر', { month: 5, weekday: 0, nth: 2 }],
  ['fathers', "Father's Day", 'روز پدر', { month: 6, weekday: 0, nth: 3 }]
];
const regional = {
  US: [
    ...common,
    ['doctors', "National Doctors' Day", 'روز پزشک', { month: 3, day: 30 }],
    ['nurses', 'National Nurses Day', 'روز پرستار', { month: 5, day: 6 }],
    ['teachers', 'National Teacher Day', 'روز معلم', { month: 5, weekday: 1, nth: 1, extraDays: 1 }]
  ],
  IN: [
    ...common,
    ['doctors', "National Doctors' Day", 'روز پزشک', { month: 7, day: 1 }],
    ['nurses', 'International Nurses Day', 'روز جهانی پرستار', { month: 5, day: 12 }],
    ['teachers', "Teachers' Day", 'روز معلم', { month: 9, day: 5 }]
  ],

};
export const HOLIDAYS = iran.concat(Object.entries(regional).flatMap(([region, rows]) =>
  rows.map(([slug, en, fa, rule]) => ({
    id: `${region.toLowerCase()}-${slug}`, region, name: { en, fa }, ...rule
  }))
));
const byId = new Map(HOLIDAYS.map(rule => [rule.id, rule]));
export function holidayDate(id, year) {
  const rule = byId.get(id);
  if (!rule || !Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if (rule.region==='IR') return iranYear(year).get(id)?.[0]||null;
  if (rule.day) return isoDay(year, rule.month, rule.day);
  const firstWeekday = new Date(Date.UTC(year, rule.month - 1, 1)).getUTCDay();
  const day = 1 + (rule.weekday - firstWeekday + 7) % 7 + 7 * (rule.nth - 1) + (rule.extraDays || 0);
  return isoDay(year, rule.month, day);
}

function parseDay(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const stamp = Date.UTC(year, month - 1, day);
  if (new Date(stamp).toISOString().slice(0, 10) !== date) return null;
  return { year, month, day, stamp };
}

function holidayDates(id,year) {
  if(byId.get(id)?.region==='IR')return iranYear(year).get(id)||[];
  const date=holidayDate(id,year);return date?[date]:[];
}
function occurrences(event,year) {
  const original=parseDay(event.date);
  if(!original||year<original.year)return [];
  if(event.holidayId)return holidayDates(event.holidayId,year).filter(d=>d>=event.date);
  if(!event.annual)return original.year===year?[event.date]:[];
  if(event.calendar==='persian'){
    const [,m,d]=calendarParts(event.date,'persian');
    return [year-622,year-621].map(y=>addDays(monthStart(y,m,'persian'),Math.min(d,monthLength(y,m,'persian'))-1))
      .filter(date=>date.startsWith(year+'-')&&date>=event.date);
  }
  const lastDay=new Date(Date.UTC(year,original.month,0)).getUTCDate();
  return [isoDay(year,original.month,Math.min(original.day,lastDay))];
}
export function eventsInMonth({ year, month, region, events = [], holidayIds }) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid calendar month');
  }
  const rows = [];
  for (const holiday of HOLIDAYS) {
    if (holiday.region!==region || (holidayIds && !holidayIds.includes(holiday.id)))continue;
    for(const date of holidayDates(holiday.id,year)){
      if(Number(date.slice(5,7))===month)rows.push({...holiday,holidayId:holiday.id,date,source:'holiday'});
    }
  }
  const prefix = `${year}-${pad(month)}-`;
  for (const event of events) {
    for (const date of occurrences(event,year)) if (date.startsWith(prefix)) rows.push({ ...event, date, source: 'custom' });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

const formatters = new Map();
function wallParts(instant, timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', {
      timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }
  const parts = {};
  for (const { type, value } of formatters.get(timeZone).formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts;
}

export function localDate(instant, timeZone = 'Asia/Tehran') {
  const { year, month, day } = wallParts(new Date(instant), timeZone);
  return isoDay(year, month, day);
}

function wallStamp(at, zone) {
  const p = wallParts(at, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

export function reminderInstant(date, daysBefore, time = '09:00', timeZone = 'Asia/Tehran') {
  const civil = parseDay(date);
  if (!civil || !Number.isInteger(daysBefore) || daysBefore < 0 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RangeError('Invalid reminder date or time');
  const [hour, minute] = time.split(':').map(Number);
  const target = civil.stamp - daysBefore * DAY + (hour * 60 + minute) * 60000;
  // The surrounding offsets cover regular days, folds, gaps, and skipped dates.
  const probes = [target - 2 * DAY, target, target + 2 * DAY];
  const offsets = new Set(probes.map(at => wallStamp(at, timeZone) - at));
  const candidates = Array.from(offsets, offset => target - offset).sort((a, b) => a - b);
  // Earlier instant for a fold. For a gap advance by its exact duration.
  const result = candidates.find(at => wallStamp(at, timeZone) >= target);
  if (result === undefined) throw new RangeError('Cannot resolve local time');
  return new Date(result).toISOString();
}

export function dueAlerts({ from, to, events = [], timeZone = 'Asia/Tehran', time = '09:00' }) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new RangeError('Invalid alert window');
  if (start === end || !events.length) return [];
  const localStart = parseDay(localDate(start, timeZone));
  const localEnd = parseDay(localDate(end, timeZone));
  const rows = [];
  for (const event of events) {
    const customLead = Number.isInteger(event.daysBefore) && event.daysBefore >= 0 ? event.daysBefore : 1;
    const leads = event.kind === 'occasion' ? [3, 1] : [customLead];
    for (const lead of leads) {
      // Suppress expensive zone conversions for events outside the scan.
      // One extra day covers entire civil dates skipped by a zone transition.
      const earliest = new Date(localStart.stamp + (lead - 1) * DAY).toISOString().slice(0, 10);
      const latest = new Date(localEnd.stamp + (lead + 1) * DAY).toISOString().slice(0, 10);
      for (let year = Number(earliest.slice(0, 4)); year <= Number(latest.slice(0, 4)); year++) {
        for(const date of occurrences(event,year)){
          if(date<earliest || date>latest)continue;
          const dueAt=reminderInstant(date,lead,time,timeZone);
          const due=Date.parse(dueAt);
          if(due>=start && due<end)rows.push({...event,date,source:'custom',daysBefore:lead,dueAt,key:`${event.id}:${date}:${lead}`});
        }
      }
    }
  }
  return rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.key.localeCompare(b.key));
}
