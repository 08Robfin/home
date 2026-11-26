# Running Home.

Home uses Node.js 24, its built-in SQLite driver and browser JavaScript. There are no third-party runtime npm packages or build step. The application and mail worker run separately. Nginx Proxy Manager terminates HTTPS and forwards to the app on port 3000 through the configured Docker network. Neither container publishes a host port.

## Local development

Install Node.js 24 or newer. Run `node backend/server.mjs` and open `http://localhost:3000`. The database defaults to `data/home.sqlite`. Run `node --test tests/*.test.mjs` for isolated synthetic-data tests; all email delivery is mocked. A local server does not start a mail worker or send emails automatically.

## Server configuration

Copy `.env.example` to a server-only `.env`, choose the exact public HTTPS origin and verified sender, and point `RESEND_SECRET_FILE` to a restricted file containing a domain-restricted Resend sending key. Keep that file outside the repository, owned by UID 1000 with mode 0600. Never paste credentials into shell arguments, source, screenshots, logs or browser code.

Run `docker compose build app`, then `docker compose up -d --wait app mail-worker`. The existing proxy network must exist. Add a proxy host in Nginx Proxy Manager forwarding the selected domain to `home-app:3000` over HTTP, with a valid TLS certificate, forced HTTPS, caching disabled and a request-body limit large enough for a 5 MB receipt encoded as JSON (8 MB). Do not expose port 3000 or the mail worker publicly.

The web container has no Resend credential. Only the worker mounts the secret, reads pending messages from SQLite and calls Resend over HTTPS. Sending uses a durable outbox, fixed per-message idempotency keys, bounded exponential retry and a 23-hour delivery window. Failed and successful message bodies are erased. Metadata is retained for 30 days. Verification links expire after 24 hours, reset links after one hour and invitations after seven days. Links are single use; link tokens travel in URL fragments, not server request URLs. The application never processes inbound email.

Reminders are opt-in under Settings: email per account and push per browser installation. Users choose chores/payments, 0–14 days before, local time, time zone and optional daily overdue reminders. The worker queues at most one summary per eligible user/channel/local day, after the chosen time. Future monthly templates are included without creating a charge early. Newly added records after that day's digest may only appear in the app. Push is best effort; use the device test button and verify on a real iPhone. See SAFARI.md. Monthly bills retain their original day across shorter months. Recurring chores create the next dated occurrence on completion, preserving missed work rather than silently skipping it.

## Backups and restore

Run `python3 scripts/backup.py /absolute/private/backup-directory` on the host. It takes an online SQLite snapshot, checks integrity and retains 30 days. The database contains receipts as well as household data, password hashes, sessions, pending link tokens and outbox messages; treat every backup as private. Backups deliberately exclude the Resend credential. Keep a separate secure copy of deployment configuration and use the VM's off-server backup for disaster recovery.

To restore: stop `app` and `mail-worker`, preserve the current volume, restore a verified backup as `/data/home.sqlite` in the `home_home_data` volume, remove stale WAL/SHM files only while both services are stopped, and ensure UID 1000 ownership and a 0700 data directory. Before bringing the app online, clear `sessions`, `tokens` and any unsent `mail` from the restored database to prevent old credentials or notifications becoming active again. Restart and verify `/api/health`. Rehearse against an isolated temporary database before touching production.

## Updates and rollback

Back up before an update. Build a new image, run tests, and restart only this Compose project. Do not use `docker compose down -v`; that deletes household data. Keep the previous image and database backup when changing the schema. Version 1 initializes a fresh database; subsequent schema changes need explicit migrations. The notification release adds preference columns and push tables without rewriting existing rows; migration is restart-safe. Defaults preserve email opt-in and use 09:00 Europe/Oslo on the due date.

Inspect `docker compose ps` and the worker's message-status counts for failures. Logs contain generic failure codes; they must not contain credentials, passwords, email bodies or link tokens. A provider accepting a message is distinct from delivery to a recipient's inbox. The automated suite never sends live email.

An explicitly approved live Gmail smoke test on 2026-11-26 confirmed Inbox receipt for verification, the revised household invitation, password reset and an opt-in due reminder. Gmail reported SPF, DKIM and DMARC passing. The original generic invitation went to Spam; the revision includes the inviter and household name and a clear application action. This is evidence from one mailbox, not a guarantee for every recipient. Continue monitoring delivery and avoid repeatedly resending messages to people who did not request them. The smoke test used temporary accounts and records, which were removed afterward.

## Current boundaries

- Records are immediately shared with current members of that household. Existing members can export household records.
- Owners manage roles, transfer ownership and remove members. Admins invite, revoke invitations, rename the household and manage chore assignments and recurring bills. Members manage shared lists, create expenses and complete their own chores.
- Departure is blocked while the person has unfinished assignments, recurring obligations or unsettled amounts. Owners transfer ownership before leaving. Historical financial records remain for the household.
- Expenses are immutable after creation; void an unsettled mistake and add a correction. Sent or confirmed repayments prevent voiding. Only the named recipient confirms or rejects a repayment.
- There is no banking integration, automatic transfer, offline editing, furniture ownership ledger or account/household deletion flow in this release. A server operator must handle deletion and retention requests after resolving shared records. Do not upload signed contracts or bank credentials.
- Authentication limits are persistent. Because forwarded IP headers are not trusted, the proxy's authentication limit is shared (60 requests per 15 minutes), with additional per-email limits. This is suitable for a small deployment; review it before larger-scale public promotion.
- The service worker caches only the static application shell; private API responses and receipts are never cached. An offline shell can open, but requires connectivity to sign in and retrieve data.

## Push operations

VAPID signing material and private device subscriptions live in SQLite and its backups; no external API key is required for browser push. Do not export these tables or rotate keys casually. Never return the private JWK in an API response. Allow worker HTTPS egress to the supported Apple, Google, Mozilla and Microsoft browser push services. Endpoint allowlisting and redirect rejection are required. Push status/attempt/error metadata is in `push_outbox`; do not print endpoints or payloads in logs. Completed payloads are erased and metadata expires after 30 days; 404/410 removes the subscription. After restoring a database, clear `push_outbox` and `push_subscriptions` alongside sessions/tokens/unsent mail so restored device endpoints cannot resume notifications unexpectedly. Retain `push_config` to preserve the server identity.
