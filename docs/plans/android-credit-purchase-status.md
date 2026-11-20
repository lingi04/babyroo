# Persistent credit purchase status

Status: Implemented after the user authorized implementation ("proceed with implementation"). Automated verification and faithful preview review completed. App changes are committed as `4844cf3`; the server follow-up is committed as `4ecbeff`. Deployment and native device verification remain pending.

## Agreed requirements

- The user selected persistent purchase-card status rather than alert-only feedback.
- Show **결제 대기 중** only for payment explicitly reported pending by Google Play.
- Show **구매 확인 지연** when an existing purchase cannot be verified or completed. A verification failure is not evidence that payment is pending.
- For an unresolved purchase, replace **구매** with **다시 확인**. This action reconciles the existing purchase; it cannot open another checkout in the same action.

## Existing behavior and scope

`CreditPurchaseCoordinator` already serializes purchases/restoration and distinguishes pending client states from verification failures, but reports messages through transient alerts only. `CreditStatusScreen` retains only a global busy flag, so the card returns to **구매** after the alert. The server currently uses `GOOGLE_PLAY_PURCHASE_NOT_PURCHASED` for all unknown/non-purchased states except canceled, so that generic error cannot reliably identify pending payment.

Extend the current recovery coordinator and existing screen. Keep the server diagnostic correction scoped to the server directory; no deployment, credentials, pricing, package catalog, purchase-history redesign, or refund clawback is included.

## Presentation and assumptions

- Add a compact warm-toned status panel inside the existing package card, below its title/price/action row. Preserve the balance card, typography hierarchy, screen padding, and ledger styling.
- Pending copy: **결제 대기 중** / **Google Play에서 결제를 확인 중이에요.** / **다시 결제하지 말고 상태를 확인해주세요.**
- Verification-failure copy: **구매 확인 지연** / **이전 구매를 확인하지 못했어요.** / **다시 결제하지 말고 상태를 확인해주세요.**
- If credits were already granted and only consumption failed, say that credits were added and purchase processing needs another check. Do not imply the user still lacks delivered credits or grant again.
- Keep existing bounded alerts where applicable; dismissing an alert does not clear the card status. Background resume must not repeatedly interrupt the user.
- While actively checking, disable repeat actions and show **확인 중**. A pending payment is a stable state, not an indefinite loading spinner. Permit manual recheck afterward.
- Maintain status per product while the screen is mounted. Reconstruct it from Google Play when the screen opens/resumes; do not add separate persistent storage of sensitive tokens or let status leak across signed-in users.
- A failed query preserves an existing unresolved status. Only a successful authoritative ownership refresh, or completed verification/consumption, can resolve it. If ownership disappears, clear the status without automatically opening checkout or assuming a refund occurred.
- Pending → purchased triggers verification, one credit grant, and consumption. Pending → canceled/disappeared clears the pending state without credits. Failure/unknown Google state must never be labeled pending by inference.
- Composed previews use the supplied video's screen at 360 × 800. The left side reconstructs the current after-alert state; it is not a recording of a real pending transaction. The right side is the proposed state. Recorded price/catalog are retained only for comparison, not proposed source changes.

## Previews and plan review

- Pending comparison: `.artifacts/billing-review/pending-card-comparison.png`.
- Verification comparison: `.artifacts/billing-review/verification-card-comparison.png`.
- Inspected same-size current/proposed screens for Korean readability, text wrapping, action clarity, contrast, card padding, ledger spacing, and fixed system navigation. Status is conveyed by explicit text rather than color alone. Current/proposed interaction state is after alert dismissal.
- Existing product identity and prices remain authoritative. No new icons are needed. Longer text and larger font settings require rendered verification during implementation.

## Implementation steps

1. Add a product-status callback/contract to the coordinator for pending, verification delay, completion-processing delay, active checking, and resolution. Ensure token deduplication, lifecycle disposal, and account isolation continue working.
2. Add an explicit server pending error for Google `purchaseState === 2`; keep canceled and unknown/invalid states distinct. Do not reinterpret the older generic error as proof of pending payment.
3. Expose a dedicated recheck operation that never requests checkout. Preserve unresolved state through network/readiness/verification failures; update it from fresh ownership results and native callbacks.
4. Render the status panel and appropriate action in the package card. Retain the existing global coordination lock and accessible disabled/checking feedback.
5. Add coordinator, screen integration, and server state-classification regressions. Update the original recovery tests as needed without weakening no-duplicate-credit/no-blind-consumption guarantees.
6. Run app/server type checks, touched-code lint, server build, and relevant tests. Inspect rendered states or faithful previews, documenting any native rendering gap.

## Acceptance criteria

- Status remains visible after dismissing alerts, and the action reads **다시 확인** for unresolved purchases.
- Pending and verification-failure states have distinct, truthful labels; the reported backend error is never shown as payment pending.
- Recheck never opens a purchase sheet, including when ownership clears or verification succeeds. Buying again requires a separate explicit tap after resolution.
- The action clears its busy state on completion/error. Pending remains readable without an indefinite spinner.
- Pending → purchased grants once and consumes only after verification; pending → canceled/absent grants nothing. Consumption retry does not grant again.
- Overlapping native callbacks, rapid taps, entry/resume, and query failures do not produce duplicate grants, redundant dialogs, false resolution, or cross-user state.
- Pending and delayed-verification panels look balanced and legible in context at actual display size, including larger text; meaning is understandable without color or technical error text.

## Verification and limits

- Coordinator tests: pending/unknown distinction, transition to success/canceled/absent, failed query retaining status, delayed verification, successful grant plus failed finish, recheck without checkout, callback races, and disposal.
- Screen tests: persistent text after alert dismissal, per-product action/disabled state, balance/ledger updates, recheck rather than checkout, and state reset when the account changes.
- Server tests: explicit pending classification only for state 2, canceled for state 1, unknown/invalid classification otherwise; no credit grant for any non-purchased state.
- Reuse the existing original-app baseline evidence for unrelated test failures; rerun baseline comparison only if new failures warrant it.
- Android Gradle downloads/SDK were unavailable during the earlier task. Native UI and actual Play transitions remain pending until an installed build can be tested. No real payment is needed for automated verification.

## Implementation and verification evidence

- Added `CreditPurchaseCard` using existing theme tokens and a status panel beneath the package/action row. Pending, delayed verification, and delayed completion are distinct. A recheck shows **확인 중**, exposes accessible disabled/busy state, and uses a 48-point minimum touch target. At smaller widths or larger font settings, the row stacks and text can expand without fixed heights or truncation.
- The coordinator publishes per-product statuses, retains them on query failures, resolves them from a successful ownership refresh or confirmed completion/cancellation, and routes unresolved `start` calls through recheck as an additional guard. A dedicated recheck cannot call checkout. Credits are consumed only after verification, and a failed finalization states that credits were already delivered.
- Native callbacks arriving during an ownership query cannot be erased by the older query, or downgraded from purchased to pending by a stale local snapshot. Explicit server state 2 remains authoritative for pending. Account changes remount the billing screen lifecycle so old balance, pending state, and callbacks cannot leak into the new session.
- The server now returns `GOOGLE_PLAY_PURCHASE_PENDING` only for state 2. Generic unknown/non-purchased errors remain verification delay in the app. State 1 cancels the pending display even if the local ownership cache is stale; a purchase attempt still reconciles ownership before opening checkout. No schema/migration, catalog, price, credentials, deployment, or credit clawback changed.
- Extracted the implemented React component's actual text/styles for ready, pending, verification delay, completion delay, checking, and 1.5× pending/completion text. Rendered faithful component previews over the supplied video's surrounding screen. Inspected wrapping, contrast, padding, action alignment, status clarity, and system-navigation clearance at 360-point width. The larger-text examples apply font scaling to the implemented card; the surrounding video remains reference imagery. These are not native Android screenshots.
- Preview artifacts: `.artifacts/billing-review/implemented-pending.png`, `implemented-verification.png`, `implemented-checking.png`, `implemented-pending-large.png`, and `implemented-completion-large.png` (all under that directory). Source tree capture: `status-component-tree.json`. Preview tooling does not change app runtime behavior.
- Coordinator/screen regressions cover persistent state after alerts, explicit vs unknown pending, query failure preservation, pending → purchased/canceled/absent, one-time credits and consumption, recheck with no checkout, completion failure copy, account changes, accessible checking feedback, callback/query races, per-product isolation, and disposed-screen safety.
- App/server TypeScript checks passed; touched app code/tests pass ESLint with zero warnings. Prisma generation and Nest build passed. Server suite: 43 passed, 1 existing isolated-Postgres case skipped because its explicit test URL is absent.
- Broader app suite excluding the previously established failing `App.test.tsx`: 113 passed across 12 suites before the final two callback/cancellation edge cases were added. The final focused coordinator/screen run passed all 38 cases after those additions. Existing original-app baseline evidence for the 12 unrelated failures is recorded in the recovery plan; it was not repeated without new evidence of failure.
- Native compilation/Play billing and full native visual acceptance remain unverified because Gradle downloads and an Android SDK were unavailable in the earlier verified environment. No real charge or live Google purchase request was used for these tests. Changes were subsequently committed separately by directory at the user's request (`4844cf3` app, `4ecbeff` server); no deployment was performed.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Exact model and reasoning settings are not exposed by runtime metadata. |
| Review the plan | Unknown | Unknown | Read local grill-with-docs instructions and inspected coordinator, credit screen, previous plan, and composed current/proposed states; runtime settings unavailable. |
| Implement | Unknown | Unknown | Implemented the approved status card, recheck lifecycle, and explicit server pending classification; exact runtime settings unavailable. |
| Verify | Unknown | Unknown | Completed automated checks, 38 focused app regressions, server suite/build, and faithful component-preview review; exact runtime settings unavailable. |
