# Shared credits and Android credit history

## Scope

Babyroo is pre-launch. Start public accounts in shared credit units. Existing-user conversion and old public app support are out of scope. Use a clean pre-launch dataset at deployment or handle existing test data separately. The deferred area unlock feature remains separate.

Use 30 credits for the existing three-recommendation signup allowance. The starter Google Play product keeps its existing ID and grants 50 credits. Use ₩2,500 as the proposed KRW fallback and prefer the Play offer price. Keep the existing family pack hidden in Android using its product ID and retain its 12-recommendation equivalent. Live Play pricing and test purchase verification are release checks.

Use the approved text-only credit mockup. Present a balance with 크레딧, a pack with the recommendation equivalent, and chronological transaction rows with light dividers, action labels, timestamps and signed amounts. Make the charge explicit before recommendation submission. Pending payments use the existing purchase status experience.

## Acceptance and implementation

- Main agent updates the catalog, signup defaults, recommendation affordability and copy. Nine credits are insufficient. Ten credits buy one recommendation with results.
- Main agent makes completion and the debit atomic in PostgreSQL. Competing requests cannot overdraw an account. A duplicate job does not debit again. Failed and empty results cost zero.
- Main agent updates Android balances, signup and purchase history copy, purchase states and recommendation surfaces. Signed amounts and written units remain legible at mobile width.
- Separate plan reviewer checks the code paths, cutover assumptions and agreed mockup. The user authorized implementation with the plan in this worktree.
- Separate verifier checks the diff and relevant tests, and reports any gaps. The main agent verifies the rendered UI where available.

## Plan review

The reviewer confirmed scope and requested explicit environment units, authoritative Play pricing, zero-cost failure on competing spends, notification coverage and duplicate regression checks. The plan incorporates those points. Update any configured DEFAULT_RECOMMENDATION_CREDITS value to the new unit before deployment. Data preparation is operational work.

## Verification record

- Server build and tests passed. 65 passed and one database integration test was skipped. The new in-memory regression covered balances of 9 and 10 credits, competing completions and duplicate jobs.
- Android type checking and 48 focused billing, history and notification tests passed. The full suite had 169 passing tests and the same 13 failures as unchanged main. Changed-file lint reproduced the existing App.tsx error and three warnings.
- The approved 360 px text mockup was inspected. The Credit Status component test checked signed amounts, written units, purchase attribution and hidden family pack. Native Android rendering and TalkBack, the PostgreSQL race, and Korean Play checkout were unverified.
- Before launch, verify Play pricing and the configured signup balance. Review production access to the existing manual purchase route. Do any pre-launch data preparation separately.

## Model usage

| Stage | Agent | Plugin / skill | Model | Reasoning level | Evidence |
| --- | --- | --- | --- | --- | --- |
| Plan | /root | grill-with-docs | gpt-6.2-sol | Unknown | Runtime model metadata. Reused decisions and mockup from the conversation. |
| Review the plan | /root/plan_review | None | gpt-6.2-sol | Unknown | Reviewer confirmed runtime model and checked scope, environment and completion behavior. |
| Implement | /root | None | gpt-6.2-sol | Unknown | Runtime model metadata. |
| Verify | /root | None | gpt-6.2-sol | Unknown | Runtime model metadata. Ran builds, tests, type checking, lint and baseline comparison. |
| Verify | /root/verify | None | gpt-6.2-sol | Unknown | Reviewer confirmed runtime model, inspected the diff and test logs and compared the baseline failure names. |
