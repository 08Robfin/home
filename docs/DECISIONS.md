# Decisions

| Topic | Status | Direction |
| --- | --- | --- |
| Repository | Agreed | Private GitHub repository |
| Current scope | Authorized 2026-11-26 | Implement the planned application and deploy on the user's server |
| Interface | Agreed | Utility-first, no filler copy or default AI decoration |
| Platform | Proposed | Installable PWA |
| Stack | Implemented 2026-11-26 | Node.js 24, built-in SQLite, buildless browser JavaScript; no runtime npm dependencies |
| Hosting | Implemented 2026-11-26 | Separate Docker Compose project behind existing Nginx Proxy Manager and HTTPS |
| Brand | Proposed | Home. with simple house mark and neutral palette |
| Language | Open | English or Norwegian interface |
| Registration | Required | Public email registration, verification through Resend |
| Households | Required | Any verified user can create a household and invite others; private tenant data |
| Expenses | Required | Shared purchases and equal, percentage or fixed splits |
| Permissions | Open | Confirm owner/admin/member capabilities and departure rules |
| Reminders | Open | Cadence, opt-in preferences and fallback |
| Payment shares | Open | Confirm actual amounts, deadlines and recipients |

Record new decisions with date, participants, context, alternatives and rationale. Do not silently change agreed decisions.

## 2026-11-26: implementation and deployment

The user explicitly requested implementation, Resend integration and deployment using their existing server and Nginx Proxy Manager. The implementation retains the logo, restrained green interface, public verified registration and household isolation. English is the initial interface language, following the existing plans; residents can review that choice.

The earlier framework/backend proposals were replaced with Node's standard library and SQLite to keep deployment small and avoid runtime dependency installation. A separate mail worker receives a domain-restricted Resend sending credential. Production configuration and credentials stay on the server; the repository contains templates only. Owner/admin/member permissions and departure safeguards are documented in OPERATIONS.md. Financial amounts, households and people are never hardcoded in production.
