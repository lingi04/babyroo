# Explore back-to-top button

Status: Implemented after explicit approval; native visual verification pending.

## Agreed requirements

- Add a bottom-right arrow-only circular back-to-top button in Explore.
- Show after scrolling down one screen; tapping smoothly scrolls to offset zero.
- Keep it visible whether the black recommendation CTA is visible or hidden.
- Position above the recommendation CTA while that CTA is visible; move down
  above bottom navigation when it disappears.

## Design and implementation decisions

- Interpret one screen as the Explore list viewport height reported by its
  scroll event, rather than the device physical screen height.
- Show when the clamped offset exceeds that height; hide at or below it.
  This includes hiding during the animated return to the top.
- Use a white 48×48dp circle with a dark upward arrow, subtle border and
  existing elevated shadow; right inset 20dp. No visible text label.
- Use the existing floating action baseline (96dp plus bottom safe-area inset).
  When the CTA is visible, add its measured height and a 12dp gap. Measure with
  `onLayout` so increased font size and wrapping cannot cause overlap.
- Keep the repositioning immediate; smooth animation applies to list scrolling.
- Add a typed FlatList ref and call `scrollToOffset({offset: 0, animated: true})`.
- Set an accessible button role and Korean accessibility label. Prevent
  repeated return-to-top requests during the same programmatic scroll if needed.
- Preserve filters, header collapse, recommendation CTA thresholds, and the
  list data. Return to the existing collapsed top state without expanding filters.

## Acceptance criteria

- Hidden initially and through one viewport of scroll; visible beyond it.
- Both recommendation CTA states leave the button visible at eligible offsets.
- Button and CTA never overlap; button stays above bottom navigation and safe
  area, including enlarged text and a narrow screen.
- Tapping returns the list and its header to the top with native smooth scrolling.
- Button disappears when the return scroll reaches the eligibility cutoff.
- Empty or short lists cannot show the button through overscroll bounce.
- White circle, border, arrow, shadow, and spacing are readable and balanced
  against the surrounding cards, warm background, black CTA, and bottom tabs.
- Existing recommendation scroll regression tests continue to pass.

## Steps and verification

1. Review current/proposed previews in both CTA states and obtain plan approval.
2. Add the list ref, visibility tracking, measured CTA height, and button.
3. Check TypeScript, lint for changed files, and relevant scroll regression tests.
   Add focused behavior coverage if extracting nontrivial positioning logic.
4. Inspect both CTA states at actual display size and enlarged text; verify tap
   behavior and top arrival on Android. Record remaining environment limitations.

## Preview limitations

`previews/android-explore-back-to-top.svg` is a static reconstruction built on
the saved Explore screen, with matching current/proposed viewport sizes. Its
backdrop is not a new screenshot of the running app at a scrolled position.
The CTA-visible and CTA-hidden rows illustrate the agreed floating positions.
Quick Look rendering is blocked by the current sandbox. This initial SVG shows
the superseded text-label proposal; the approved design is the arrow-only PNG.

Arrow-only sample: `previews/android-explore-back-to-top-arrow.png`.
This is a static composite on the saved screen showing the lowered position
with the recommendation CTA hidden; the backdrop is not a live scrolled state.
The sample was visually inspected for arrow clarity, contrast, circular shape,
and separation from bottom navigation. Raised-position review remains pending.

## Implementation and verification results

- Added a typed list ref and native animated return to offset zero.
- Visibility uses the actual list viewport height and clamped content offset;
  the button hides during the return scroll at or below one viewport.
- Implemented a 48dp white circular button, code-drawn 24dp upward arrow,
  pressed background, accessible button role, and Korean screen-reader label.
- Kept the recommendation CTA mounted but transparent, noninteractive, and
  excluded from accessibility while hidden, allowing its height to be measured
  before it appears. Its copy can wrap alongside the recommendation badge.
- Button bottom position follows measured CTA height with a 12dp gap and uses
  the existing safe-area baseline when the CTA disappears.
- New integration coverage passes for threshold visibility, both positions,
  CTA height changes (80dp to 128dp), hidden CTA accessibility/touch behavior,
  native animated scrolling, return visibility, and short-list overscroll.
- All seven recommendation scroll regression tests pass. App TypeScript and
  ESLint for changed application/test files pass.
- Broader run: 17 tests pass and 12 fail. Compared against committed App and
  test files: the same 12 failures already exist on the baseline (outdated text,
  empty event fixtures, and reset expectations); no new test failures.
- Android SDK access is denied in this sandbox, so native build, actual scroll
  animation, and rendered review of raised/lowered positions at enlarged text
  remain unverified. The static approved PNG is a reconstruction, not proof of
  the running UI. User authorized committing the feature and follow-up tap fix;
  no release is included.

## Follow-up: taps during upward momentum

- Report: arrow taps can do nothing while an upward scroll is still moving.
- Reproduced in the integration test: continued scrolling moves the button
  when the recommendation CTA hides, then unmounts it at the viewport cutoff.
  Either transition can invalidate an in-progress tap before release.
- Freeze the button bottom position and keep it mounted from press-in through
  press-out. Resume normal position and visibility after release/cancellation.
  Activation stays on `onPress`, preserving cancelled-touch behavior and
  accessibility activation.
- Regression verifies position stability, retention across the cutoff, animated
  scroll-to-top on release, and cancellation without triggering navigation.
- Nine focused tests pass; app TypeScript and changed-file ESLint pass.
- Actual Android momentum/touch behavior remains unverified without SDK access.
