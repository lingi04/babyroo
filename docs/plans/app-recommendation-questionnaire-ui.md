# Recommendation questionnaire UI

## Approved direction and stage boundary

Implement the supplied content-area mockup and eight-question proposal. Use the current header/footer and tab transitions. Backend and LLM integration of interest is deferred by the user. The user explicitly approved local questionnaire interest selection and confirmation, with existing supported conditions continuing through the current recommendation request. Interest is excluded from its submitted answers/preferences until integration is approved.

## UI and interactions

- Present exactly eight questions in the supplied order. Replace atmosphere with one interest choice. The last question asks duration when the youngest selected child is under 24 months, otherwise activity type.
- Use the supplied Korean wording. Show the saved-home option only when a saved address exists and keep the existing address picker for manual departure.
- Show Previous / current step of eight / Close on one row. Previous is disabled at step one. A 6 dp progress bar and 28/36 sp bold question title precede vertically arranged answer rows.
- Illustrated interest rows use four watercolor pictograms (train, butterfly, boots, xylophone), 56 dp square, with 16 dp gaps and padding. Use 18/26 sp semibold labels. Allow natural wrapping and row growth, minimum row height 80 dp for illustrations and 56 dp for plain answers. Selected rows use peach fill, orange border and a trailing check.
- Display a pending selection highlight immediately for 250 ms, then commit the answer and advance. Use 900 ms with a screen reader enabled. Lock duplicate taps and discard a pending selection on Previous, Close, unmount or tab departure. Manual address entry uses the existing picker before committing. Scroll question content back to the top after changing questions.
- Hide history and previous-result failure/empty states while interviewing or confirming. Preserve the existing confirmation editing and submission flow. Keep older answer values readable.

## Verification

[Question 3 and 4 preview](previews/app-recommendation-questionnaire.png) is a static layout reconstruction using the bundled fonts and generated illustrations. Inspected title hierarchy, row padding, illustrated/plain variants, selected contrast and progress placement at the 390 dp reference size. It is not a running-app screenshot.

Completed TypeScript and lint. Five focused questionnaire/integration checks pass, including 900 ms screen-reader feedback. The full suite passes 132/142 tests; the remaining 10 failures are in previously failing app scenarios. Native screen widths and enlarged-text rendering remain unverified.

Check order/count, both last-question branches, saved/missing/manual departure, selected feedback, rapid taps, previous/close cancellation, confirmation editing, history visibility and interest omission from network requests. Run TypeScript, lint and relevant tests. Compare actual rendering with the supplied mockup at 360/390/430 dp and enlarged text when native access permits. Remaining phone verification gaps must be reported.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | Main agent | grill-me instructions consulted | gpt-6.1-sol | Unknown | Supplied mockup and UI-first scope; user explicitly approved local interest with backend ranking deferred. |
| Review the plan | plan_review | None | Unknown | Unknown | Flagged history compatibility, local-interest exclusion, mounted-tab timer cancellation and both final-question branches. Addressed. |
| Implement | Main agent | ImageGen | gpt-6.1-sol | Unknown | Generated four consistent interest illustrations. |
| Verify | fixed_shell_verify | None | Unknown | Unknown | Independently passed types, lint and two component tests; checked timers, eight-step flow, local-interest exclusion and historical display. |
| Verify | Main agent | None | gpt-6.1-sol | Unknown | Integration check passes departure picker, eight answers, confirmation editing, history visibility, back navigation and interest omission from the request. Native rendering remains unverified. |
