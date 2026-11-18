# Stabilize the Explore recommendation CTA

Status: Implemented with user approval to defer visual verification.

## Agreed requirements

- Keep the current CTA appearance, placement, text, and recommendation action.
- Hide the CTA after 48dp of upward movement.
- Show it after 48dp of downward movement, only while the list offset exceeds 420dp.
- Hide immediately at offsets of 420dp or below.
- Keep its visibility when scrolling stops and on movements below the threshold.

## Implementation decisions

- Measure net directional movement from the latest turning point. Track the
  highest offset while visible and the lowest offset while hidden; small
  reversals must not accumulate into a false transition.
- Start hidden. On entering the eligible region from above, count downward
  movement from the latest low offset, so an ordinary initial scroll past 420dp
  shows the CTA without an additional 48dp delay.
- Clamp negative offsets and offsets beyond the scrollable content range so
  overscroll bounce does not count as user movement.
- Preserve the existing compact-header and filter-collapse behavior.
- Keep existing component lifetime/reset behavior; no changes to login,
  child selection, filtering, or recommendation eligibility.

## Acceptance criteria

- Visible at 600dp, then 588dp: remains visible.
- Visible at a high point of 600dp: hidden at 552dp, still visible at 553dp.
- Hidden at a low point of 552dp: shown at 600dp, still hidden at 599dp.
- Small oscillations within a range narrower than 48dp do not toggle visibility.
- At 420dp or below the CTA is always hidden, including a direct jump to top.
- Equal offsets do not change visibility; large scroll deltas work correctly.
- Overscroll bounce does not spuriously toggle visibility.
- CTA typography, contrast, spacing, alignment, tap action, and tab clearance
  match the existing screen. Compare the same viewport and scroll state.

## Steps

1. Review the plan and current/proposed comparison with the user.
2. Extract the scroll transition calculation into a small pure helper with
   focused regression tests for thresholds, jitter, resets, and overscroll.
3. Connect the helper to Explore scroll handling using a ref for its state;
   update React visibility only when the calculated visibility changes.
4. Run focused Jest tests, TypeScript checking, and lint for changed files.
5. Inspect the native screen in both directions, at the cutoff and near the
   content bottom. Update this plan with verification results.

## Review and environment limitations

- Previous logic in `app/App.tsx` hid on any negative scroll delta.
- Comparison: `previews/app-explore-cta-scroll-comparison.svg` uses a saved
  Explore screen and reconstructs the CTA for the proposed interaction state.
  It is not a screenshot of the running app or its current scroll position.
- Native tooling and skill files were inaccessible in the current sandbox.
  Quick Look rendering also failed. Rendered comparison inspection and native
  visual verification remain pending.

## Verification results

- Added `recommendationCtaScroll.ts` and connected it to Explore scroll handling.
- Seven focused Jest regression tests pass, including exact thresholds, pauses,
  jitter, turning points, the 420dp cutoff, and overscroll clamping.
- App TypeScript check and ESLint for all changed application files pass.
- Native build and rendered visual review remain unverified due to tooling
  restrictions. CTA styles, text, placement, and action are unchanged in code.
- User requested committing the implementation, tests, plan, and preview.
