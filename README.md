# SimaGol | سیماگل

SimaGol is a bilingual flower shop for customers who want to choose an arrangement, send it to a recipient and follow its delivery. Persian opens right-to-left by default. The visible FA/EN and theme controls switch the entire interface. The clay-style surfaces work in both light and dark modes.

## Five-phase delivery plan

The working domain is `simagol.com`. Develop against `localhost` and select the final domain at launch. HostIran is the preferred provider. The owner plans to buy hosting in Phase 5, once the project has passed local acceptance.

1. **Local foundation and UX design**
   - [ ] Review the Persian mobile journey from an occasion reminder to bouquet selection and checkout with the shop owner. Use the local application and Figma for review.
2. **Bilingual design system**
   - [ ] Approve desktop and mobile layouts, RTL/LTR switching, light/dark surfaces, accessible controls and the editable Sima placeholder.
3. **Storefront and occasion planner**
   - [ ] Verify catalog, gifting, delivery, account and order tracking together. Test the offline planner and its three-day and one-day reminders.
4. **Admin and local acceptance**
   - [ ] Have staff edit inventory, bilingual content and delivery options, then fulfil a test order. Complete automated tests and review the release with the owner.
5. **Hosting purchase and deployment**
   - [ ] Select a compatible HostIran plan and the final domain, configure DNS and HTTPS, and set `APP_ORIGIN` on the host. Verify the release, backup restoration and mobile installation/push on that origin before opening checkout. Follow the [deployment runbook](docs/deployment.md).

## SimaGol PWA

The installed app opens on Home with the newest catalog additions first. The bottom tabs open Home, the upcoming bouquet studio, occasion reminders, and the customer profile. The header bag opens the cart. Signed-in customers can switch between personal details, order status filters, saved addresses, favorites and notifications. After an online visit the offline shell can display the last viewed public catalog and locally saved dates. Checkout and account data require a connection. [Mobile installation and verification](docs/planner.md)

[Preview the Persian mobile home screen](docs/mobile-home.png)

Open [/planner/](http://localhost:3000/planner/) for the Persian/English installable occasion calendar. Visitors can browse. Members save events in their account with an account-scoped offline copy. Solar Hijri is the default across the site, with an independent Gregorian toggle. Staff sign in at `/admin`. Regional observances support automatic three-day and one-day flower reminders. See the [planner setup and mobile testing checklist](docs/planner.md), [regional rules](docs/occasions.md) and [background push setup](docs/planner-push.md).

## Try the shop on Windows

Install Node.js **24.13 or newer** with built-in SQLite and npm. Open PowerShell in this folder:

```powershell
node --version
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:setup
npm.cmd start
```

Use **http://localhost:3000/**, including that hostname. The default APP_ORIGIN matches it. The first database setup seeds sample products, fees and a dated delivery window. Repeat setup preserves an existing shop. npm.cmd also works when PowerShell restricts execution of npm.ps1. On Linux or macOS use npm and copy the environment file with cp.

1. Browse bouquets, try the language and theme switches, open a product and add it to your bag. The bag and guest favorites persist in the current browser. Signed-in members keep favorites, locale and theme preferences in their account.
2. Open **Account** and register with a name, email and password of at least 12 characters. In a second terminal promote the intended account if you manage the shop:

```powershell
npm.cmd run admin -- owner@example.com
```

3. Use the email you registered. Refresh the page. In **Staff**, update stock, translations, a delivery fee or the Sima mascot placement. The initial mascot is a labeled placeholder for the owner's reference image.
4. To place a **local test order**, set ORDERS_ENABLED=true in .env and restart the process. Select a delivery method, recipient address and optional wrap or gift message. The shop computes the total in rial and displays it in toman. A successful checkout creates a **pay-on-delivery** order. Use fictional recipient details when testing.
5. Open the invoice, print it, or reorder available items. Update the order from Staff and check Account in a second browser session. The visible account screen refreshes order history and its notification inbox every 15 seconds. Members can mark displayed updates as read.

## Included workflows

| Shopper | Florist and store management |
| --- | --- |
| Bilingual catalog, category filters, text search, product detail, favorites and cart | Products, categories, product visibility, prices and stock |
| Sign-up/login, profile, saved addresses and persisted preferences | Owner-only customer list and role controls |
| Standard, express and scheduled delivery with capacity-limited slots | Delivery methods, fees, gift wrap charges and slot capacity |
| One-time purchases, gift wrap, gift messages and printable invoices | Bilingual text overrides, logo, hero, product images, announcement banner, homepage section order and four Sima placements |
| Order history, in-app order status updates and reorder | Placed, preparing, shipped, delivered and cancelled status management |

An online gateway, subscription billing, email/SMS alerts and self-service password reset are follow-on work. Bank credentials and card numbers have no place in this release. Iran-specific gateway selection, merchant verification, tax registration, eNAMAD applicability and account approval must be confirmed with the chosen provider before a future online-payment launch. [ZarinPal merchant page](https://www.zarinpal.com/payment-gateway/) · [Payment API documentation](https://www.zarinpal.com/docs/paymentGateway/)

## Architecture

Vanilla browser JavaScript and CSS call a same-origin Node HTTP API. SQLite holds users, sessions, content, slots and orders. A single SQLite transaction checks stock, price and slot capacity, reserves the order and writes the invoice snapshot. The server stores salted scrypt password hashes and only the SHA-256 digests of opaque session tokens. Portfolio or marketing copy can be edited in Staff using translation keys. No frontend compilation or application database service is required.

| Folder | Purpose |
| --- | --- |
| public/ | HTML, CSS, bilingual label dictionary, components and illustrative imagery |
| server/ | HTTP routes, authentication, SQLite schema, seed data and order handling |
| scripts/ | Database setup, account promotion and lint commands |
| tests/ | Node test-runner coverage for authentication, orders and HTTP behavior |
| docs/ | Design, API, source tree, version-control and deployment guides |
| data/ | Runtime database, WAL sidecars and uploaded media, excluded from Git |

Read the [file tree](docs/tree.txt), [design details](docs/design.md), [API guide](docs/api.md), [GitHub instructions](docs/github.md) and [deployment runbook](docs/deployment.md).

## Configuration

| Variable | Development default | Operator action |
| --- | --- | --- |
| NODE_ENV | development | Use production behind HTTPS for Secure cookies and HSTS. |
| APP_ORIGIN | http://localhost:3000 | Exact public scheme, hostname and non-default port. POST requests must match. |
| HOST | 127.0.0.1 | Listen locally for a host reverse proxy. Containers listen on 0.0.0.0 internally. |
| PORT | 3000 | TCP listener. Match the reverse-proxy upstream. |
| DATA_DIR | ./data | Dedicated writable directory. Use persistent /app/data in the container. |
| ORDERS_ENABLED | false | Set to true when the operator can fulfil COD orders. Restart after changing. |

### Roles

Customers can manage their own profile and orders. Florists can see the fulfilment queue, dispatch orders and view customer delivery details on those orders. Editors manage catalog, imagery, copy and delivery configuration. Owners have all staff permissions plus customer listing and role changes. An owner cannot demote the last owner. The local promotion command requires host access.

## Checks and troubleshooting

```powershell
npm.cmd run lint
npm.cmd test
curl.exe --fail http://localhost:3000/api/health
```

| Symptom | Check |
| --- | --- |
| Node reports a missing node:sqlite module | Run node --version in this shell and select the supported runtime in PATH. |
| EADDRINUSE | Stop the earlier development process, or update PORT and APP_ORIGIN together. |
| Registration or another write returns 403 | Open the URL in APP_ORIGIN. localhost and 127.0.0.1 are distinct origins. For production, check HTTPS, cookies and forwarded host configuration. |
| Sign-in returns 429 | Login and register share 30 attempts per socket IP per ten-minute window. A busy password-hashing pool also returns 429. Wait and retry. Proxy behavior is described in the deployment guide. |
| Shop shows a network error | Check /api/health and server logs. When connectivity returns, use Retry. The last displayed order list is kept until polling succeeds. |
| Checkout timed out | Check Account first. Retry the unchanged checkout in the same browser with its existing request key. A changed basket or recipient describes a new checkout. |
| Ordering is closed / price or availability changed | Review ORDERS_ENABLED, active methods, unexpired slots and quantities. Reload the catalog and confirm the revised total. |
| Database is read-only or catalog vanished after redeploy | Check DATA_DIR, mounted volume ownership and release working directory. Restore a verified backup if the wrong volume was initialized. |

## License and imagery

LICENSE is a placeholder pending the owner's choice. An open-source license must be selected before representing the code as open source. CREDITS.md describes the sample bouquet photography-style assets. Replace illustrations with photographs of merchandise and obtain rights for the final logo and Sima portrait before a public launch.
