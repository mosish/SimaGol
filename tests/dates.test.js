import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLIDAYS, dueAlerts, eventsInMonth, holidayDate, localDate, reminderInstant } from '../public/planner/dates.js';

const birthday = { id: 'b1', name: 'Sima', kind: 'personal', date: '2000-02-29', annual: true, daysBefore: 2 };

test('Iran resolves solar Hijri dates independently for each Gregorian year', () => {
  assert.equal(holidayDate('ir-nowruz', 2024), '2024-03-20');
  assert.equal(holidayDate('ir-nowruz', 2025), '2025-03-21');
  assert.equal(holidayDate('ir-doctors', 2024), '2024-08-22');
  assert.equal(holidayDate('ir-doctors', 2025), '2025-08-23');
  const august = eventsInMonth({region:'IR',year:2025,month:8});
  assert.deepEqual(august.map(h => [h.id,h.date]), [['ir-doctors','2025-08-23']]);
  assert.equal(HOLIDAYS.filter(h => h.region === 'IR').length, 2);
  const events = [{ id: 'norooz', name: 'Send flowers', date: '2024-03-20', kind: 'occasion', holidayId: 'ir-nowruz' }];
  const alerts = dueAlerts({ events, timeZone:'Asia/Tehran', from:'2025-03-17T00:00Z', to:'2025-03-21T00:00Z' });
  assert.deepEqual(alerts.map(x => x.dueAt), ['2025-03-18T05:30:00.000Z','2025-03-20T05:30:00.000Z']);
});

test('US and India use distinct observance rules; movable rules update every year', () => {
  assert.equal(new Set(HOLIDAYS.map(h => h.id)).size, HOLIDAYS.length);
  assert.equal(holidayDate('us-doctors', 2027), '2027-03-30');
  assert.equal(holidayDate('in-doctors', 2027), '2027-07-01');
  assert.equal(holidayDate('us-mothers', 2026), '2026-05-10');
  assert.equal(holidayDate('us-mothers', 2027), '2027-05-09');
  assert.equal(holidayDate('us-teachers', 2029), '2029-05-08');
  assert.equal(holidayDate('in-teachers', 2029), '2029-09-05');
  assert.equal(holidayDate('missing', 2029), null);
});

test('month display includes regional suggestions and respects the first date of saved entries', () => {
  const e = { id: 'gift', name: 'Mum', kind: 'occasion', date: '2027-05-09', holidayId: 'us-mothers', annual: true };
  const once = { id: 'oneoff', name: 'Graduation', kind: 'occasion', date: '2027-05-21', annual: false };
  const month = (year) => eventsInMonth({ year, month: 5, region: 'US', events: [e, once] });
  assert.ok(month(2026).some(x => x.id === 'us-mothers' && x.source === 'holiday'));
  assert.ok(!month(2026).some(x => x.source === 'custom'));
  assert.ok(month(2027).some(x => x.id === 'oneoff'));
  assert.ok(!month(2028).some(x => x.id === 'oneoff'));
  assert.equal(month(2028).find(x => x.id === 'gift').date, '2028-05-14');
  assert.ok(!eventsInMonth({year: 2027, month: 5, region: 'US', events: [{...e, date: '2027-05-10'}]})
    .some(x => x.id === 'gift'));
});

test('February 29 annual birthdays recur on February 28 in short years', () => {
  const month = year => eventsInMonth({ year, month: 2, events: [birthday] })[0];
  assert.equal(month(2027).date, '2027-02-28');
  assert.equal(month(2028).date, '2028-02-29');
  assert.equal(month(1999), undefined);
  const alerts = dueAlerts({from:'2027-02-22T00:00Z',to:'2027-03-01T00:00Z',events:[birthday],timeZone:'UTC'});
  assert.deepEqual(alerts.map(a => [a.dueAt, a.daysBefore]), [['2027-02-26T09:00:00.000Z', 2]]);
});

test('calendar-day lead stays at local 09:00 across offset changes', () => {
  assert.equal(reminderInstant('2026-03-09', 2, '09:00', 'America/New_York'), '2026-03-07T14:00:00.000Z');
  assert.equal(reminderInstant('2026-03-09', 1, '09:00', 'America/New_York'), '2026-03-08T13:00:00.000Z');
  assert.equal(reminderInstant('2027-01-01', 1, '09:00', 'Asia/Kolkata'), '2026-12-31T03:30:00.000Z');
  assert.equal(localDate('2026-12-31T22:30:00Z','Asia/Tehran'), '2027-01-01');
});

test('DST gaps shift by the transition and overlaps use the earlier instant', () => {
  assert.equal(reminderInstant('2026-03-08', 0, '02:30', 'America/New_York'), '2026-03-08T07:30:00.000Z');
  assert.equal(reminderInstant('2026-11-01', 0, '01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
  assert.equal(reminderInstant('2011-12-30', 0, '09:00', 'Pacific/Apia'), '2011-12-30T19:00:00.000Z');
  assert.throws(() => reminderInstant('2026-02-29', 0), RangeError);
  assert.throws(() => reminderInstant('2026-02-28', 0, '24:00'), RangeError);
});

test('saved occasions produce exactly two stable notices across year boundaries', () => {
  const event = { id: 'new-year', date: '2026-01-01', name: 'Gift', kind: 'occasion', annual: true, daysBefore: 12 };
  const query = { from: '2026-12-29T09:00Z', to: '2027-01-01T00:00Z', events: [event], timeZone: 'UTC' };
  const found = dueAlerts(query);
  assert.deepEqual(found.map(x => x.key), ['new-year:2027-01-01:3', 'new-year:2027-01-01:1']);
  assert.deepEqual(dueAlerts(query), found);
  assert.equal(dueAlerts({ ...query, to: '2026-12-31T09:00Z' }).length, 1);
  assert.deepEqual(dueAlerts({ ...query, events: [], region: 'US' }), []);
});

test('saved regional occasions retain movable calendar rules for alerts', () => {
  const event = { id: 'mum', kind: 'occasion', name: 'Mum', date: '2026-05-10', holidayId: 'us-mothers' };
  const alerts = dueAlerts({ from:'2027-05-01T00:00Z',to:'2027-05-11T00:00Z', events:[event], timeZone:'Europe/Berlin' });
  assert.deepEqual(alerts.map(x => x.dueAt), ['2027-05-06T07:00:00.000Z', '2027-05-08T07:00:00.000Z']);
});
