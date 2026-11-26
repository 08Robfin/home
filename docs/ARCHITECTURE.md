# Architecture proposal

No implementation or infrastructure exists yet.

## Candidate stack
React + TypeScript + Vite frontend; CSS or Tailwind after agreement; PocketBase with SQLite as a small self-hosted backend. Compare Supabase if managed hosting is preferable. Review backend maturity, backup/restore and upgrade requirements before committing. Serve frontend and API over HTTPS, preferably same origin, on existing Proxmox infrastructure. GitHub Actions may build and deploy after approval. GitHub Pages alone cannot run the backend.

## Logical model
Users; households; memberships; chore templates; chore occurrences; completion/swap events; bills; bill shares; payment confirmations; shopping items; reminder preferences; push subscriptions; audit events. Each household record is scoped by household ID. Store money in integer øre and UTC timestamps, with local dates for schedules. Define uniqueness for recurring occurrences and notifications to prevent duplicates. All privileged actions checked server-side.

## PWA
Manifest, icons, standalone display and service worker. Add iOS home-screen installation instructions. Push requires user permission and supported installed context. Schedule reminders server-side. Cache static assets only initially; do not cache private API responses indiscriminately. Offline mutations are deferred until conflict resolution is designed.

## Operations
Use separate development data and production secrets. No real data in tests. Restrict registration, validate membership for every read/write, rate-limit authentication, review dependencies, use HTTPS, and back up the database and uploaded assets. Test restoration before production use. Plan for server outages and a simple export before moving out. Do not expose administrative endpoints unnecessarily.

See [architecture diagram](design/architecture.svg). All choices remain open until reviewed.
