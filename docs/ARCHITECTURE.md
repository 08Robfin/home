# Architecture

The first working release uses Node.js 24, its built-in SQLite driver and a buildless browser application. The earlier React/PocketBase stack was a proposal; implementation uses the standard runtime to keep this small self-hosted service deployable without third-party runtime packages.

## Request and email paths

Browser → HTTPS at Nginx Proxy Manager → Home HTTP application → SQLite.

Account or household action → transactional mail outbox → separate mail worker → Resend HTTPS API.

The app and worker share a dedicated persistent SQLite volume, with WAL, foreign keys and busy timeouts enabled. The app is reachable through the proxy network; the mail worker uses its own egress network. Both run as UID 1000 with read-only application files, dropped capabilities and memory limits. No service publishes a host port. Only the mail worker mounts the restricted Resend secret file.

## Identity and tenancy

Passwords use scrypt with independent random salts. Session cookies contain random opaque tokens; only their SHA-256 hashes are stored in the database. Cookies are HttpOnly, SameSite=Lax and Secure for HTTPS deployments. Password resets revoke all existing sessions. Verification, reset and invitation tokens are random, hashed, expiring and single use. URL fragments keep email link tokens out of proxy request URLs.

Mutation requests require the configured Origin, a custom request header and JSON content. Rate limits persist in SQLite. Household access is checked server-side before each read, mutation, export or receipt download. Participant references and chore assignees must belong to the same household. Verification is required before creating or joining a household. Invitations match the verified account's email.

Owners manage roles, transfer ownership and remove members. Administrators manage invitations, household naming, assignments and recurring bills. Shared expense creation and shopping are available to members. Only an expense author or administrator can void a record or replace its receipt; only its recipient can confirm or reject repayments.

## Financial records and schedules

Expenses, allocated shares and repayments are separate records. Amounts are integer øre in NOK. Equal and percentage allocation use deterministic largest-remainder rounding with stable user-ID tie breaks. Fixed shares must sum to the expense. Pending repayments reserve the unconfirmed amount, preventing overpayment; only confirmed receipts reduce the outstanding balance. Confirmation runs in a transaction and cannot be applied twice.

Expense amounts and participants are immutable. Unsettled mistakes may be voided and recreated; records with sent or confirmed repayments cannot be voided. Audit events retain actor, action and record. Receipts are validated PNG, JPEG or PDF uploads, at most 5 MB, stored inside SQLite and served only to household members.

Monthly bill templates retain an anchor day, including return to the 31st after a shorter month. A unique template/date index prevents duplicate occurrences. Chore completion creates the next dated occurrence and rotates assignment, with a unique parent/date index. Oslo local days define reminders; UTC timestamps define authentication expiry and audit times. A swap changes the current assignment only after the proposed recipient accepts it.

## Email reliability

Email intent is queued in the same database transaction as the originating event. Resend calls have fixed per-message idempotency keys, timeouts and bounded exponential retries. The worker retries transient failures and generic status codes without logging provider bodies or credentials. Pending payloads expire within 23 hours; sent/failed bodies are cleared. Metadata is removed after 30 days. Users opt in to one due-today digest per day. Provider acceptance is not proof of inbox delivery. No inbound email is processed.

## Browser and operations

The service worker caches only the static shell. Authenticated API data and receipts use no-store responses. Offline editing is deferred. Shared records refresh every 20 seconds when visible and idle; background refresh does not replace an open form or expanded expense.

The backup helper uses SQLite's online backup API and verifies integrity. Receipts are part of the snapshot; server credentials are separate and excluded. See [operations](OPERATIONS.md) for restore procedures, limits and the operator-managed deletion process. Automated tests use synthetic data and a mocked provider; they never send live email or query production household records.
