# Compact current-crowding card

Status: Concrete mockup explicitly approved by the user: “오키 이렇게 변경해”. Implemented within the existing detail layout, then refined through user feedback on the running development app. User accepted the final spacing/header consolidation and requested a commit (“죠타 이렇게 커밋하자”). Independently implemented detail-metadata refresh fix retained; agent-operated device inspection remains unavailable.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Settings unavailable. Reused the local grill-with-docs requirements process and prior domain decisions; user requested progressively compact mockups. |
| Review the plan | Unknown | Unknown | User supplied running screenshots; comparison and refined image mockups were shown, and final one-line-footer mockup approved. Inspected card, tokens, existing icons and tests. |
| Implement | Unknown | Unknown | Approved mockup implemented with native scope/source dialogs, shared pin asset, white panel/status dot and compact footer. Settings unavailable. |
| Verify | Unknown | Unknown | 23 detail/card tests, mobile TypeScript and full ESLint pass. Source-derived state previews generated. Native/browser rendering remains blocked; settings unavailable. |

## Confirmed design and behavior

- Latest approved refinement supersedes the original footer composition: combine scope with the header's area name as “경복궁 ⓘ”; remove the duplicated footer area label and pin. Keep the scope explanation on tap and align only “서울시 제공 ›” at the footer's right edge.
- Footer spacing correction after removing the duplicate scope label: source row top margin and card bottom padding are both 4px (plus the source action's symmetric 1px padding). This replaces the uneven 2px top gap/12px bottom padding while keeping the card compact.

- Preserve the surrounding place-detail screen, facts, imagery, safe area and reservation CTA.
- Card header: title, coverage-area name, compact refresh action on the right.
- White rounded observation panel: label/actual observation time on the left, fine divider, colored status dot + black bold crowding label on the right. No observation means unavailable, never an invented level/time. Existing guest/login, stale/error and source replacement semantics remain.
- Footer is one compact row: existing pin icon + coverage-area name and “지역 기준”, small circled info icon; on the right “서울시 제공 ›”. Remove the always-visible facility-scope sentence and verbose attribution/free-source line.
- User subsequently requested removing the horizontal line above this footer. Keep its existing spacing; the white observation panel already separates the reading from the footer.
- User then requested tighter vertical spacing around the footer: top margin 8→4px, action minimum height 32→24px, vertical padding 4→2px. Increase vertical hitSlop 8→12px to retain the same touch height without visible bulk.
- Latest user refinement: footer action vertical padding 2→1px. The 24px minimum row height remains, so overall height may stay the same at normal font size.
- After the user reported little visible change, remove both footer actions' 24px minimum heights, remove the footer's 4px top padding, and reduce its top margin to 2px. Normal text determines the row height (16px line height + 1px padding on either side); vertical hitSlop increases to 15px. Device inspection remains pending.
- Tapping the left footer action shows a native information dialog explaining that the data describes the coverage area and can differ from inside the facility. Tapping the source action shows a native source dialog with 서울특별시 공공데이터, 원본 데이터 무료 제공, and an explicit 원본 보기 action opening the same official URL. Preserve source-open failure feedback. No extra disclosure is discarded; it moves into the approved on-demand details.
- Use existing tokens and pin asset tinted muted gray; render the small circled i with native text/view. Status uses both dot color and explicit text. Match optical icon size/stroke to the footer typography.
- Compact visible actions use hitSlop to retain approximately 48px touch height without adding permanent rows. Allow long names to wrap. Narrow screens/enlarged fonts may stack the observation columns instead of clipping. Exceptional error/replacement text may add height as necessary for truthful interpretation.
- No payment/history/weather/server/storage changes. No new data or inferred venue crowding.

## Acceptance and verification

1. Normal current card matches approved white-panel hierarchy and single-row footer; source/scope details appear only after tapping their clearly labelled accessible actions.
2. Actual source time, replacement-average disclosure, stale/failed refresh, missing readings, login and logout/request identity behavior remain intact.
3. Source details disclose free original data and open the existing official source only after confirmation. Handle failed links gracefully.
4. Reuse card fixture tests and add focused interaction checks for dialogs/source failure and status semantics. Run detail/card tests, mobile TypeScript and relevant lint.
5. Generate a source-based preview from actual test-renderer trees at desktop/narrow/enlarged widths and relevant states; inspect rendered screen when available. Current native/browser tooling is blocked by OpenSSL permissions; report any remaining actual-device visual gap. Approved AI mockup is a design reference, not a native screenshot.

## Results and review

- Implemented exactly the approved information hierarchy: header refresh, white time/status columns, black level text plus colored dot, single footer with location/info action and short source action. Guest, failed/stale, replacement and unavailable states retain their meanings; extra explanatory lines appear only for exceptional states.
- Footer compact action boxes are now 24px high with 12px vertical hitSlop after the user's spacing refinement; label text and source are readable independently of color. Existing location asset is rendered at 14px with muted tint, and the decorative circled i does not enlarge with font scaling. Long text can wrap without truncation, and narrow/large-text observation panels use a horizontal divider between stacked sections.
- Five original fixture states plus 320px and 1.6-font-scale cases were generated from actual component output. Normal tests explicitly use 390px/1.0 font scale rather than the test preset's artificial dimensions. Reviewed the source structure/preview conversion for matching reading direction, action labels, source disclosure, neutral level text and pin tint.
- [HTML state preview](previews/app-current-crowding.html), generated with [renderer](previews/render-current-crowding.cjs). This is an approximate HTML representation, not a native screenshot; source/scope dialogs are verified by interaction tests rather than visible in this static preview.
- Focused tests: 23 pass, including both dialogs, original-source confirmation/link failure, narrow/large content/actions and the independent fresh-detail metadata fix. Mobile TypeScript and full ESLint pass. No server/API/database changes.
- User-approved design images were shown in the conversation. Copying their generated-image directory into the repo was blocked by filesystem permissions, so no inaccessible asset is referenced as a repo file.
- Native/browser startup remains blocked by the known OpenSSL/runtime environment restriction. The agent has not inspected the final modified card on a device; the user accepted the final result after spacing refinements and authorized committing it. No push or deployment performed for this change.
