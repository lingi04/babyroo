# Parent-facing recommendation reasons

Status: Approved, implemented, and verified locally.

## Requirements

- Give parents a concrete reason to consider each outing. Lead with a verified fact that connects to a stated preference or helps compare venues, such as free admission or a listed duration.
- Keep final Korean wording rule-based. OpenAI chooses an existing fact key, and the server writes the user-facing text.
- Apply the same writing rules to the deterministic fallback. Retain each child's eligible date and preserve separate cautions about reservations and closures.
- When useful facts are sparse or shared across options, state what the data supports. Preserve current ranking criteria, response shape, and saved recommendation text.
- Assume the copy should be concise, practical Korean. Target one short benefit and one eligibility reason in the usual case. Preserve distinct eligibility information when children have different qualifying dates.

## Acceptance criteria

- A free indoor venue can lead with its listed admission benefit. A verified preference match can explain why that option fits the family's outing.
- A generic indoor fact yields to a more useful supported fact where available. Similar venues can still have identical reasons if their supported facts match.
- Age-fit phrasing names the qualifying child or children and date without implying available bookings or admission. Retain narrower age-eligible windows and individual assignments.
- An unsupported model fact key, no selected fact, or sparse venue data still produces a grounded result.
- Honor an informative model-selected fact. If the selection is missing, invalid, or generic and a stronger supported benefit exists, use the deterministic fact selector without dropping or re-ranking the outing. Attribute a preference to the family only when their answer supports it.
- Newly generated recommendations use the new copy on both paths. Existing results remain readable without migration.

## Implementation and verification

1. Main agent inspects reusable event fact keys and the model response parser. Give the OpenAI prompt explicit guidance to prefer informative supported facts without changing ranking instructions.
2. Main agent updates the shared reason renderer and Korean templates where needed. Give deterministic picks a sensible fact priority based on available facts and the family's answers. Preserve caution behavior.
3. Main agent updates existing ranking tests for useful fact priority, sparse facts, both generation paths, and shared or individual age eligibility. Assert age-fit content independently of its position and retain distinct dates when siblings share a card. Align the recommendation policy's ranking description with the rule-based renderer. Run the server build, typecheck, and tests.
4. Independent verification agent checks the diff and test evidence against the acceptance criteria. No specialist skill assigned. Report commands, results, and remaining gaps.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- | --- | --- |
| Plan | /root | grill-with-docs | gpt-6.2-sol | Unknown | Runtime confirms model. User selected rule-based wording. Inspected prompt, reason renderer, event facts, and recommendation policy. |
| Review the plan | /root/reason_plan_review | None | Unknown | Unknown | Agent checked the response parser and ranking tests. Plan now defines fact precedence, preserves per-child dates, and checks that preference wording is supported. |
| Implement | /root | None | gpt-6.2-sol | Unknown | Runtime confirms model. Updated the prompt, shared reason renderer, free indoor wording, policy, and ranking tests. |
| Verify | /root/reason_verification | None | Unknown | Unknown | Agent reported 17 ranking tests passing and a clean diff. It flagged ambiguous prompt wording about the fact key. The main agent clarified that the instruction applies only to the fact field. |
| Verify | /root | None | gpt-6.2-sol | Unknown | Runtime confirms model. Re-ran the server suite and typecheck after the prompt clarification. |

## Verification results

- `npm test` built the server and finished with 70 passing tests and one skipped Postgres integration test.
- `npm run typecheck` and `git diff --check` passed.
- The OpenAI response was mocked in the tests. Live output and on-device rendering were not exercised.
