# Occasion calendar and reminder dates

A birthday saved as February 29 stays a date in the member's calendar. The planner celebrates it on February 28 during a non-leap year and on February 29 in a leap year. A one-time gift date appears once. Annual entries begin at the saved date, so adding a future anniversary does not create earlier anniversaries.

## Regional presets

Iran offers two Solar Hijri occasions. US and India each offer seven gift-giving observances, including common cultural dates. The selected region controls suggestions, and the member's IANA time zone controls the reminder hour. Staff set opening hours and delivery capacity separately.

| Iranian occasion | Solar Hijri date | Gregorian 2024 | Gregorian 2025 |
| --- | --- | --- | --- |
| نوروز · Nowruz | 1 Farvardin | March 20 | March 21 |
| روز پزشک · Iranian Physicians' Day | 1 Shahrivar | August 22 | August 23 |

For each requested Gregorian year, the runtime converts dates with Intl's Persian calendar. A saved Iranian occasion follows its Solar Hijri date the next year. For Iranian lunar observances, choose **Custom occasion**, enter the confirmed Gregorian date for that year and leave annual repetition off. Enter the following year's confirmed occurrence separately. [Nowruz in the Iranian calendar](https://www.iranicaonline.org/articles/nowruz-iii/) · [Physicians' Day on 1 Shahrivar](https://en.ifilmtv.ir/News/Content/45387/)

| Occasion | United States | India |
| --- | --- | --- |
| Valentine's Day | February 14 | February 14 |
| International Women's Day | March 8 | March 8 |
| Doctors' Day | March 30 | July 1 |
| Nurses Day | May 6, National Nurses Day | May 12, International Nurses Day |
| Mother's Day | Second Sunday in May | Second Sunday in May |
| Father's Day | Third Sunday in June | Third Sunday in June |
| Teacher Day | Tuesday following the first Monday in May | September 5 |

**Date references**

- US Mother's Day and Father's Day follow federal observance rules. [36 USC §117](https://www.govinfo.gov/content/pkg/USCODE-2024-title36/html/USCODE-2024-title36-subtitleI-partA-chap1-sec117.htm) · [36 USC chapter 1, §109](https://www.govinfo.gov/content/pkg/USCODE-2024-title36/html/USCODE-2024-title36-subtitleI-partA-chap1.htm)
- US professional observances follow the published dates of the health department and professional associations. Teacher Day falls during Teacher Appreciation Week; in a year where May begins on Tuesday, it falls on May 8. [Doctors' Day](https://www.health.ny.gov/press/releases/2024/2024-03-29_commissioner_statement.htm) · [Nurses Week](https://www.nursingworld.org/nnw) · [Teacher Appreciation Week](https://www.nea.org/TAW)
- For India, consult the Ministry of Health's health-day calendar, the Press Information Bureau's explanation of Teachers' Day and the Indian observance calendar for common family occasions. [Health calendar](https://cbhidghs.mohfw.gov.in/WriteReadData/l892s/Cover.pdf) · [Teachers' Day](https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=152100&lang=1&reg=3) · [Indian calendar](https://www.drikpanchang.com/calendars/indian/indiancalendar.html?lang=en)
- Shared cultural dates reflect the February 14 tradition and the UN's March 8 observance. [Library of Congress](https://www.loc.gov/item/today-in-history/february-14/) · [United Nations](https://www.un.org/en/observances/international-womens-day)

## Scheduling policy

1. Store dates as Gregorian YYYY-MM-DD strings. Keep the recurring holiday's stable ID for saved regional occasions. May 10, 2026 and May 9, 2027 both match US Mother's Day. A member who saved that occasion sees the new date each year, even after switching the region displayed in the calendar.
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
