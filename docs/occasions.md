# Occasion calendar and reminder dates

A birthday saved as February 29 stays a date in the member's calendar. The planner celebrates it on February 28 during a non-leap year and on February 29 in a leap year. A one-time gift date appears once. Annual entries begin at the saved date, so adding a future anniversary does not create earlier anniversaries.

## Regional presets

The default calendar is Solar Hijri in both UI languages. Changing the display to Gregorian preserves the saved civil date. Birthday recurrence follows the calendar used at creation. Old personal entries retain their Gregorian anniversaries.

Both display modes show the Iranian heritage collection. Solar festival dates follow the AncientIran dataset, including its convention for traditional month-name festivals. Nowruz spans the first four days of Farvardin. Chaharshanbe Suri starts on the eve of the last Wednesday of Esfand. The six lunar presets are Father’s Day, Mother’s Day, Youth Day, Nurses’ Day, Veterans’ Day and Girls’ Day. Confirmed Iranian lunar dates extend through 1405. Previously saved reminders retain their recurrence and remain accessible in My occasions.

Sources: [Iranian Calendar Center](https://calendar.ut.ac.ir/documents/2139738/7092644/Calendar-1405.pdf), [CC0 event definitions](https://github.com/persian-calendar/events), [Iranian lunar month records](https://github.com/persian-calendar/calendar/blob/main/src/commonMain/kotlin/io/github/persiancalendar/calendar/islamic/IranianIslamicDateConverter.kt).

## Scheduling policy

1. Store dates as Gregorian YYYY-MM-DD strings. Keep the recurring holiday's stable ID for saved regional occasions. May 10, 2026 and May 9, 2027 both match US Mother's Day. A member who saved that occasion sees the new date each year, even after switching calendar systems.
2. A saved personal entry uses its one selected daysBefore value (default one day). A saved occasion uses exactly three days and one day. Regional suggestions alone do not create notices. Two recipients with separate saved entries can receive separate reminders for the same holiday.
3. Subtract the lead in **local calendar days**, then resolve the member's chosen HH:mm time, default 09:00. For example, a March 9 event in New York with a two-day lead uses March 7 at 09:00. Across a DST transition that interval can differ from 48 elapsed hours.
4. During a fall-back overlap use the earlier of the two possible instants. During a spring-forward gap move forward by the gap size. For example, a nonexistent New York 02:30 becomes 03:30. This also handles half-hour offsets and countries that skipped a whole calendar day.
5. Query a half-open interval: include a notice exactly at the start and exclude one exactly at the end. The next scan picks up that boundary. A stable key combines the saved entry ID, resolved occurrence date and lead. An inbox or delivery service can deduplicate overlapping scan windows using this key within the member's account.

## Shared date module

Use public/planner/dates.js from either the browser or server. Its only dependencies are the platform's Date and Intl implementations. Update runtime time-zone data with the host's normal runtime updates.

| Export | Purpose |
| --- | --- |
| HOLIDAYS | Rules with id, region, bilingual name, month and fixed-day or weekday parameters. |
| holidayDate(id, year) | Resolve a known rule to a Gregorian date string; returns null for unknown IDs. |
| eventsInMonth({year, month, region, events, holidayIds}) | List region suggestions and saved events in a one-based month. Optional holidayIds filters suggestions. Rows mark suggestions as holiday and saved entries as custom. |
| localDate(instant, timeZone) | Return the Gregorian civil date at an instant in the chosen zone. |
| reminderInstant(date, daysBefore, time, timeZone) | Resolve a local reminder to an ISO UTC instant. Default time is 09:00 and default zone Asia/Tehran. |
| dueAlerts({from, to, events, timeZone, time}) | Return due records in chronological order. Each record contains the saved entry fields, occurrence date, actual daysBefore, UTC dueAt and stable key. Pass instants with explicit offsets or UTC timestamps. |

Run `node --test tests/dates.test.js` to exercise regional differences, changing weekdays, one-time events, leap birthdays, time-zone transitions, December–January carries and idempotent reminder keys.
