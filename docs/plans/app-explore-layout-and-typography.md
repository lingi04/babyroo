# Explore tab layout and typography

## Intent and design references

Help parents scan an outing name, assess suitability, and see whether planning is required. Keep the familiar illustrations, scroll summary, mail and settings. This is a presentation change to the mobile Explore tab. Retain the current filtering rules, recommendation flow, event detail navigation, and backend interfaces.

- Current expanded reference: [project preview](previews/app-explore-screen.png). For the current collapsed header, see the Android screenshot supplied in the design discussion.
- Proposed appearance: [two-state dimensioned mockup on the design author's machine](/Users/hanjangho/.codex/generated_images/01a1f9ca-9f58-7293-a1df-30bf23020dc4/exec-96eb077f-a3b7-4897-ae1a-2086c514f70c.png). The reference was unavailable to copy into the repository. The measurements and component rules below are the portable handoff.
- The user accepted the sample direction and selected Dosis ExtraBold. Use identical selected styling for all active categories. Place the reservation badge at the top right of the card as in the attached reference. Example listings represent layout fixtures.

## Layout contract

Use React Native logical units. Coordinates describe the nominal 390-wide layout at default font scale, relative to the top safe-area inset. Use flex layout and measured heights at runtime. The card width is viewport width minus 32, giving 328, 358 and 398 at viewport widths 360, 390 and 430.

| Element | Placement and dimensions |
|---|---|
| Expanded header | Outer margins 16. Brand row starts at y=0, height 56. Wordmark left. On the right, mail followed by settings, each 44 × 44 around a 22 × 22 icon, separated by 4. |
| Categories | At y=64, minimum height 44. Use the existing labels 이벤트, 상설 전시 and 서울형 키즈카페. At 390 wide allocate 92, 106 and 144, separated by 8. Distribute available space in that ratio after subtracting the gaps. Both selected states use an identical pale orange fill, accent outline and 14-unit check. Unselected uses a neutral outline. Permit wrapping and row growth at larger text sizes. |
| Filter entry | At y=116, full content width, minimum height 44, radius 12, horizontal padding 12. Place 필터 at left, the applied summary in flexible space, then a 16-unit chevron. The whole row opens the existing editor. Keep its apply, cancel and reset behavior. |
| Scrolled header | Baseline footprint 92. Full-width peach panel inset 12 vertically, minimum height 68 and horizontal content padding 16. Place a 34 × 34 orange b monogram on the left, flexible two-line summary in the middle, mail and settings on the right. Preserve current header interaction and scroll reversal. Measure the panel and grow the header footprint with larger text. |
| Results | First card at y=176 below the nominal expanded header or y=104 in the compact state. Card radius 16, internal padding 12, minimum height 132, gap 10. Use a 1-unit subtle border and soft shadow (iOS opacity 0.08, radius 4, offset 0 × 2; Android elevation 2). |
| Card contents | Illustration 96 × 96, radius 12, top-left aligned. Gap 12 to text. At 390 wide, text starts at card-local x=120 and has about 226 units. Preserve the existing fallback for missing images. Let content determine height. |
| Bottom navigation | Use a full-width white bar, a 56 dp minimum row plus the system bottom inset, horizontal icon/label pairs and an orange active underline. Keep this shared bar stable when switching tabs. |

## Content and typography

1. Build both header summaries from the same **applied** state. Keep category multi-selection independent of age, schedule, region, price, space and reservation. When age matching is active, show the registered child context once, e.g. expanded filter text `18개월 · 무료 · 실내`, compact heading `18개월 아이와 갈 이벤트 · 상설 전시`, subtitle `무료 · 실내`. Use the existing order for optional filters. With age alone the subtitle is `추가 필터 없음`. With age matching off use age-neutral copy; preserve the existing multiple-child and empty-selection cases. Retain the full summary in the accessible label.
2. Order each card as district/type, event title, suitability, practical facts. Use the existing age formatter and show caregiver accompaniment when supplied. Keep a distinct venue if the title does not already contain its full name (compare after trimming and normalizing whitespace). Keep useful existing metadata, including crowding, where present. Allow titles, venue names and facts to wrap.
3. Render known price and indoor/outdoor facts as plain text separated by a middle dot. Render confirmed `예약 필요` once as a pale tinted label, minimum height 24, horizontal padding 8, radius 8, at the trailing edge of the district/type row. Allow it to wrap at enlarged text sizes. Do not infer free admission, suitability or reservation status from missing data. Reuse existing unknown labels where applicable. Prefer natural line breaks over reducing type.
4. Use the existing warm palette. Give the district/type line a muted readable color, the title the strongest text color and orange accents to selection and actions. Keep the same visual state for every selected category and expose selection to assistive technology.

| Role | Font and weight | Size / line height |
|---|---|---|
| Lowercase babyroo wordmark | Dosis ExtraBold 800 | 26 / 32 |
| Event title | Pretendard Bold 700 | 18 / 24 |
| Compact header title | Pretendard Bold 700 | 15 / 20 |
| Category and filter labels | Pretendard SemiBold 600 | 14 / 20 |
| Summary, age, price, venue | Pretendard Medium 500 | 14 / 20 |
| Compact subtitle, reservation badge | Pretendard SemiBold 600 | 13 / 18 |
| District / activity type | Pretendard Medium 500 | 12 / 16 |
| Tab labels | Pretendard Medium 500; selected SemiBold 600 | 13 / 18 |

Set additional letter spacing to zero and retain system text scaling. Bundle the actual licensed Dosis 800 and Pretendard 500/600/700 faces with their license notices. Register their real family/face names on Android and iOS and verify Korean glyphs on both. Use the app mark in the compact header.

## Implementation sequence

1. In the current checkout, capture the same list and selections at the top and after scrolling. Compare at equal display sizes with the proposed states. Record a baseline with a long Korean title and a missing image.
2. Add font assets and scoped type styles, then update the expanded and compact layers in `ExploreScreen` in `app/App.tsx`. Reuse the existing summary helpers, category handlers, header actions, layout measurements and animation. Base list offsets and collapse distance on the measured header, including enlarged text. Ensure only the visible header handles taps and accessibility focus.
3. Apply the hierarchy to Explore listing cards. Trace the Explore list's actual render path before changing `EventCard`, which also serves other contexts. Keep existing IDs, list paging, tab swipe guard, scroll-to-top and recommendation CTA thresholds. Exercise each after changing card/header heights.
4. Review the rendered layout, correct spacing or wrapping issues, and update this document with evidence and completed stages.

## Acceptance and verification

- Compare top, mid-transition and compact states at widths 360, 390 and 430, at default and 150% text scale. Check the narrowest width at 200%. No clipped facts, overlapping actions, disappearing focus targets, or first/last card hidden behind a bar. Card heights may vary.
- Check one, multiple and zero selected categories; age alone, optional filters, multiple children and no selected child; distinct and repeated venues, long titles, missing imagery and reservation required/unknown. Verify both selected categories look identical and mail/settings work in both states.
- At actual display size, independently review (1) visual balance and hierarchy, (2) comprehension while scanning and scrolling, and (3) fit/accessibility. Save same-size before/after screenshots. Mark any simulator-only or unverified device coverage explicitly.
- Run `npm test -- --runInBand`, `npm run lint` and `npx tsc --noEmit` from `app/`. Build Android and iOS with the project toolchains where available. Inspect the diff for unintended changes to recommendation cards, filters or navigation. Add regression coverage for changed summary and card presentation where existing tests miss it.
- Formal Codex Council verification requested by the user: **0 of 3 completed**. The earlier preflight could not run. Obtain the actual panel and estimate and follow the Council acceptance gate before dispatch. Record each pass and any open findings separately from ordinary visual QA. Design direction and implementation were authorized. Native visual acceptance remains pending.

## Implementation and verification record

- Fixed the reported Android font task configuration failure by resolving ReactExtension explicitly from the project before entering the Exec task closure. This avoids resolving react against the task delegate. Direct font staging succeeds. Gradle verification is still blocked here by access to the wrapper cache lock.

- Downloaded fonts were supplied in the workspace. Copied the four selected static faces and license notices to app/assets/fonts and staged them successfully in the shared native font directory. Verified internal PostScript names match all configured fontFamily values. Removed font package dependencies in favor of these local assets. Native rebuild attempt is blocked by access to the Gradle cache lock.
- The area around the floating banner now shows the scrolling cards. The viewport ends at the tab row; content padding of banner height plus 8 dp preserves the 10 dp final-card gap at maximum scroll. The black banner retains its own background.

- The user's latest adjustment makes the final card-to-banner gap equal the 10 dp inter-card gap at the bottom of scrolling. The viewport ends at the banner's measured top with zero extra content padding while visible. The final card's existing 10 dp bottom margin supplies that gap. When hidden, the list ends above the tab row and system inset, with 16 dp content padding.

- Moved the restored floating recommendation banner down by 32 dp. Its bottom edge now sits 8 dp above the 56 dp tab row, plus the system inset. The back-to-top button continues to clear the banner. Font staging also accepts manually supplied static faces and license files in app/assets/fonts before using the pinned packages.

- Real-phone comparison showed vertically stacked category checks and fallback typography. Removed the rule that switched categories to a column whenever fontScale exceeded 1. Checks stay inline; labels can wrap and controls can grow for accessibility.
- Added native font preparation to Android preBuild and an Xcode phase before resources. Both use the pinned static faces. Missing font packages now produce an actionable build error. Checked TypeScript, lint, four targeted UI tests, Xcode project syntax and shell syntax successfully. Native build/font application remains blocked by unavailable package downloads; the actual phone has not been reverified.

- Follow-up correction confirmed by the user: retain Dosis ExtraBold 26/32, visible category badges with a 44 dp minimum height, and event title/details at 18/24 and 14/20. Fixed the visible badge's previous 40 dp minimum.
- At the user's subsequent request, restored the recommendation action to its earlier floating banner, positioned 96 dp above the system bottom inset. Restored the list's full viewport and safe-area content padding and removed the dedicated strip. Existing scroll visibility and measured back-to-top placement remain active. Font download retry still failed because the package registry could not be resolved.

- Implemented both Explore headers, the shared applied-filter summary, consistent multi-select states, child selection inside the filter editor, and the Explore-specific listing layout. Scroll animation and touch thresholds use the measured difference between header heights. The compact summary returns to the full controls.
- Configured Dosis ExtraBold and Pretendard Medium, SemiBold and Bold as pinned package assets. The app install step stages the fonts and notices for both native targets. Package downloads were blocked by DNS here, so installation and on-device typeface selection still require verification.
- [Two-state implementation preview](previews/app-explore-implementation.png) is a static 390 dp reconstruction with sample data and substitute typography. Native visual acceptance, including 360/430 dp and enlarged system text, remains open. Android device discovery could not bind the ADB service, Gradle could not access its cache, and full Xcode was unavailable. The Product Design audit instructions were inaccessible.
- All seven targeted Explore and navigation checks passed, including header handoff, accessibility focus and stationary remeasurement after a change in text size. TypeScript and ESLint passed. The complete suite passed 127 of 138 tests. The remaining 11 failures also occurred on the unchanged baseline. No formal Council reviews ran.

The reference-fidelity revision removes the circular chrome around the header actions, lightens the list background, increases metadata contrast and moves the booking badge and navigation to their reference positions. The static preview uses existing artwork and a substitute font; native fidelity still needs a device comparison.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | Main agent in this chat | ImageGen (mockup tool); grill-me and grill-with-docs (instructions consulted) | Unknown | Unknown | Generated the dimensioned preview and wrote the plan from the design discussion and repository inspection. Exact runtime settings unavailable. |
| Review the plan | Main agent in this chat | None | Unknown | Unknown | Direct repository check of layout, summary helpers, fonts, shared cards and verification commands. Council preflight was attempted and blocked; no Council reviewer or other sub-agent ran. |
| Review the plan | plan_review sub-agent | None | Unknown | Unknown | Reviewed source compatibility. Flagged fixed scroll thresholds, child controls inside the old header, and shared recommendation cards. The implementation addresses all three. |
| Implement | Main agent in this chat | None | Unknown | Unknown | Implemented the approved layout, native font setup and regression coverage. |
| Implement | Main agent in this chat | None | gpt-6.1-sol | Unknown | Runtime developer metadata confirms the current model for the badge-height and recommendation-strip correction. Reasoning level unavailable. |
| Verify | verification sub-agent | None | Unknown | Unknown | Independently checked the app suite, types, lint and the unchanged test baseline. |
| Verify | Main agent in this chat | None | Unknown | Unknown | Reran targeted and full tests, types and lint, validated the Xcode project and plist, inspected the static preview, and attempted native verification. |
| Verify | fidelity_verify sub-agent | Pending | Unknown | Unknown | Assigned a separate check of the reference-fidelity revision. |
