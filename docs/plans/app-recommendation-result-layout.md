# Saved recommendation results layout

Status: Approved, implemented, and verified with local test data.

## Scope

Apply the Council mockup's venue-first layout to the existing React Native recommendation detail screen. The same screen serves newly opened and historical results. Preserve the backend response and display the stored reasons and caution for each venue. Use the stored result and event fields for text illustrated in the mockup.

## Acceptance criteria

- The requested visit range and the past-visit indicator remain visible when applicable. The successful screen has a single title and puts the venues before questionnaire answers. Keep stored timestamp and child context accessible with the collapsed conditions.
- Each venue card shows a thumbnail, venue name, known locality and useful known metadata, a full-width reason area, and one visible Korean detail action. Use the existing event detail route and one accessible action for the whole card. Keep event start metadata and nearby crowding information accessible from the venue detail.
- Use a continuous white card surface through the orange `상세 보기` label and chevron, as shown in the revised mockup.
- Show the saved reason and caution distinctly, including long reasons and different eligibility dates for siblings. Use event data for locality, price and indoor/outdoor labels, and omit unknown facts that lack a useful display value. Preserve event snapshot precedence for saved results.
- `선택한 조건 보기` is collapsed by default and expands to the existing read-only answers. Use a button role and expanded state. Legacy sessions without answers can still show available saved context.
- Failed and missing-result sessions keep their explanations and retry behavior. Explore cards and the editable questionnaire follow their current layouts.
- At Android phone size, venue names, their differences and the details action are easy to scan. Check spacing, typography, contrast, touch targets, focus order, and long Korean text or larger font settings.
- TalkBack can read each venue's key facts, reasons and cautions and identify a single venue-detail action. Expanded saved answers announce their questions and values as read-only content. Check that the event overlay receives focus and that returning restores the result screen's scroll and disclosure state.

## Implementation and verification

1. Main agent creates a venue-first layout scoped to the recommendation detail screen. Reuse the existing thumbnail assets, theme, event formatting, event navigation and read-only answers. Keep one clear tap action and use the card width beneath the image for reasons.
2. Main agent adds the conditions disclosure and keeps failure and empty handling on their current paths. Hide the duplicate results heading and unlabeled event-start date on these cards.
3. Main agent updates the relevant React Native integration tests for saved and legacy sessions, disclosure state, card navigation, caution visibility and retry. Run app tests, typecheck, applicable lint, and diff checks.
4. Independent verification agent checks the diff, tests and screenshot evidence. Use an Android device or simulator to exercise the successful result, conditions collapse/expand, event navigation and return, and failure/retry. Inspect the result beside the proposed mockup at matching display width. If native rendering is blocked, make a faithful preview where feasible and report the native verification gap.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- | --- | --- |
| Plan | /root | grill-with-docs, Product Design audit | gpt-6.2-sol | Unknown | Runtime model metadata. Compared the supplied screenshot and existing mockup with the saved session, shared card, and answer summary code. |
| Review the plan | /root/app_plan_review | Product Design audit | Unknown | Unknown | Compared both supplied images and reviewed the saved answer and event overlay code. Added requirements for read-only announcements, card reading order, focus isolation, and state restoration. Static images have different capture heights. |
| Implement | /root | None | gpt-6.2-sol | Unknown | Runtime model metadata. Updated the React Native layout, disclosure, accessibility, and integration tests. |
| Verify | /root/app_layout_verify | Product Design audit | Unknown | Unknown | Agent passed all 11 focused tests and compared emulator and mockup. Reported the background tab accessibility gap, which the main agent addressed. |
| Verify | /root | Product Design audit | gpt-6.2-sol | Unknown | Runtime model metadata. Checked native styling, enlarged text, and disclosure and venue navigation. Re-ran app tests and examined baseline test and lint results. |

## Verification results

- Typecheck and diff checks passed. The 11 focused tests passed. The full suite passed 172 tests and retained 10 failures reproduced at the pre-change commit. Lint retained the same existing error and seven warnings.
- A read-only Pixel emulator ran the screen with sample events and fallback thumbnails. The orange action sits on the continuous white card. Conditions expanded, venue details opened, and the disclosure remained expanded after returning. At 140% text size, the reason wrapped and the action stayed visible.
- Native TalkBack speech and focus order, the signed-in live flow, and real venue images remain unverified. Failure and retry were covered by integration tests.
