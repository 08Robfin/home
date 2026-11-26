# Product requirements

Home. is a multi-household utility with private data per household. It should replace scattered messages, payment reminders and chore lists, without making residents feel monitored.

## MVP
| Area | Behavior | Acceptance criteria |
| --- | --- | --- |
| Accounts | Anyone can register with email, verify it, create a household or accept an invitation | Unverified users cannot access household data; nonmembers cannot read or change it |
| Dashboard | My due chores, outstanding payments, next deadlines | Derived from real records; no decorative metrics |
| Chores | One-off and recurring assignments, rotation, completion, swaps | Weekly rotation is predictable; completion history retained; swaps require acceptance |
| Payments | Recurring rent and bills, one-off shared purchases, equal/percentage/fixed splits, reimbursements | Shares sum exactly to total; sent and confirmed are distinct; overdue calculated from date |
| Shopping | Shared list, quantity optional, checked state | Members see updates; duplicates can be edited; checked items can be cleared |
| Reminders | Opt-in reminders for upcoming chores and bills | No duplicate delivery; per-user preferences; clear fallback in app |

## Later, only if useful
Calendar, buffer ledger, maintenance requests, furniture ownership, move-out checklist and document references. Do not store signed contracts or financial credentials in GitHub. Home Assistant integration is optional.

## Registration and households
- Register with email and password; verify email via Resend before creating or joining a household. Support sign-in, password reset and resend verification.
- Any verified account can create a named household, becoming its owner, or accept an invitation sent to its email. Support multiple memberships and a household switcher; no global household directory.
- Owners can invite, revoke pending invitations, manage members and transfer ownership. Members can leave; define treatment of outstanding obligations before departure. Invitations expire, are single-use and match the verified recipient email.
- Proposed roles: owner, admin and member. Exact role capabilities require review. Never expose one household's data to another.

## Shared purchases and expenses
- Record item, category, amount, currency, date, who paid, included members, optional receipt and note. Examples: sofa, dining table, groceries, electricity.
- Split equally among selected members, by percentage (must total 100%), or by fixed amounts (must total the expense). The payer may or may not be included.
- Preview each person's amount before saving. A 3,000 kr sofa split 50/30/20 creates shares of 1,500/900/600 kr. If the first member paid the entire bill, the others owe that member 900 and 600 kr.
- Display what I owe, what others owe me, expense history and settlement status. Allow partial repayments and confirmation; do not count pending or already confirmed settlements twice.
- Use deterministic integer rounding so all shares sum to the exact total, including uneven equal splits. Preserve original expense and audit edits; prevent edits that invalidate settled amounts without explicit reversal or correction.
- Recurring rent and bills remain distinct from purchases already paid by a member. Ownership of furniture is separate from its cost split; optional ownership tracking can come later.

## Payment rules
No bank connection or money movement in MVP. A payer marks sent; the designated recipient confirms receipt. Record corrections with actor and timestamp. Use integer øre, NOK, and Europe/Oslo for recurring local deadlines. Do not infer equal rent shares. A ledger is not a bank balance.

## Success
All residents can see what they owe and what they need to do without asking in chat. Common actions should take a few taps. Review usefulness after move-in and remove features nobody uses.
