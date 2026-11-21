# Recommendation failure feedback

## Agreed behavior

The user approved a failure-specific notification without automatic result navigation, retaining failed requests in history for review and retry, and removing the duplicate error panel below history. They additionally requested a visible explanation that a failed request uses no recommendation credit and a successful retry uses one credit.

Use the parent-facing wording: “추천권은 차감되지 않았어요. 다시 시도해 추천이 완료되면 추천권 1회가 사용돼요.” Provider billing details must not appear in the app.

## Scope and implementation

1. Send status-specific server notification copy. In the app, interpret the status payload so previously deployed servers cannot cause a failed push to appear successful. Foreground failures offer acknowledgement only. Background/cold-start failure taps return to recommendation home without opening result details. Success routing remains unchanged.
2. Keep failed history rows. Remove the selected-request failure panel below the history list. Manually opening a failed record shows request failure, its original conditions, the credit notice and a retry action when retryable. Do not show a zero-candidate result count for processing failures.
3. Retry the failed record's stored preferences and selected-child snapshot through the existing request path, not the current unfinished questionnaire. Retain the original record and create a new request. Guard duplicate taps, preserve insufficient-credit handling and avoid automatically opening a result detail on failure.
4. Preserve the existing server credit policy: processing errors, timeouts and empty results charge zero, while a new successful request with results charges one credit. Test failure followed by success, including repeated processing of completed jobs.

## Acceptance and verification

- Failed/timeout foreground pushes cannot display a completion title or a result action, even if notification text from an old server says otherwise.
- Failure notification taps cannot open result details. Success taps still do. User ownership and logout protections remain intact.
- One failed history row remains available without a duplicate bottom error. Its manually opened detail clearly describes failure and the credit policy.
- Retry uses that record's conditions and children, and cannot create duplicate submissions from repeated taps.
- Regression checks cover notification delivery modes, history/detail/retry, server notification payloads and charging after failure then success. Run app/server type checks and focused lint/tests. Record native rendering gaps honestly.
- Compare current screenshots with a same-size proposed static preview. Review text wrapping, clear action labels, hierarchy and unchanged surrounding layout. Visual acceptance remains pending a rendered inspection.

## Review status

Product Design audit is required by AGENTS.md, but its SKILL.md could not be read (Operation not permitted). The user explicitly approved substituting screenshot/preview comparison plus independent agent review. The before/after static reconstruction is at `previews/app-recommendation-failure-feedback.png`. It was shown before implementation and inspected for hierarchy, wrapping, clear credit wording and action placement. This is not a running-app screenshot.

The user confirmed retry belongs in the failed request detail and requested its cost beside the action. The detail shows “이번 요청에는 추천권이 사용되지 않았어요.” and “추천 완료 시 추천권 1회 사용” immediately below “다시 시도”.

Independent plan reviewer `/root/failure_plan_review` approved the scope and identified exact retry input preservation, synchronous duplicate-submit protection, status-aware notification routing, refreshed history and failure-specific detail text. Implementation addresses these via the existing request path with an optional source session, a ref lock, saved-session updates and status checks. Legacy missing child snapshots fall back to the stored child IDs in the user profile.

## Verification results

Independent verifier `/root/failure_verification` confirmed the status routing, retained history, retry transport, submission lock and credit policy. It identified cramped horizontal failure-header metadata and missing children in legacy records. The failure-only header now stacks metadata, and requests with missing original children are blocked with guidance to start a new recommendation. Retry buttons disappear immediately as the detail closes, while a synchronous request lock blocks duplicate submissions. Nonretryable failures show the no-charge notice without a retry button.

App TypeScript passes. Focused failure tests pass 15/15, covering rejected-request unlock, nonretryable records, missing children and legacy fallback. Lint has zero errors and the same two existing inline-style warnings. The full app suite passes 147/157 with the exact same ten named failures as the previously saved `welcome.log` baseline (sign-in/onboarding/guest/event fixtures and navigation scenarios). No new failing case was found.

Server TypeScript compilation passes. Focused notification/credit tests pass 18/18. All server tests pass 47 with one skipped database-dependent test. Failure-then-success tests confirm zero credits for the failed request and one for its new successful retry; reprocessing completed jobs does not charge again. No charging policy was changed.

Static preview reviewed with the bundled fonts. Failure title, retry action and conditional cost notice are readable and visually grouped. Real Android rendering and live foreground/background push delivery could not be exercised in this environment and remain unverified. The server notification copy requires deployment with the server changes. Updated app foreground handling independently corrects old server failure notification text.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | /root | grill-with-docs | Unknown | Unknown | Repository skill read, notification and request flow inspected, user approved behavior and credit notice. No confirmed runtime model settings supplied for this turn. |
| Review the plan | /root/failure_plan_review | None | Unknown | Unknown | Read-only review of plan and code; findings addressed above. |
| Implement | /root | None | Unknown | Unknown | User approved functional scope, credit notice and substitute review. Status-aware alert/routing, retry and duplicate error removal implemented. |
| Verify | /root/failure_verification | None | Unknown | Unknown | Read-only independent code/static preview review; app types and focused tests, lint, server compilation and 18 tests. Findings addressed above. |
| Verify | /root | None | Unknown | Unknown | Final focused checks, app full-suite baseline comparison and server full suite. Static preview inspected. Native rendering remains unverified. |
