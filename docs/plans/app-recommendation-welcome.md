# Recommendation welcome screen

## Approved design

Use the selected watercolor welcome layout with the current header, footer and tab behavior. Show “이번엔 어디로 떠날까요?”, the eight-question introduction, family-map illustration, selected children, recommendation action, quiet credit-history link, and compact previous recommendations.

## Layout and behavior

- At 390 dp use the existing 20 dp content margins. Title uses Pretendard Bold 28/36; description Medium 14/20. The hero artwork spans the content width with a natural 2.3:1 aspect ratio.
- Child control is a bordered 12 dp radius row with 12 dp padding and a 44 dp minimum touch target. One child may use a generic illustrated avatar. Multiple children each receive a separate name/age line, with one shared 변경 action. Long names wrap and the row grows. Preserve actual selected-child order and current settings navigation.
- Main action is 52 dp minimum, orange with white 16/24 semibold text. Existing loading/credit requirements continue. Label the normal start action 추천 시작하기 and repeat action 다시 추천받기. Keep the existing questionnaire and confirmation.
- Credit link reads 추천권 구매 · 사용 기록 in subdued 13/18 text.
- History uses 지난 추천, compact image/date/conditions rows and fine separators. Use real result imagery when available; otherwise use generic outing artwork. Preserve pending/failure/expired states and navigation. Never invent event names or user preferences.
- Welcome content appears only when idle. Keep the new questionnaire and history-hiding behavior intact.

## Verification

The user clarified the normal CTA rule: show 다시 추천받기 when at least one displayed history record lacks the 지난 일정 badge; show 추천 시작하기 when there are no displayed records or every displayed record is past. History/detail badges and the CTA share the session-date helper. Loading and failed records keep their existing non-past status. Credit-loading and top-up states retain their current labels. Five integration cases plus saved-date/status checks passed, along with types and lint.

Real-phone feedback exposed native Image intrinsic dimensions overriding the intended hero aspect ratio. Moved the aspect ratio to a containing View and explicitly sized the child image to 100% width and height. The frame now computes a roughly 152 dp image area at 350 dp content width. Added a regression assertion for bounded image sizing. Corrected native appearance remains pending a device check.

[One-child and two-child preview](previews/app-recommendation-welcome.png) is a static reconstruction using the actual bundled fonts and new artwork. It demonstrates wrapping and context-row growth. It is not a running-app screenshot. Inspected hierarchy, artwork scale, action placement and multiple-child readability.

TypeScript, lint and the welcome/questionnaire checks pass. The full suite passes 133/143 tests with the same 10 previously failing scenarios. Device appearance, narrow widths and enlarged system text remain unverified.

Check one/two/three selected children, long names, zero selected children, loading/zero credits, empty history, previous records without snapshots, pending and failed sessions. Run types, lint, relevant integration tests and full suite for baseline comparison. Render previews with actual assets and fonts. Native visual acceptance remains pending if device access is blocked.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | Main agent | grill-me instructions consulted | gpt-6.1-sol | Unknown | User selected the watercolor design and separate lines for multiple children. |
| Review the plan | plan_review | None | Unknown | Unknown | Reviewed selected-child fallback, credit gating, real session dates/statuses and remote-image fallback. Addressed. |
| Implement | Main agent | ImageGen | gpt-6.1-sol | Unknown | Created the selected family-map illustration as a reusable asset. |
| Verify | fixed_shell_verify | None | Unknown | Unknown | Independently passed types, focused lint and four welcome/questionnaire tests. Reviewed purchase gating, state isolation, history states and image fallback. |
| Verify | Main agent | None | gpt-6.1-sol | Unknown | Full suite baseline comparison and static visual inspection. Native visual acceptance pending. |
