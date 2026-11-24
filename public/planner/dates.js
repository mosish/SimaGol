// Date strings are Gregorian civil dates. UTC arithmetic here counts calendar
// days; the selected time zone is applied only when converting to an instant.
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isoDay = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

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
  IR: [
    ['nowruz', 'Nowruz', 'نوروز', { month: 3, persianMonth: 1, persianDay: 1 }],
    ['doctors', "Iranian Physicians' Day", 'روز پزشک', { month: 8, persianMonth: 6, persianDay: 1 }]
  ]
};
export const HOLIDAYS = Object.entries(regional).flatMap(([region, rows]) =>
  rows.map(([slug, en, fa, rule]) => ({
    id: `${region.toLowerCase()}-${slug}`, region, name: { en, fa }, ...rule
  }))
);
const byId = new Map(HOLIDAYS.map(rule => [rule.id, rule]));
const solarDates = new Map();
const persian = new Intl.DateTimeFormat('en', {
  calendar: 'persian', numberingSystem: 'latn', timeZone: 'UTC', month: 'numeric', day: 'numeric'
});

function persianOccurrence(rule, year) {
  const key = `${rule.id}/${year}`;
  if (solarDates.has(key)) return solarDates.get(key);
  if (persian.resolvedOptions().calendar !== 'persian') throw new RangeError('Persian calendar unavailable');
  const start = Date.UTC(year, rule.month - 1, 1);
  const end = Date.UTC(year, rule.month, 1);
  for (let at = start; at < end; at += DAY) {
    const parts = persian.formatToParts(at);
    const month = Number(parts.find(p => p.type === 'month').value);
    const day = Number(parts.find(p => p.type === 'day').value);
    if (month === rule.persianMonth && day === rule.persianDay) {
      const date = new Date(at).toISOString().slice(0, 10);
      solarDates.set(key, date);
      return date;
    }
  }
  return null;
}

export function holidayDate(id, year) {
  const rule = byId.get(id);
  if (!rule || !Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if (rule.persianMonth) return persianOccurrence(rule, year);
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

function occurrence(event, year) {
  const original = parseDay(event.date);
  if (!original || year < original.year) return null;
  if (event.holidayId) {
    const date = holidayDate(event.holidayId, year);
    return date && date >= event.date ? date : null;
  }
  if (!event.annual) return original.year === year ? event.date : null;
  const lastDay = new Date(Date.UTC(year, original.month, 0)).getUTCDate();
  return isoDay(year, original.month, Math.min(original.day, lastDay));
}

export function eventsInMonth({ year, month, region, events = [], holidayIds }) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid calendar month');
  }
  const rows = [];
  for (const holiday of HOLIDAYS) {
    if (holiday.region !== region || holiday.month !== month || (holidayIds && !holidayIds.includes(holiday.id))) continue;
    rows.push({ id: holiday.id, holidayId: holiday.id, name: holiday.name, region, date: holidayDate(holiday.id, year), source: 'holiday' });
  }
  const prefix = `${year}-${pad(month)}-`;
  for (const event of events) {
    const date = occurrence(event, year);
    if (date?.startsWith(prefix)) rows.push({ ...event, date, source: 'custom' });
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
        const date = occurrence(event, year);
        if (!date || date < earliest || date > latest) continue;
        const dueAt = reminderInstant(date, lead, time, timeZone);
        const due = Date.parse(dueAt);
        if (due >= start && due < end) {
          rows.push({ ...event, date, source: 'custom', daysBefore: lead, dueAt, key: `${event.id}:${date}:${lead}` });
        }
      }
    }
  }
  return rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.key.localeCompare(b.key));
}
