# Background reminders

1. Keep the Node service running as one instance with a persistent data directory and outbound HTTPS to the subscribed browser's push service. Enable HTTPS on the public planner origin.
2. Generate the private P-256 key once. The script creates the key in the private data directory and refuses to overwrite an existing key.

   ```sh
   node --env-file-if-exists=.env scripts/push-keys.js
   # For the Compose installation, run this instead against the mounted data volume:
   docker compose run --rm shop node scripts/push-keys.js
   ```

3. Set `VAPID_SUBJECT=mailto:flowers@example.com` in the deployment environment, replacing the address with a monitored contact. Restart Node, or run `docker compose up -d --build`. Check `/api/push/config` for `enabled: true` and a public key. Back up the private PEM together with the database. Replacing it requires devices to enroll again.
4. Sign in, enable device reminders in the planner and grant notification permission. On iOS use the installed Home Screen web app. Test a personal event due in a few minutes, close the app and check the device notification. Tapping it opens the planner. Final device delivery depends on browser permission, connectivity and OS scheduling.

The single-process scheduler checks every 30 seconds. It stores an endpoint, account ID and scheduling fields for each installation. Push schedules exclude personal details. The account planner stores event details separately for signed-in members. The server sends an empty Web Push message, and the service worker displays a generic reminder. Firefox, Chrome/FCM, Apple Web Push and Windows notification service endpoints are supported.

The server resumes up to 24 hours of missed alerts after downtime, groups simultaneous reminders into a single wake-up and records accepted occurrences. It backs off after failures, respects Retry-After and removes expired endpoints. A push accepted immediately before a crash can be retried, and provider acceptance does not guarantee device delivery. The persistent signing key and SQLite file must stay outside public assets.
