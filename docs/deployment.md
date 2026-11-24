# Deploy a single SimaGol shop

The application serves the storefront and JSON API from one long-running Node process. Choose a small Linux host with Docker Compose and a local persistent disk, or a Node-capable hosting plan with process restart, HTTPS proxying and persistent writable storage. A PHP-only shared hosting plan or static pages service cannot execute this shop's API. SQLite currently supports one application instance in this deployment. Place the database and uploads on the same persistent volume. Add capacity measurements and a database migration plan before scaling to multiple replicas.

## 1. Prepare the host, domain and origin

1. Choose a domain and compare registration, renewal and transfer terms. Register in the shop owner's account, enable MFA and set renewal reminders. Record the host's public IP and recovery contact.
2. At the authoritative DNS provider, set the apex A record to the server's IPv4 address. If using www, create the appropriate alias and choose one canonical origin. Add AAAA only if the proxy is reachable over IPv6. Preserve existing mail records and test resolution.
3. Install Docker Engine with Compose and a host reverse proxy. Expose public ports 80/443; restrict administrative access. Keep the database, private environment and container listener off the public network. On a managed Node service, confirm a supported Node version, minimum memory for two concurrent scrypt jobs (about 256 MiB plus application/OS overhead), local SQLite locking support and an off-host backup path.
4. From a clean release checkout copy .env.example to .env. Set APP_ORIGIN to the actual HTTPS origin, for example https://flowers.example.com, and keep ORDERS_ENABLED=false during setup. Replace the sample hostname everywhere below. Compose explicitly sets NODE_ENV=production, internal HOST=0.0.0.0, PORT=3000 and DATA_DIR=/app/data. For a non-container process set all six values yourself. Use a service account and persistent absolute DATA_DIR.
5. Configure HTTPS termination. For example, on a host running Caddy the site entry is:

```caddyfile
flowers.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Add a redirect for any alternate hostname, then validate and reload the host's proxy configuration. APP_ORIGIN must match what the customer sees in the browser. Ensure the proxy accepts the 2.9 MB JSON upload envelope, and never log cookies, passwords, addresses or gift messages. [Caddy reverse-proxy guide](https://caddyserver.com/docs/quick-starts/reverse-proxy)

## 2. Build and stage

From the release checkout on Linux:

```sh
npm ci
npm run lint
npm test
docker compose config --quiet
docker compose build --pull
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://flowers.example.com/api/health
```

The image runs as the unprivileged node user. Compose binds 127.0.0.1:3000:3000 on the host and mounts the flower-data named volume at /app/data. All other application paths are read-only. First boot initializes the SQLite schema and an illustrative four-product catalog. Record the Git SHA, running image ID and mount name. Tag or retain this image for rollback.

```sh
git rev-parse HEAD
docker inspect --format '{{.Image}}' "$(docker compose ps -q shop)"
docker inspect --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}' "$(docker compose ps -q shop)"
```

Register the owner's email over HTTPS, then provision access from the host. Refresh the browser after promotion.

```sh
docker compose exec shop node scripts/admin.js owner@example.com
```

The authentication limiter uses the socket peer address. With a single reverse proxy many customers may share the same 30-attempt/10-minute bucket. Test expected sign-in volume and failure behavior before launch. If higher traffic is required, implement end-to-end trusted-proxy identification and distributed limits; do not trust a browser-supplied forwarding header. Monitor service memory, response times, available disk, upload growth, health checks, backup age and 429/5xx rates. Check logs with docker compose logs --tail=100 shop.

## 3. Back up and restore

Persist the **whole** DATA_DIR, including shop.sqlite, any SQLite sidecars and uploads/. Save the release SHA, image, proxy configuration and a securely stored environment configuration separately. Backups contain customer information and active session records. Limit access, encrypt off-host copies, choose retention with the owner, and rehearse recovery. Schedule during an approved maintenance window. A target such as a daily backup can lose up to a day of orders; choose a more frequent schedule if the shop cannot absorb that loss.

For a consistent cold backup on Linux, set BACKUP_ROOT to a protected absolute directory **outside the checkout and volume**. The following stops only the shop, copies the stopped container's mounted data and restarts the service even after a failed copy. Run as a host user authorized for Docker and the backup location. Mark a failed copy as unusable.

```sh
set -eu
umask 077
BACKUP_ROOT=/srv/backups/simagol
snapshot="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$snapshot/data"
container_id=$(docker compose ps -q shop)
test -n "$container_id"
docker compose stop shop
trap 'docker compose start shop >/dev/null' EXIT
docker cp "$container_id:/app/data/." "$snapshot/data/"
test -s "$snapshot/data/shop.sqlite"
git rev-parse HEAD > "$snapshot/commit.txt"
docker inspect --format '{{.Image}}' "$container_id" > "$snapshot/image.txt"
docker compose start shop
trap - EXIT
```

For a zero-downtime database copy, use SQLite's supported online backup API and coordinate that snapshot with media backup. Copying only a live main database file can omit committed WAL data. [Docker container copy reference](https://docs.docker.com/reference/cli/docker/container/cp/) · [SQLite backup API](https://sqlite.org/backup.html)

**Restore drill.** Use a separate host or fresh Compose project and an empty volume. With the production shop running, these Linux commands populate a separate drill volume and check the restored database. Set snapshot to the absolute backup path, preserve the original files, and use the image corresponding to the recorded SHA. The copy step runs as root solely to read the private host backup and assign the restored volume to node.

```sh
drill="simagol-restore-$(date +%s)"
docker compose -p "$drill" build shop
docker compose -p "$drill" run --rm --no-deps --user root \
  --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
  --volume "$snapshot/data:/restore:ro" --entrypoint sh shop \
  -c 'cp -a /restore/. /app/data/ && chown -R node:node /app/data'
docker compose -p "$drill" run --rm --no-deps --entrypoint node shop \
  --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/app/data/shop.sqlite'); console.log(db.prepare('PRAGMA integrity_check').all()); console.log(db.prepare('SELECT count(*) AS orders FROM orders').get()); db.close();"
```

The temporary root utility receives file-copy capabilities only for this restore. Require integrity_check to report ok. Compare order counts to your backup record, inspect a historical invoice and open its referenced media in an isolated staging instance. Keep ORDERS_ENABLED=false for the restored drill. An expired customer session after restore should lead to sign-in. Track actual recovery time and repeat after release changes.

## 4. Adopt the shop for live COD orders

- [ ] Owner approves branding and imagery rights, store copy in both languages, colors, cancellation/refund terms, delivery service areas, recipient-data retention, privacy notice and customer contact channel. Select a software license before open-source distribution.
- [ ] Replace demo prices, inventory, stock photos, delivery fees and dated sample slots. Confirm each enabled method with the florist who will handle it. Keep unapproved Sima placements empty.
- [ ] Assign owner/editor/florist accounts individually. Test order ownership, role restrictions, origin checks and HTTPS-only production sessions. Agree on a credential recovery process.
- [ ] Use a separate staging domain and volume to test a bilingual COD order, duplicate submit, sold-out product, full slot, staff status update, cancellation, print invoice and reorder in both themes. Test on an actual phone and with a keyboard.
- [ ] Restore a backup, test HTTPS after a service restart, check DNS/certificate renewal and record the release SHA, rollback image, emergency contact and monitoring destination.
- [ ] Confirm staff will monitor incoming COD orders. Change ORDERS_ENABLED=true, recreate the service with docker compose up -d and confirm settings.ordersEnabled from /api/store. Place one authorized order with staff present and reconcile stock, printed invoice, physical delivery and cash collection.

The supported notification channel is the persisted in-app account inbox, refreshed alongside order history while visible. Establish contact and reconciliation procedures appropriate to this channel. Online payments, subscription renewals, email/SMS notifications and statutory invoice fields require separate validation and implementation for the selected merchant and jurisdiction. The printable order invoice is a record of this checkout.

## 5. Roll back a release

1. If fulfilment is impacted, set ORDERS_ENABLED=false and run docker compose up -d. Confirm the change through /api/store and notify staff of the cutover.
2. Capture a fresh consistent backup and the list of orders since deployment. Keep the current data volume. Choose the last verified source SHA or previously retained image that is compatible with the current schema.
3. Build and start that release against the existing Compose project name and volume. Verify /api/health, the order count, latest invoices and uploaded media before accepting orders again.
4. If the old code requires older data, recover into a **separate** volume first. Reconcile all orders, deliveries and COD collections made since the snapshot before switching traffic. Retain the original state for audit and reconciliation.

## Client address for throttling

The application defaults to the socket peer. If a reverse proxy fronts all customers, configure it to overwrite X-Real-IP with the client address, then set TRUST_PROXY_ADDRESS to its exact socket peer IP as seen by Node. In Docker this may be the bridge gateway. Leave this setting empty until verified. Keep direct access to the backend restricted so only that proxy can supply this header.
