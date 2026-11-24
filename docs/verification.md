# Release verification

ECC's test-first workflow, security review and verification loop were applied to the customer/order API and release checks. The first HTTP integration check failed because the service implementation did not exist. It then passed against the SQLite-backed handler. See the conventional commits and tests for the reproducible evidence.

| Check | Outcome |
| --- | --- |
| Offline install from the lockfile | Passed with zero application dependencies. |
| SQLite schema, seed, restart and integrity | Passed on Windows using Node 26.13.0. |
| Source checks | JavaScript syntax, JSON parsing, bilingual HTML labels and Compose configuration passed. |
| Runtime tests | 17 tests passed for authentication, roles, persisted data, customer isolation, catalog, inventory, fulfilment, notifications, invoice presentation, and media handling. |
| Defensive review | Checked writes for origin/CSRF enforcement, server-owned pricing, transactional reservations, stock restoration, private sessions, role boundaries and non-executable media. |
| Browser and container | CI jobs supplied. Local listener creation returned EACCES, and Docker Desktop's Linux engine was unavailable. A deployed site, production TLS, manual WCAG acceptance and real fulfilment remain unverified. |

Use the commands in the README and deployment runbook to repeat these checks. Node's coverage report describes modules loaded by its tests. Browser startup, assistive technology, real network behavior, and the deployment environment need separate checks.
