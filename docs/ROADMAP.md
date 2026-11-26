# Roadmap

## Implemented in the first release
- [x] Public registration, verified email, password reset and secure cookie sessions.
- [x] Resend outbox, separate mail worker, retries and idempotency.
- [x] Household creation and switching, invitations, role checks and guarded departures.
- [x] Household isolation for records, participants, exports and receipts.
- [x] Responsive navigation, empty/error states, dark mode and installable PWA shell.
- [x] One-off and recurring chores, rotations, swaps and completion history.
- [x] Purchases and monthly bills; selected participants; exact equal, percentage and fixed splits.
- [x] Partial repayments with separate sent, confirmed and rejected states.
- [x] Private receipts, household export and audit history.
- [x] Shared shopping list with editing and checked-item clearing.
- [x] Dashboard derived from real records; opt-in daily due reminders.
- [x] Domain and HTTP integration tests; CI; Docker templates and backup helper.

## Release follow-up
- [ ] Residents review workflows on their own phones using user-initiated accounts.
- [ ] Confirm delivery of a user-initiated verification email in the recipient's inbox.
- [ ] Review whether the English interface and role capabilities suit the residents.
- [ ] Add account and household deletion with agreed handling of shared history.
- [ ] Extend monitoring and abuse controls before public promotion at scale.
- [ ] Verify that VM backups cover Home's volume and test off-server recovery.

## Later, only if useful
Push notifications, offline editing with conflict resolution, furniture ownership, calendar, buffer ledger, maintenance and move-out. Prioritize these from resident feedback.
