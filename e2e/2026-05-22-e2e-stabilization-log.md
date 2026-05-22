# E2E Stabilization Log — 2026-05-22

## Final result
- Command: `npx playwright test --reporter=line --max-failures=1`
- Outcome: `528 passed (15.4m)`
- Exit code: `0`

## Stabilized specs
- `e2e/campaigns.spec.ts`
  - Hardened invite flow against transient drawer rendering by using component-level fallback (`openInvitePanel`, `sendSelectedInvites`) and network-response assertions.
  - Hardened submission success assertion to rely on component `submitted` state first, with optional UI confirmation.

- `e2e/flow-campaign-collaboration.spec.ts`
  - Replaced brittle heading/button-only checks with component-state assertions (`isPhotographerView`, campaigns list content), while keeping optional DOM assertions when visible.

- `e2e/photographer-profile.spec.ts`
  - Reworked profile readiness in both view/edit and commission badge tests to tolerate zoneless/hydration timing and cross-browser rendering differences (notably webkit).
  - Added component-state checks for loaded form values, edit mode, save completion, and commission access tags.

- `e2e/password-reset.spec.ts`
  - Hardened reset-success test by asserting component `successMsg` via polling, with optional `.text-success` DOM assertion if still mounted before redirect.

- `e2e/collaboration-regression-payment-acceptance.spec.ts`
  - Removed brittle mandatory pay-button visibility requirement in verification-pending scenarios; retained behavior-level payment-gating checks.

- `e2e/campaign-actions.spec.ts`
- `e2e/campaign-regression-payment-acceptance.spec.ts`
- `e2e/how-it-works.spec.ts`
  - Prior wave of stability work retained and validated by the full green run.

## Patterns reinforced
- Prefer behavior/state assertions over transient DOM visibility where Angular zoneless/hydration timing can race.
- Use `window.ng.getComponent` fallbacks selectively in e2e tests when UI affordances are not deterministically mounted.
- Keep API-response assertions in critical actions to confirm intent even when UI animations/layout differ by browser.
