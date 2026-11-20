# Google Play purchase recovery and checkout readiness

Status: Implemented after the user approved implementation ("okay, fix it!"). Server changes are committed in `9d49474`, with diagnostics/pending classification followed up in `4ecbeff`; app changes are committed in `4844cf3`. Automated verification completed; Android native build, deployment, and Play device verification remain pending. The user reported configuring the service-account permissions; live API access has not been independently verified.

Video review: Completed from the accessible workspace copy `.artifacts/billing-review/purchase-flow.mp4` (7.33 seconds, 1080 × 2400). Extracted frames at half-second intervals and inspected the sequence. Evidence: `.artifacts/billing-review/timeline.jpg`. This is a review of the recorded UI, not execution of the current checkout or proof of the order's refund state.

## Recorded reproduction and review corrections

1. The credit screen shows a zero balance and a five-credit package priced at ₩2,500.
2. After purchase is initiated, the button shows processing and a Play sheet appears.
3. Around 3–4 seconds, Play reports that the item is already owned.
4. After that sheet closes, the app briefly still shows processing, then around 5 seconds displays a second dialog: credit top-up failed, with the raw English service-account configuration error.
5. After dismissal, the screen returns to the purchase button and the balance remains zero.

The recording confirms overlapping Play ownership and app verification failures in one interaction. It does not establish that the two failures share a callback, that a new charge occurred in this recording, or whether Google had revoked ownership after the earlier refund. Source inspection establishes multiple asynchronous entry points; correlation of those paths is an implementation/test requirement rather than a conclusion from the video alone.

The recorded package catalog differs from the current source defaults (five credits at ₩4,900 and a twelve-credit package). Use the recording to reproduce the error flow, and test with the runtime catalog; do not change prices or add/remove packages as part of this fix. Confirm the installed build and deployed backend versions during device verification.

## Agreed scope

The user requested both recovery from owned/unfinished purchases and a backend readiness check before checkout. Keep Google Play purchase verification authoritative. Do not bypass billing, configure external secrets, issue refunds, or deploy as part of this change.

## Findings

- `CreditStatusScreen` restores purchases on entry but treats an already-owned error as an ordinary failure. Both the purchase callback and the request rejection can report errors independently.
- Backend verification errors prevent `finishTransaction`, leaving a successful purchase unconsumed. This must remain recoverable without charging again or duplicating credits.
- Checkout currently has no backend credential check. The exact reported configuration error occurs before Google purchase verification.
- Existing server purchase-token idempotency must be preserved. The client already consumes purchases after successful credit verification.
- Refund propagation may leave stale Play ownership locally; a client cannot guarantee immediately clearing Google ownership. A refund must never be treated as a successful credit purchase merely to clear this error.

## Requirements and assumptions

- Refresh owned purchases on screen entry, app resume while this screen is active, and already-owned errors. Bound recovery to prevent retry loops and duplicate error alerts.
- Coordinate screen-entry restoration, resume restoration, purchase callbacks, and purchase-request failures through one recovery lifecycle. Refreshing on resume after a Play sheet must not start a competing recovery or surface a second configuration alert for the same attempt. Always release the processing state on terminal failure, cancellation, or completion; pending payment must not leave a spinner running indefinitely.
- Process only relevant completed credit purchases; pending purchases do not grant credits or get consumed.
- Retry verification of unfinished purchases, grant credits exactly once, then finish consumption. A finish failure must be recoverable using the same token without another grant.
- Distinguish refunded/canceled or otherwise invalid purchases from recoverable verification/network errors. Never consume an unverified purchase as a shortcut. Refresh Play ownership and provide a clear recovery message when stale ownership remains.
- Before opening a new checkout, fetch a fresh authenticated backend readiness result and reconcile any owned purchase for the selected product. Block checkout when readiness is missing, invalid, unknown, or unavailable.
- If reconciliation finds an unfinished purchase, recover that purchase and end the current button action. Do not silently open a new checkout after recovery; any subsequent purchase requires another explicit user action. Serialize rapid taps before asynchronous checks start.
- Readiness validates the credential material needed by the current adapter without exposing it. It does not guarantee Play permissions, product setup, license-tester status, or a free test transaction.
- Keep the existing screen layout. Improve messages for configuration failures, recovery, and delayed ownership updates as necessary. No new screen or design is proposed.
- Replace raw credential/configuration error text with a localized, actionable billing-unavailable message. Distinguish a blocked new checkout from an existing purchase whose credits could not yet be delivered; do not promise that an existing purchase was uncharged, canceled, or refunded. Record technical error codes for diagnosis without exposing credentials or full purchase tokens.
- Service-account setup and Play Store device verification remain separate operational work.

## Implementation steps

1. Add an authenticated billing readiness contract and server check using the same configuration parser as purchase verification. Reject missing/malformed credential material and avoid returning secrets.
2. Add app API support and a focused purchase recovery coordinator/helper, keeping state and errors bounded across callbacks and request rejections.
3. Gate checkout with fresh readiness and owned-purchase reconciliation; handle completed, pending, invalid/refunded, already-credited, and transient-failure states explicitly.
4. Restore unfinished purchases on entry/resume and after already-owned errors; ensure successful tokens are not repeatedly processed from stale hook state.
5. Add meaningful regression tests for readiness, recovery, credit idempotency, failed consumption retries, pending/refunded purchases, and duplicate callback/error paths. Specifically reproduce the video's Play ownership error followed by restoration against an unconfigured backend, including app resume while checkout is active.
6. Document configuration and device-test steps; update this plan with verification evidence and limitations.

## Acceptance criteria

- Missing or malformed backend credentials prevent opening a new checkout; existing balance/ledger access remains available.
- Already-owned errors trigger a bounded ownership refresh and recovery rather than an unrecoverable generic failure.
- Repeated callbacks, screen entry/resume, and retries do not duplicate credits or trigger repeated checkout attempts.
- The recorded already-owned → configuration-failure sequence produces at most one app-owned explanatory dialog for the attempt. Google owns its Play sheet; the app cannot suppress that sheet once Play has opened it. Processing clears reliably, including after the dialog is dismissed, and background restoration does not repeatedly interrupt the user.
- A purchase button action that recovers a previous purchase cannot immediately create a second purchase; rapid taps cannot race readiness/recovery checks.
- A verified credited purchase can finish consumption on retry without granting credits again.
- Pending, refunded/canceled, and unverifiable purchases never receive new credits or get blindly consumed.
- Users receive understandable messages distinguishing payment completion from credit delivery problems; messages do not imply that a backend error canceled a charge.
- Existing screen spacing, typography, and layout stay consistent; any changed dialogs are inspected in a rendered preview/device when available. Actual Play checkout and refund sync require a device and configured backend.
- Before implementing changed dialog text or interaction presentation, share a current video frame and a clearly labeled proposed preview at matching display dimensions, as required by AGENTS.md. Verify readability and localized language at actual display size; visual approval remains pending until the rendered comparison is inspected.

## Verification

- Run focused app Jest regression tests and TypeScript/ESLint checks for touched code.
- Run server billing regressions, typecheck, build, and relevant existing tests.
- Review against all acceptance criteria. No real purchase is needed for automated verification.
- Replay the recorded sequence in mocked integration tests: a stale owned purchase, missing backend configuration, Play-sheet resume, and both callback/request failure paths. Assert no checkout when preflight fails, no duplicate app alerts, no new credits, no blind consumption, no stuck processing, and no automatic second checkout.
- On device after configuration: use an explicitly labeled test payment method; cover success, verification failure/recovery, already owned, pending, consumption retry, and refund synchronization. Record any unverified device cases.
- The default Git executable is blocked by an invalid Xcode command-line-tools path. Diff/status checks were completed with Fork's bundled Git and system/global config disabled; no user Git configuration was read or modified.

## Implementation and verification evidence

- Added authenticated `GET /credits/google-play/readiness`; it checks the same credential parser used by purchase verification. Missing/malformed JSON, incomplete credentials, invalid email, and invalid/non-RSA private keys fail closed. It returns only `ready`, without making a Google API call. Fresh preflight failure blocks checkout even against an older server lacking the endpoint.
- Extracted `CreditPurchaseCoordinator` and integrated it into the credit screen. It serializes taps, native callbacks, and restoration; queries owned purchases directly rather than acting repeatedly on stale React hook snapshots; and restores on entry/resume/already-owned errors. A late native error cannot add another automatic dialog after the current attempt settles.
- Pending or unknown client states are not verified/consumed. Server-reported canceled/pending purchases refresh ownership without credits or consumption. Consumption retries use token idempotency; an item-not-owned result is accepted only if a fresh query confirms absence. Successful tokens are skipped in stale snapshots, with an explanation on a new purchase attempt.
- Verification rechecks the Google state even for previously credited tokens, validates the app/product association, and rejects cross-account grants. Fixed an in-memory same-token race and guarded cross-account results in both repository adapters. Prisma's existing unique-token constraint and transaction continue to prevent duplicate persistent grants; no schema or migration changed. This work does not claw back credits granted before a later refund.
- Replaced technical billing error dialogs with Korean recovery/status messages. Shared and inspected `.artifacts/billing-review/dialog-comparison.png`: left is a video frame and right is a composed proposed dialog at the same 360 × 800 display size. Checked readable Korean glyphs, line wrapping, padding, contrast, and action alignment. This is a preview, not a screenshot of an installed updated app; native visual acceptance remains pending.
- New regression coverage: 18 coordinator cases, 3 credit-screen integration cases, and 8 server billing cases. These cover the recorded sequence, resume/callback overlap, rapid taps, readiness errors, duplicate events, pending/canceled purchases, consumption retries, stale ownership, and concurrent token verification.
- App and server TypeScript checks passed. ESLint passed for all touched app code/tests with zero warnings. Prisma client generation, Nest build, and static/generated asset copying passed using the installed engine explicitly to avoid an inaccessible global cache. Diff whitespace checks passed.
- Server suite: 40 passed, 1 existing isolated-Postgres test skipped because its explicit test URL is absent. No production DB was used. Real Postgres billing concurrency was not exercised; in-memory concurrency and server verification paths were covered.
- Broader app run: 96 passed across 12 suites with the known failing `App.test.tsx` suite excluded (before the final two coordinator cases were added). The original full run had 12 failures in that suite; a separate test using the original HEAD app file reproduced the identical 12 failing test names. Temporary baseline source/test copies were removed. Those pre-existing navigation/fixture failures were left outside this billing fix.
- Native build attempt failed before compilation: Gradle 9.3.1 is not cached, and `services.gradle.org` could not resolve. The configured Android SDK is unavailable in this runtime. No Android APK/device/simulator billing verification, live Google API call, real charge, secret configuration, or deployment was performed.

## Rollout and device verification remaining

Follow-up diagnostic correction: The user reported the new recovery dialog on screen entry and `credits.googlePlay.verify.failure productId=starter_5 errorType=Error`. This proves a verification request failed, but the original redaction removed the status needed to identify its cause. Within the approved diagnostic scope, added allowlisted HTTP status, Google status/reason, OAuth error code, and network code fields to verification and consumption failures. Raw messages, request URLs/configuration, headers, full response bodies, purchase tokens, and private keys stay excluded. Three regression cases verify useful diagnostics and absence of sensitive/free-form data; 11 billing server cases pass. The production root cause remains unknown until the additional log fields or external configuration are checked. This follow-up is committed in `4ecbeff`; no production API requests were made.

1. Configure backend credentials and Play API permissions as documented in `server/README.md`, then deploy the backend before distributing the updated app. The readiness gate exists only in the new app; old installed builds do not acquire it automatically.
2. Build/install the updated Android app in an environment with Gradle and the Android SDK. Confirm its version and backend match the intended release.
3. With the same Google account registered as a license tester, confirm an explicit **Test card** is displayed before completing checkout. Verify success, pending payment, outage/recovery, consumption retry, and refund ownership synchronization. The app cannot force Google's refund/cache state to update immediately.
4. Inspect the native dialogs and processing state at actual device size. Keep native visual acceptance pending until then.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Exact model and reasoning settings are not exposed by runtime metadata. |
| Review the plan | Unknown | Unknown | Reviewed current app flow, installed IAP types, server adapter/service, test conventions, and half-second frames across the supplied 7.33-second recording; exact runtime settings unavailable. |
| Implement | Unknown | Unknown | Implemented approved app/server recovery and readiness changes in this runtime; exact model/reasoning settings unavailable. |
| Verify | Unknown | Unknown | Ran coordinator/screen/server regression tests, app/server type checks, lint, Prisma generation, Nest build, baseline comparison, diff review, and dialog preview inspection; exact runtime settings unavailable. |
