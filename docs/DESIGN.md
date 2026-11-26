# Design and UX

## Direction
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

The wireframes are retained as historical proposals. The current README uses captures of the running application with an isolated demo household.

## Mobile revision — 26 November 2026

The user requested clearer separation, less text, aligned controls, navigation consistent with Penge and Film, explicit light/dark choices and movement only in the navigation menu.

- Use 16–20px page gutters and a shared content edge. Group related rows into one surface with dividers; separate sections with 22–24px of space. Do not put one card inside another for decoration.
- Chores have a leading completion control, a title, one short assignee/date line and a trailing actions menu. Recurrence, swaps and reassignment stay in the actions menu.
- Expense rows align the icon, title, context and amount. Distinguish money owed to the user from their own outstanding share; expose allocation and repayment history on expansion.
- The expense form displays an amount beside each selected participant. Equal, percent and fixed are segmented options. Date, category, recurrence and note use progressive disclosure under Details.
- Four persistent mobile tabs remain visible. A separate More control contains account/settings actions and appearance. Its floating pill and separate round control follow the existing Penge/Film pattern requested by the user.
- The Penge navigation motion is limited to a 240ms tab selection slide, a 280ms More panel with a 200ms fade, and the More symbol transition. Other app controls and content do not animate. Respect reduced-motion preferences.
- Appearance has Light, Dark and System choices, saved on the device. Use separate surface, text, border, field and accent tokens for both palettes. Native controls receive the matching color scheme.
- Controls aim for at least 44×44 CSS pixels. The narrow-screen check uses 320px, and both document and dialog must reflow without horizontal scrolling. Account for safe-area insets at the header, dock and dialogs.

These choices apply Apple's guidance on alignment, grouping, progressive disclosure, persistent labelled tabs and adaptive dark palettes to a web application. They do not imply that this web UI is a native UIKit component or that a complete accessibility certification has been performed.

### Primary references reviewed

- [Apple: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — hierarchy, alignment, grouping, progressive disclosure, resizing and safe areas.
- [Apple: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) — stable top-level navigation, labels and adapting a tab bar to a sidebar.
- [Apple: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) — adaptive colors and readable contrast in both appearances.
- [WCAG 2.2: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) — 320 CSS pixel reflow without loss of content or function.
- [WCAG 2.2: Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — 24px minimum criteria; Home uses the larger 44px touch-target aim.
- [MDN: CSS environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Environment_variables/Using) — safe-area inset handling in a browser/PWA.
