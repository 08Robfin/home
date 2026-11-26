# Home. — maintainer and AI handoff

Read this with `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md` and `OPERATIONS.md` before changing code. This is a working application with real residents, not an unimplemented design exercise. Never use production household records as fixtures or screenshots.

## Repository and integration state

The public landing README lives on `main`. The implementation is on `feat/household-app`. PR #1 was closed without merging at the maintainer’s request on 26 November 2026; the deployed app and source branch remain intact. Main has historically contained planning and presentation files rather than the application. Verify branch state before starting; do not reopen the PR or integrate the implementation automatically.

Until the implementation is integrated into main, branch application follow-ups from `feat/household-app` and target that branch. Open a new PR only when the requested work calls for one. Once main contains the implementation, branch from updated main and target main. Do not recreate the app from the concepts on main. Keep shared documentation identical across the two branches while this transitional arrangement exists; resolve documentation conflicts by preserving the current implemented behavior, not an older proposal.

## What has been built

- Public email signup, verification, sign-in, reset and recipient-bound invitations. Resend is called by a separate worker through a transactional SQLite outbox. The HTTP app never has the Resend key.
- Private households, custom household switcher, owner/admin/member permissions, invitations and role/ownership management. Departures are blocked by unresolved obligations and assignments.
- One-off and repeating chores, rotation, completion, assignments and consent-based swaps. The next repeating occurrence is created on completion; unfinished work is not silently skipped.
- Expenses and monthly bill templates; exact equal, percentage and fixed splits; immutable ledger records, private receipts, partial repayments and recipient confirmation. Home does not move money.
- Shared shopping list; account preferences, household exports and activity history.
- Mobile-first interface, desktop sidebar, light/dark/system appearance, installable shell and opt-in reminders by email and Web Push.
- Dedicated Docker Compose project, HTTPS via an existing Nginx Proxy Manager network, restricted containers, online SQLite backups and documented recovery. Operator addresses, SSH credentials and private configuration belong outside this repository.

## Code map

| Path | Responsibility |
| --- | --- |
| `backend/server.mjs` | HTTP/static serving, authentication, authorization, CSRF/origin checks, validation and household APIs |
| `backend/db.mjs` | SQLite schema and additive, restart-safe migrations |
| `backend/domain.mjs` | Exact money allocation, password hashing, dates, token and mail helpers |
| `backend/worker.mjs` | Monthly occurrences, scheduled work, Resend delivery and push delivery loop |
| `backend/reminders.mjs` | Date-based reminders, local time zone/DST, categories, lead time, overdue opt-in |
| `backend/push.mjs` | Subscription validation, RFC 8291 encryption, RFC 8292 VAPID and durable delivery |
| `frontend/app.js` | Buildless UI, forms, dialogs, navigation, appearance, notification consent and update prompt |
| `frontend/styles.css` | Shared design tokens, responsive layout and navigation-only motion |
| `frontend/sw.js` | Public shell cache, visible push handling and notification clicks |
| `tests/` | Synthetic HTTP/domain/mail/push tests; no live provider delivery |
| `scripts/backup.py` | Online snapshot and integrity/retention check on the Docker host |
| `docs/screenshots/` | Real demo captures and reproducible styled presentation pages |

There are no runtime npm dependencies or build step. Use Node 24+. Do not casually introduce a second framework, datastore or email provider. Existing deployment expects the same image for the app and worker.

## Design decisions learned through iteration

The user wants a useful phone app with clear hierarchy, little copy and generous but purposeful spacing. The original concepts are design references, not proof of implemented functionality. Replace them in current presentation with real captures from an isolated demo household.

- Use grouped list surfaces, dividers and a consistent left edge. Keep titles, amounts and actions on stable columns. Avoid nested cards, decorative gradients, motivational copy and long metadata strings.
- Keep secondary chore/shopping actions behind a three-dot button. Completion remains directly accessible. Expense details expand when needed; the split preview shows each participant's amount before saving.
- The mobile dock has four stable tabs and a separate More circle. Match the restrained navigation motion used by the user's Penge app: selector 240 ms, menu 280 ms and fade 200 ms; respect reduced motion. Do not add animations elsewhere.
- Keep the dock and page width stable when switching between short and long pages. Explicit SVG circles are used for More dots and shopping-cart wheels; tiny path segments disappeared at small sizes.
- The household picker is a proper dialog/list with initials and a clear active check, rather than an awkward native select. Preserve keyboard focus and dismissal behavior.
- Settings uses a narrower content width. Invitation fields use a dedicated grid, not the shared `.actions` flex row: combining those classes pushed the form to the far right. Desktop input/button bottoms align at 48 px height; phone layout stacks them on the same left edge.
- Show primary notification controls first; less common time-zone/overdue options are under More options. Do not turn settings into a wall of explanation.
- GitHub presentation uses large phone views, balanced framing and no tiny captions below each window. It should feel related to Penge without copying its presentation. Do not reintroduce the removed payment instruction text.

## Notification behavior and boundaries

Email is opt-in per account; push is opt-in per browser installation/device. Chores and payments each have their own enabled state, 0–14 day lead and local time. Time zone and overdue opt-in are shared. Defaults retain email opt-in and use the due date at 09:00 Europe/Oslo. Due dates have no time-of-day component, so this is a daily summary, not an hourly deadline alarm.

Scheduling checks every worker tick and catches up after the chosen time that local day. A category-specific event key suppresses repeated scheduling on restarts and DST clock changes. Future monthly templates can be included without creating an expense early. Completed chores, voided expenses, settled/reserved balances and households the user has left are excluded. Newly added records after a digest may only appear in the app until another eligible reminder. Saving preferences cancels pending reminder payloads; an already dispatched message cannot be recalled.

Push subscriptions are account-scoped, capped at ten devices and accepted only for supported HTTPS browser push services. Never allow arbitrary push URLs or redirects: that would create a server-side request forgery path. Endpoints and authentication secrets are private. VAPID signing material is generated server-side and retained in SQLite; only its public verification key is returned to an authenticated browser. Do not rotate this material casually because existing subscriptions depend on it.

The worker encrypts payloads, retries transient failures with bounded backoff, erases completed payloads and removes expired subscriptions on 404/410. Push uses a stable Topic and notification tag to reduce duplicate presentations. Network ambiguity still means exactly-once delivery is not guaranteed. Generic lock-screen text protects household titles and balances. Test notifications are rate limited. Signing out disconnects the current device; password reset revokes stored subscriptions. Delivery acceptance is not proof the OS displayed a notification.

On iOS/iPadOS 16.4+, push requires a Home Screen web app and permission requested directly from a user's tap. Detect capability and installed mode, explain unsupported/blocked states and never prompt on page load. On newer iOS, keep Open as Web App enabled when installing. Permission, Focus modes, device connectivity and OS policies remain outside the app's control. A real iPhone installed-app smoke test remains necessary; desktop viewport testing cannot establish iOS delivery.

## Security and operations invariants

- Do not read, print, commit or screenshot secrets, real household data, email bodies, link tokens, production environment files or database backups. Public example/test addresses must be synthetic.
- Scope every record and participant to authorized current membership on the server. UI visibility is not authorization. Preserve cookie, origin/CSRF, rate-limit, receipt and invite protections.
- Preserve integer øre and exact split totals. Sent is not confirmed; never turn a ledger action into simulated payment processing.
- API data and receipts are no-store and are never cached by the service worker. Offline editing is not implemented. Show a useful connection error and never claim an offline save succeeded.
- Cache updates require an explicit reload when an old app is open, rather than replacing a form mid-edit. Check for updates when returning to the foreground.
- Back up before deployment/migration. Never use `docker compose down -v`. Additive migrations must work on existing volumes and repeated startup. The backup contains private VAPID material as well as financial/account data; keep it restricted.
- Only the mail worker mounts the Resend credential. Keep the existing proxy host/network and server-only configuration. Deployment to a different host or any access expansion needs maintainer authorization.
- A prior approved synthetic Gmail smoke test confirmed verification, revised invitation, reset and reminder inbox delivery with SPF/DKIM/DMARC passing. It does not authorize future live tests. Do not run live provider calls from automated tests.

## A PR that is easy to integrate

1. Verify the current branch/base and inspect the code and relevant decisions. Write the concrete problem and expected behavior before editing. Keep one coherent change per PR.
2. Reuse existing tokens, components and standard runtime. For schema changes, include an additive migration and compatibility/rollback explanation. Coordinate architecture/dependency changes first.
3. Add meaningful tests for authorization, money, scheduling and delivery changes. Use isolated databases and mock provider calls. For simple visual fixes, use browser evidence rather than tests that repeat the CSS implementation.
4. Run `node --test tests/*.test.mjs`, `node --check` on changed JavaScript modules and `git diff --check`. State exact results and any untested conditions. Never label an unrun test as passed.
5. For UI changes inspect narrow phone (320 px), normal phone, desktop, both themes, keyboard/focus, long content, empty/error/offline states and dock stability. Check Safari-specific behavior on a real device where available. Do not claim Chromium is Safari.
6. Update README, affected product/architecture/operations notes, this handoff if conventions changed, and actual demo screenshots if the presentation is affected. Keep the main README current without claiming planned work is shipped.
7. Review the diff for secrets and personal data before uploading. Attach screenshots from demo fixtures only. Keep local logs, databases, deployment credentials and generated archives out of the commit.
8. Use the PR template. Lead with the problem and resulting behavior; include validation, migration/rollback and material limits. Link relevant docs. Describe the final implementation, not the chat history or abandoned attempts.
9. Keep CI green and the branch conflict-free against its intended base. Rebase/merge only when safe; resolve changes deliberately. Leave the PR reviewable; do not merge without maintainer approval.
10. When deployment is explicitly authorized, snapshot the database, build the reviewed source, restart only Home, verify app/worker health and static version, and record the deployed commit. Do not touch unrelated services. Keep the previous image and backup available.

## Primary references

- [Apple: Web Push for Home Screen apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple: sending Web Push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [WebKit: Safari 26 Home Screen behavior](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [WebKit: safe-area layout](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [RFC 8291: encrypted push payloads and published test vector](https://www.rfc-editor.org/rfc/rfc8291)
- [RFC 8292: VAPID](https://www.rfc-editor.org/rfc/rfc8292)
- [web.dev: service-worker lifecycle](https://web.dev/learn/pwa/service-workers)

## Remaining work, honestly

Real iPhone Home Screen installation and APNs delivery need device verification. Account/household deletion and retention UI, offline conflict resolution, richer event notifications, furniture ownership and off-server disaster-recovery verification are separate work. Resend webhook-based bounce/complaint monitoring is not implemented. No test or design guideline makes browser/OS delivery unconditional.

## 2026-11-26: fixed-scale navigation follow-up

The owner requested no horizontal page/menu scrolling and no in-app touch zoom. Root and nested scroll surfaces allow vertical panning only; dialogs and form grids must reflow rather than hide overflowing controls. Keep date fields constrained, controls at 16 px minimum text, long names/amounts wrapping, and dialog scroll position reset when changing menus. A visualViewport listener sizes dialogs around the software keyboard. The header has 12 px extra top clearance to avoid the iOS top blur. OS accessibility overrides cannot be disabled reliably. Notification testing is deliberately visible before enabling push and uses the actual server outbox after a permission gesture. These explicit preferences supersede the earlier Safari checklist’s zoom-preservation guidance.

## 2026-11-26: independent schedules and faster push

Chores and payments now have separate lead-day and local-clock-time settings. The additive migration copies each user’s old shared schedule into both categories exactly once, so it does not silently change existing choices. Legacy profile fields remain for older open clients; explicit new fields take precedence. Scheduling and notification tags are category-specific, preventing an earlier chore summary from suppressing a later payment summary. Existing combined-digest event keys suppress duplicate delivery on the upgrade day.

The worker now runs independent scheduling, email and push loops. Push checks once per second with three bounded concurrent sends; a stalled email request cannot block it. Mail checks idle queues every second and retains 600 ms pacing when active. Scheduling still checks every 15 seconds. Health requires recent progress from all three loops. Push requests use high urgency to request immediate delivery, and VAPID authorization is reused for one hour as Apple recommends. Neither setting bypasses Focus, connectivity or OS delivery policies. A synthetic timing check reached the mocked provider 948 ms after queueing while email remained deliberately pending; this is not an APNs timing measurement.

Tests cover independent lead/time settings, migration and repeated startup, old-client compatibility, upgrade-day deduplication, distinct push tags and push progress while mail is pending. There are 32 isolated checks. See Apple’s [Web Push delivery guidance](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Review exported screenshot dimensions and full-frame content before publishing; do not accidentally save a transient or partial capture.
