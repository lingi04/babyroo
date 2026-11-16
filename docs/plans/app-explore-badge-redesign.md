# Explore category badge redesign

## Status and agreed direction

Approved by the user with “Proceed with implementation”. Implementation and
preview review completed. Running-app visual verification remains pending.

The user agreed to category icons with a lighter selected background and requested
numeric design specifications. The three labels are 이벤트, 상설 전시, and
서울형 키즈카페. The design must be reviewed for appearance and intuitive meaning.

## Current implementation

Source reviewed in `app/App.tsx` and `app/src/theme/tokens.ts`.
The saved image `app/store-assets/real-screenshots/01-explore.png` provides visual
context. Live screen inspection failed during the preceding review.

All dimensions below use React Native logical pixels. Screenshot pixel dimensions
depend on device density. Font sizes use React Native font-size units with system
font scaling enabled.

| Property | Current value | Proposed value |
| --- | --- | --- |
| Screen horizontal inset | 20 per side | 20 per side |
| Gap between badges | 8 | 8 |
| Badge height | Fixed 44 | Minimum 48, grows with content |
| Badge corner radius | 16 | 12 |
| Badge border width | 1 | 1 in both selection states |
| Badge horizontal padding | 4 per side | 8 per side |
| Badge vertical padding | Determined by fixed height | 8 per side |
| Icon-to-label gap | 4 | 6 |
| Icon treatment | 22 × 22 circle with 10-unit letter | 16 × 16 outline below width 390, 20 × 20 at width 390 and above |
| Label font size | 12 | 12 |
| Label line height | 15 | 16 |
| Label font weight | 900 | 700 |
| Label maximum lines | 2 | 2 at font scale 1.0, uncapped when text is enlarged |
| Width allocation | 1 / 1 / 1 | 0.85 / 1.05 / 1.50 |

## Proposed design decisions

These exact values and icon choices are recommendations for approval. The user
approved the overall direction, while the details below are proposed by the agent.

### Icons

| Category | Symbol | Intended association |
| --- | --- | --- |
| 이벤트 | Ticket with side cutouts | Admission to events and activities |
| 상설 전시 | Museum building with roof and columns | Museums and exhibition venues |
| 서울형 키즈카페 | Three toy blocks | Children's play spaces |

Use one professionally drawn outline family with consistent round caps and joins.
Choose assets licensed for redistribution and record the required attribution.
Render each icon in a 16 × 16 box, with approximately 14 × 14 visible artwork and
a target stroke width of 1.5 logical pixels. Permit an optical offset of at most
1 logical pixel after inspecting the set together.

Bundle transparent PNG assets at 1×, 2×, and 3× densities and tint them using
React Native Image. Review the source assets and export quality during
implementation. Icons are decorative, with the Korean label supplying meaning.

### Selection colors

| Property | Unselected | Selected |
| --- | --- | --- |
| Badge background | `#FFFFFF` | `#FFE1D3` |
| Badge border | `rgba(0, 0, 0, 0.12)` | `#E85E25` |
| Label color | `#000000` | `#A74619` |
| Icon tint | `#000000` | `#A74619` |

The icon and label share one color in each state. Selection changes the background,
border, and foreground colors. Verify label contrast of at least 4.5:1 against the
background in both states.

### Width allocation and wrapping

Use `minWidth: 0` and allocate the available width in ratios 0.85, 1.05, and 1.50.
Set each badge's flex basis to `(viewportWidth − 56) × weight / 3.40`.
Explicit flex bases account for padding and borders within the target widths.
For viewport width W, space available to the three badges is W − 56, accounting
for two 20-unit screen insets and two 8-unit gaps.

| Viewport width | Current widths, each | Proposed event | Proposed exhibition | Proposed kids cafe |
| --- | --- | --- | --- | --- |
| 360 | 101.3 | 76.0 | 93.9 | 134.1 |
| 390 | 111.3 | 83.5 | 103.1 | 147.4 |
| 430 | 124.7 | 93.5 | 115.5 | 165.0 |

Widths are targets rounded to 0.1 logical pixel. Permit device rounding differences
of up to 1 logical pixel per badge. At 390 units, the kids-cafe badge gains 36.1
units compared with the current equal-width layout.

At font scale 1.0, target a single line for all three labels at viewport widths
360, 390, and 430. Confirm this using the actual platform fonts. At width 320,
allow labels to wrap to two lines. At font scales 1.3 and 2.0, allow additional
lines and increase row height to fit every label without truncation. Stretch all
three badges to the tallest badge in their row. Center the icon and label group
inside each badge, with multiline labels centered.

Visual review found awkward word breaks with horizontal icon placement at width
320 and enlarged text. For widths below 360 or font scale above 1.0, place the
icon above the label with a 6-unit vertical gap. Retain the same width ratios,
8-unit padding, 16-unit icon, and 48-unit minimum height. Request Hangul word
wrapping on iOS and high-quality text wrapping on Android. Preview row heights
are 56 at width 320/font scale 1.0, 60.8 at width 390/scale 1.3, and 104 at width
390/scale 2.0. Actual font metrics may change these content-driven heights.

## Behavior and accessibility acceptance criteria

- Each badge toggles its existing content category. Multiple categories can be
  selected and the final selected category remains selected when pressed.
- Initial selection contains 이벤트 and 상설 전시.
- Result filtering and the existing header-collapse behavior follow the selected
  categories.
- Expose each badge as a button with its existing accessible name and
  `accessibilityState.selected` matching its filter state.
- Icons generate zero separate accessibility focus targets.
- Every badge has a touch area at least 48 units high. At width 320 or greater,
  every badge is also at least 48 units wide.
- Header measurement includes any increased badge-row height. During scrolling,
  the badge row and result list have zero clipping or overlap.

## Implementation steps

1. Prepare the three icons from a single licensed family. Inspect them at 16 units
   in a row and export the three density variants.
2. Replace the three letter glyphs with tinted images. Apply the exact spacing,
   typography, radius, colors, and width weights specified above.
3. Add selected accessibility state and implement content-driven row height.
4. Render the full Explore header with its surrounding filter panel and results.
   Inspect it at 360, 390, and 430 units wide and font scale 1.0.
5. Inspect the narrow-width and enlarged-text cases. Fix issues within these
   specifications and render again before delivery.

## Verification and visual acceptance

- Capture the default selection at widths 360, 390, and 430. At width 390, also
  capture one selected category and all three selected categories.
- Inspect width 320 at font scale 1.0 and width 390 at scales 1.3 and 2.0.
- Check the expanded and compact headers on a running app when available.
- Confirm zero truncated labels, overlapping elements, or clipped icons in these
  cases. Measure geometry against the table with a tolerance of 1 logical pixel.
- At normal display size, review icon recognition, consistent stroke weight,
  optical alignment, breathing room, and the visual balance with the filter panel.
  Record concrete issues and corrections. Numeric compliance alone is insufficient
  for visual approval.
- Run `npx tsc --noEmit`, `npm run lint`, and the existing Explore-category test
  through Jest from `app`. Inspect any existing test selector mismatch against the
  current button labels before interpreting a failure.
- Provide before-and-after screenshots or a faithful preview, identifying the
  platform, viewport width, font scale, and any remaining verification gaps.

## Verification constraints

Earlier attempts to execute npm/Node were denied, and Apple command-line tools
reported a missing active developer path. Recheck tool availability during
implementation. If app rendering remains blocked, produce a faithful preview
where feasible and report running-app verification as pending.

## Implementation and verification results

### Approved wider-screen refinement

The user requested larger icons on wider screens while keeping label size at 12.
Use 16-unit icons below viewport width 390 and 20-unit icons at width 390 and
above. The 390-unit breakpoint is an implementation choice based on the planned
360/390/430 viewport checks. Retain the platform's accessibility text scaling.
Export icons at 20, 40, and 60 physical pixels so the largest display size has
native-resolution assets at 1×, 2×, and 3× density.

At width 390, the event badge has 39.5 units available for its three-character
label after the 20-unit icon, 6-unit gap, and 18-unit padding/border allowance.
At width 430, that label allowance is 49.5. Verify the longer labels as well.

Implemented this refinement and regenerated all nine icon assets at the larger
native resolutions. TypeScript and repository ESLint passed. Reviewed
`previews/app-explore-badges-icon-sizing.png`, showing widths 360, 390, and 430
from top to bottom at font scale 1.0. Labels retain their previous 12-unit raster
and icons increase from 16 to 20 at width 390. All labels fit in this preview.
The earlier matrix and context previews document the initial 16-unit design.
The latest preview uses the same substitute Korean font as those earlier
previews. Live-device font and layout verification remains pending.

The user also requested a full app-screen image. Provided
`previews/app-explore-screen.png`, a 448-unit-wide composite combining the saved
Explore screenshot with the latest 20-unit icons, 12-unit preview labels, and
48-unit-high badges. Reviewed the resulting full-screen image. Surrounding
content comes from the saved screenshot and preview labels use Freesentation.

### Initial implementation review

- Replaced the three glyph circles with 16-unit Lucide ticket, landmark, and
  blocks images. Included 16, 32, and 48-pixel transparent assets and ISC license
  attribution in `app/assets/icons/explore/LICENSE.txt`.
- Applied the specified width ratios, colors, 12-unit corner radius, 48-unit
  minimum touch height, 12/16 label typography, and 700 label weight.
- Selected text and icons have 4.80:1 contrast. Unselected black text on white
  has 21:1 contrast.
- Added button roles and selected accessibility state. Retained the category
  selection handler and existing measured-header layout.
- TypeScript and repository ESLint passed. A temporary isolated React renderer
  harness passed six cases covering widths 320, 360, 390, and 430 plus font scales
  1.3 and 2.0. It checked image decoration, width allocation, responsive layout,
  selection updates, and retention of the final selected category.
- The existing Explore category test fails before mounting the app because
  `eventsNewestFirst` is empty. Other sampled existing app tests also depend on
  obsolete screen text and an unmocked live API. These existing tests were left
  as found. The isolated harness mocked the API and used the current UI labels.
- Reviewed `previews/app-explore-badges-matrix.png` across all eight planned
  width, font-scale, and selection combinations. Reviewed the before-and-after
  surrounding-screen comparison in `previews/app-explore-badges-context.png`.
  Icon weights and alignment are consistent, labels fit at standard widths, and
  the revised narrow/enlarged layout avoids the initial cramped horizontal row.
- These are composited previews rendered with a locally available Korean
  sans-serif font, Freesentation 7 Bold. They use the actual bundled icons and
  specified geometry and colors. The context comparison uses the saved Explore
  screenshot at 448 logical units for surrounding content. Preview typography
  and wrapping approximate platform rendering. Device font metrics and live
  expanded/compact header behavior remain unverified because app rendering tools
  are unavailable in this environment.
