# Design and UX

## Direction (proposed)
A calm, compact utility. Use the system font stack, neutral surfaces and one restrained accent (proposed forest green). Start with 4/8px spacing increments, 8px control radii, 16px body text and 24–28px page headings. Prefer a flat list with separators over a card for each item. Keep content width readable on desktop; use mobile bottom navigation for Home, Chores, Payments and Shopping. Settings and household switching belong in the header. Use generous 20–24px page gutters, consistent 44px minimum actionable rows, real line icons rather than navigation dots, and aligned monetary values. Avoid artificial phone status bars in conceptual screens.

## Key screens
Home: household switcher, upcoming chores and payments. Payments: clear personal balance, owed-to-you and expense history, with a single add-expense action. Add expense: amount, title, payer, selected participants, split method and exact per-person preview. Registration: email/password, verification state and create-or-join household choice. Do not expose unrelated household data in navigation or search.

## Copy
Use task labels and exact status: “Rent”, “Due 1 February”, “Mark as sent”, “Confirm receipt”. A heading needs no preheading or slogan. Do not write “Welcome to your smarter home”, “Stay on top of your journey”, “Everything you need, all in one place” or decorative three-word taglines. Helpful error and empty-state instructions are allowed: “No chores due today” or “Couldn't save. Try again.” Avoid repeating what the heading or button already says.

## Visual constraints
No default gradients, glassmorphism, glows, oversized rounded rectangles, excessive shadows, nested cards, generic feature grids, gratuitous charts, decorative badges or emoji icons. A badge is appropriate for meaningful status such as overdue. Use a consistent line icon set, accessible names for icon-only controls, and visible text for important actions. Do not use fabricated avatars or stock illustrations to fill empty space.

## Interaction and accessibility
Aim for WCAG 2.2 AA: sufficient contrast, visible keyboard focus, semantic controls, accessible names, logical tab order, non-color status cues, reduced motion and accessible error messages. Aim for 44px touch targets. Test 320px mobile width, larger mobile screens and desktop; support zoom and dark mode. Provide clear loading, empty, offline and failure states. Confirm destructive actions or provide undo. Keep form values after errors.

## Review checklist
- Does every visible element help complete a real task?
- Can a resident identify the next action without explanatory copy?
- Does the screen work with long names, large amounts, no records and errors?
- Are styles consistent with other screens, rather than a generic template?
- Are actual interactions accessible and functional?

## References
- [Nielsen Norman Group: usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): minimize irrelevant content, show system status and prevent errors.
- [GOV.UK: writing for interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces): plain, concise, actionable language.
- [Apple: design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles): familiar interactions, clarity and feedback.
- [UK i.AI design heuristics](https://design-kit.ai.gov.uk/principles/design-heuristics): restrained visual treatment.
- [Signs of AI design](https://github.com/febbhav/signs-of-ai-design): informal pattern catalog, not evidence of authorship.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessibility standard.

The wireframes are illustrative proposals, not production screens.
