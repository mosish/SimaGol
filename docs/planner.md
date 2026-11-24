# SimaGol occasion planner

Open **/planner/** from the shop navigation. The calendar, editor and in-app reminder inbox run locally in the browser. Installation is optional. On the first online visit, allow the service worker to finish downloading the app shell before disconnecting.

## Run and build

From the SimaGol repository with a supported Node.js runtime (24.13+):

```powershell
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run db:setup
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd start
```

Use **http://localhost:3000/planner/** on the development computer. For testing on a phone, deploy the release directory printed by the build to an HTTPS origin, or use the existing Docker deployment with an HTTPS proxy. Opening an HTML file or using an insecure LAN IP does not reproduce an installed PWA. The build applies a content-based version to the offline cache. Ship the generated public and server directories from the same release. Keep the production database and VAPID key material outside the release directory.

**Background delivery setup.** Generate a private VAPID key and configure a monitored contact on the host using the [push runbook](planner-push.md).

## Dates and storage

- Choose a date in the month view, then add a birthday, anniversary, personal custom date, or flower-order occasion. Record a recipient, note or florist URL. The entry list provides edit and delete controls.
- Personal dates have a configurable lead in days. One day and one week correspond to 1 and 7. A flower-order occasion always generates both a three-day notice and a one-day notice.
- Select a region and choose a suggested occasion. The preset retains its rule, so a saved US Mother's Day moves to the second Sunday of May in each new year. Iran and US presets and their sources are documented in [occasions.md](occasions.md).
- Civil dates are stored as Gregorian YYYY-MM-DD. Default reminder time is 09:00 in the detected device zone. You can pin a different IANA zone, such as Asia/Tehran. A February 29 annual entry uses February 28 in non-leap years. For a daylight-saving gap the time moves forward by the gap. For a repeated clock time the earlier instant wins.
- The server stores each member’s events and notes. A scoped browser cache supports offline access after sign-in. Legacy, unowned entries can be imported explicitly by their owner. On some devices the Home Screen installation has separate storage from a browser tab. Add the app to the Home Screen before entering your real dates there.
- While visible, the planner checks every 30 seconds. Opening it later adds missed reminders to the inbox. A stable identifier per entry, occurrence and lead prevents duplicate inbox rows.
- With network access, sign in to the shop and enable device notifications in the planner. The push subscription sends scheduling fields. Member event records and notes are separately stored in the account database. The lock-screen message opens the planner for details.
- Offline edits take effect locally immediately. The server keeps the last synced schedule until the planner reconnects. When travelling, open the app online to update a schedule that follows the device zone.

## Install and acceptance checks

| Check | Procedure | Expected result |
| --- | --- | --- |
| Android installation | Visit the HTTPS shop in Chrome. Use Install when offered or the browser menu. Launch the new icon. | Standalone storefront with four bottom tabs, home-screen icon and operating-system launch screen. |
| iOS installation | In Safari open Share → Add to Home Screen. Enable Open as Web App where offered. Launch from the new icon. | Standalone storefront with four bottom tabs. Matching iPhone and iPad sizes have portrait and landscape startup images. |
| Offline persistence | First open online. Save a birthday, close the app, enable airplane mode and reopen from its icon. Edit, reload, delete, reload. | The shell loads and both edits and deletion persist. Shopping and push sync require connectivity. |
| Regional recurrence | Save US Mother's Day, then view May 2027 and May 2028. | May 9 and May 14. The matching flower reminders fall on May 6/8 and May 11/13 respectively. |
| In-app fallback | Deny notification permission. Set a personal entry due today with a zero-day lead and a reminder time a few minutes ahead. | An unread reminder appears after that local time, including on the next opening. |
| Closed-app delivery | On a push-configured staging host sign in, enable notifications, then save an occasion exactly three calendar days ahead. Set the time a few minutes ahead and keep the network on. Close the app. | A notification opens the planner with the matching entry. Repeat for an occasion one day ahead. Check the inbox contains one row per lead. |
| Accessibility | Test at a narrow viewport, change FA/EN, navigate by keyboard, then test VoiceOver or TalkBack. | Controls have accessible names, direction changes, focus is visible and the calendar remains usable. |

Mobile OSs control notification presentation and timing. Focus modes, connectivity, battery restrictions and provider queues can delay a scheduled message. A suspended service worker cannot run a reliable local alarm. Web Push on iOS/iPadOS requires version 16.4 or later, Home Screen installation, permission requested from a user gesture and a running push server. Browser support for the native install prompt varies. [WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [MDN install prompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)

## Source map

```text
public/planner/
  index.html       Calendar, forms, install metadata and iOS startup images
  planner.css      Responsive touch controls, focus and theme styles
  app.js           Calendar rendering, CRUD, local preferences and reminder inbox
  dates.js         Regional rules, recurrence and zoned reminder instants
  store.js         Versioned browser storage, validation, update and deduplication
  device.js        Installation, notification permission and schedule sync
  manifest.json    Standalone installation metadata
  sw.js            Offline cache, Web Push display and notification activation
  images/          PNG icons and size-specific startup images
server/push.js     Persistent scheduler and VAPID sender
scripts/build.js   Versioned deployable release
tests/             Date, storage, push, shell and mobile browser checks
```

## SMS setup

Set KAVENEGAR_API_KEY, SMS_OTP_TEMPLATE and SMS_REMINDER_TEMPLATE on the host and restart the Node service. Both provider-approved lookup templates take one token. The verification template uses a six-digit code. The reminder template uses the number of calendar days before the occasion (0 means today). Members verify their own number and enable SMS on individual events. Each account and address can request at most five codes in 24 hours. Verification expires after five minutes.

A single running Node instance scans every 30 seconds and can catch up one hour after downtime. Confirm a real delivery on the deployment host. Provider timeouts are recorded as unconfirmed to avoid sending duplicates. Back up the SQLite database, which contains private planner data. Keep the provider key on the server.
