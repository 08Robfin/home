# Architecture proposal

No implementation or infrastructure exists yet.

## Candidate stack
React + TypeScript + Vite frontend; CSS or Tailwind after agreement; PocketBase with SQLite as a small self-hosted backend. Compare Supabase if managed hosting is preferable. Review backend maturity, backup/restore and upgrade requirements before committing. Serve frontend and API over HTTPS, preferably same origin, on existing Proxmox infrastructure. GitHub Actions may build and deploy after approval. GitHub Pages alone cannot run the backend.

## Logical model
Users; email verification and reset tokens; households; memberships; invitations; chore templates; chore occurrences; completion/swap events; bills; expenses; expense shares; settlements and allocations; shopping items; reminder preferences; push subscriptions; audit events. Each household record is scoped by household ID. Store money in integer øre and UTC timestamps, with local dates for schedules. Define uniqueness for recurring occurrences and notifications to prevent duplicates. All privileged actions checked server-side.

## Identity, tenancy and email
Use the existing Resend account for transactional verification, password-reset and household invitation emails. Proposed integration: backend-only Resend API or authenticated SMTP using a verified sending domain. No API key or credentials in clients, source control or logs. Use separate development credentials and sandbox/test recipients. Set sender identity, SPF/DKIM and appropriate DMARC policy before launch. Do not send email or configure the live account during planning.

Use short-lived, random, single-use tokens stored securely (hashed when custom tokens are used); bind invitations to household and recipient email; invalidate used/revoked tokens. Rate-limit sign-up, verification resend, resets and invitations; use neutral reset responses to avoid account enumeration. Treat delivery acceptance as distinct from verification. Handle failures, retries and duplicate events without sending repeated messages. No inbound email processing is planned.

Every household query and mutation must check authenticated membership and role on the server, including files, subscriptions, exports and reminders. Derive tenant scope from authorized membership, not client claims. Add cross-tenant denial tests. Creating households and accepting invitations must be atomic; enforce unique membership per user/household. Define account deletion, household deletion, ownership transfer and retention before public release.

## Expense calculations
Store integer minor units and currency; initially NOK only is proposed. Store split method, participants and original allocation. Percentage inputs use fixed precision; allocate remainder deterministically by largest remainder with stable tie-break. Validate sum and nonnegative shares server-side. A settlement records payer, recipient, amount, status and allocation to obligations; transactional confirmation prevents double settlement. Preserve audit history and prevent cross-household references. Avoid automatic netting across currencies or households.

## PWA
Manifest, icons, standalone display and service worker. Add iOS home-screen installation instructions. Push requires user permission and supported installed context. Schedule reminders server-side. Cache static assets only initially; do not cache private API responses indiscriminately. Offline mutations are deferred until conflict resolution is designed.

## Operations
Use separate development data and production secrets. No real data in tests. Allow public verified registration with abuse controls, validate membership for every read/write, rate-limit authentication, review dependencies, use HTTPS, and back up the database and uploaded assets. Test restoration before production use. Plan for server outages and a simple export before moving out. Do not expose administrative endpoints unnecessarily.

See [architecture diagram](design/architecture.svg). All choices remain open until reviewed.
