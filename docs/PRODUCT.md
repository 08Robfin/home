# Product requirements

Home. is a private shared household utility for three residents. It should replace scattered messages, payment reminders and chore lists, without making residents feel monitored.

## MVP
| Area | Behavior | Acceptance criteria |
| --- | --- | --- |
| Accounts | Invite-only membership; individual logins | Nonmembers cannot read or change household data |
| Dashboard | My due chores, outstanding payments, next deadlines | Derived from real records; no decorative metrics |
| Chores | One-off and recurring assignments, rotation, completion, swaps | Weekly rotation is predictable; completion history retained; swaps require acceptance |
| Payments | Recurring rent and shared bills, custom shares, due dates | Shares sum exactly to total; sent and confirmed are distinct; overdue calculated from date |
| Shopping | Shared list, quantity optional, checked state | Members see updates; duplicates can be edited; checked items can be cleared |
| Reminders | Opt-in reminders for upcoming chores and bills | No duplicate delivery; per-user preferences; clear fallback in app |

## Later, only if useful
Calendar, shared expense settlement, buffer ledger, maintenance requests, furniture ownership, move-out checklist and document references. Do not store signed contracts or financial credentials in GitHub. Home Assistant integration is optional.

## Payment rules
No bank connection or money movement in MVP. A payer marks sent; the designated recipient confirms receipt. Record corrections with actor and timestamp. Use integer øre, NOK, and Europe/Oslo for recurring local deadlines. Do not infer equal rent shares. A ledger is not a bank balance.

## Success
All residents can see what they owe and what they need to do without asking in chat. Common actions should take a few taps. Review usefulness after move-in and remove features nobody uses.
