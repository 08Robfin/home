# AI coding agent instructions

## Start here
Read README.md, docs/PRODUCT.md, docs/DESIGN.md, docs/ARCHITECTURE.md, docs/ROADMAP.md and docs/DECISIONS.md. The repository is in planning only. Do not scaffold or implement anything unless explicitly requested. Treat proposed decisions as proposals, not requirements.

## Working rules
- Implement only the requested issue. Inspect existing code before changing it; keep changes small and reviewable.
- Reuse components, tokens and established dependencies. Ask before changing architecture, adding dependencies or changing data contracts.
- No invented data, fake integrations, placeholder success messages or unrelated features. Test real behavior.
- Never commit credentials, private household records, payment details or production configuration. Enforce permissions server-side; never rely on hidden UI.
- Preserve accessibility, responsive behavior and existing functionality. Report actual tests and any failures; never claim unrun tests passed.

## Multi-household and financial invariants
Public signup is required, but household membership is private. Verify email through backend-only Resend integration; never expose API keys, send live email in tests or configure production services without approval. Scope every operation to authorized membership and test tenant isolation. Do not hardcode three people, names, household IDs, rent amounts or equal splits. Support selected participants, equal/percentage/fixed shares and exact integer-minor-unit allocation. Keep expenses, obligations and confirmed settlements distinct; do not simulate payment processing.

## UI contract
This is a household utility, not a landing page. Show the page title, useful information and the next action. No tagline below the app name, eyebrow labels, welcome essays, generic motivational copy, decorative badges, gradients, glow, glassmorphism, emoji icons or nested cards by default. Do not replace useful labels with clever language. Prefer lists, dividers, clear alignment and restrained typography. Use color to communicate meaning, never as the only signal. Follow docs/DESIGN.md for details.

## Before opening a PR
Check mobile and desktop, keyboard navigation, focus, contrast, loading/empty/error states and real data. Remove redundant text. Verify authorization and tests relevant to the change. Include summary, test evidence, screenshots for UI changes and any open decisions. Never merge or deploy without maintainer approval.
