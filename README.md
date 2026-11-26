<p align="center"><img src="docs/design/logo.svg" width="180" alt="Home."></p>

# Home.

A household application for shared chores, expenses and shopping. Anyone can register, verify their email and create a private household or accept an invitation.

**Status:** First working self-hosted release. Accounts, household permissions and the core workflows are implemented. Test with your residents before relying on the ledger for real obligations.

## What you can do

| Area | Working behavior |
| --- | --- |
| Accounts | Public registration, email verification, sign-in, password reset, sign-out and reminder preferences |
| Households | Create and switch households; email invitations; owner, administrator and member roles; revocation; ownership transfer and guarded departure |
| Chores | One-off or recurring chores, rotating assignments, completion history and accepted swaps |
| Payments | Purchases and monthly bills; equal, percentage or fixed splits; private receipts; partial repayments and receipt confirmation |
| Shopping | Shared editable list, quantities, checked items and clear-checked action |
| Home | Assigned chores, amounts owed, payments to confirm and shopping items |
| Email | Resend verification, password resets, invitations and opt-in daily due reminders through a separate worker |
| Data | Household export, activity history and SQLite backups including receipts |
| Installation | Mobile and desktop layout, dark mode, PWA manifest and static offline shell |

Payments record money sent outside the app. Home does not connect to banks or move money. Sent and receipt confirmed are distinct states. Every share uses integer øre; rounding preserves the exact total.

## Using Home

Create an account and verify your email, then sign in. Create a household under your chosen name, or open an invitation sent to the email you registered with. Invite other residents in Settings. Each household has its own chores, shopping list and ledger.

Use **Add expense** for furniture, groceries and other shared purchases. Choose **Bill to be paid** for rent or utilities collected by a household member; the optional monthly setting creates future bills. Select participants and check the split preview before saving. After sending money using your bank or payment app, mark the amount as sent; the recipient confirms it.

Install on iPhone through Safari → Share → Add to Home Screen, or use the browser's install option on Android and desktop. Data changes need connectivity. Private records are never stored in the service-worker cache.

## Development

Requires Node.js 24+. There are no runtime npm dependencies or frontend build step.

```sh
git clone https://github.com/08Robfin/home.git
cd home
node backend/server.mjs
```

Open `http://localhost:3000`. Development data is stored in ignored `data/home.sqlite`. Starting the web app alone does not send emails. All test email calls are mocked:

```sh
node --test tests/*.test.mjs
```

The integration suite exercises real HTTP routes against an isolated database, including token reuse, household isolation, invitation ownership, chore rotation and swaps, repayment confirmation, private receipts, recurring bills, reminders, shopping, CSRF rejection and mail retries.

## Deployment and privacy

Use the Docker Compose template behind Nginx Proxy Manager. Keep the real `.env` and Resend sending credential on the server, outside source control. Only the mail worker receives the credential; the web container and browser do not. TLS, cookie security, input validation, backend authorization and persistent rate limits are part of the implementation.

See [operations](docs/OPERATIONS.md) for configuration, backups, restoration, updates and current boundaries. Run `python3 scripts/backup.py /absolute/private/backup-directory` on the Docker host for a verified online snapshot with 30-day retention. Keep off-server backups for disaster recovery.

## Repository guide

| Path | Contents |
| --- | --- |
| [frontend/](frontend/) | Browser interface, icons, PWA and stylesheet |
| [backend/](backend/) | HTTP API, SQLite schema, domain rules and email worker |
| [tests/](tests/) | Isolated domain and HTTP integration tests |
| [scripts/](scripts/) | Server backup helper |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Shared product requirements |
| [docs/DESIGN.md](docs/DESIGN.md) | Interface conventions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Implemented architecture and boundaries |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deployment and recovery |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Completed work and remaining scope |
| [AGENTS.md](AGENTS.md) | Coding-agent instructions |

The SVG screens under `docs/design` remain concepts with illustrative data. Account and household deletion, push notifications, offline editing, furniture ownership, calendar and maintenance tracking are not implemented. See the roadmap before expanding scope. No public license has been selected.
