# Searchable event picker for crowding mapping

Status: User explicitly approved the proposed picker and requested implementation/commit. Implemented locally and behavior/type checks passed. Actual browser visual inspection and bundle build remain blocked by runtime restrictions described below.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Runtime model/reasoning settings not exposed. Read local grill-with-docs skill; user confirmed all publication states. |
| Review the plan | Unknown | Unknown | Inspected CrowdingPage, EventListPage, listAdminEvents/getAdminEvent and server admin search/filter/pagination. Source-based preview; live browser startup blocked by OpenSSL configuration permission. |
| Implement | Unknown | Unknown | User approved the concrete plan and requested a commit. Added picker, page integration and scoped styles. Runtime settings unavailable. |
| Verify | Unknown | Unknown | Admin TypeScript and five focused behavior checks passed. Vite/native browser restrictions remain. Runtime settings unavailable. |

## Agreed scope and assumptions

- Replace manual event-ID entry in the crowding boundary-check section with a searchable, selectable event list.
- Include all states: draft, published, hidden and archived, explicitly requesting publicationStatus=all. Display a Korean state label per result. Preparing a mapping does not publish an event or change public visibility.
- Reuse existing admin search API, which searches title, venue and address (and other existing fields). No server, database, mapping policy or mobile changes.
- Proposed routine defaults: explicit search button/Enter submission, ten results per page, newest-first server order, previous/next navigation. Search resets the page; paging/searching does not clear the selected event. Keep results within a bounded scroll area with visible focus states and radio selection.
- Each result shows event title, venue, address (or existing region/locality fallback) and publication status. The selected-event summary includes the full read-only ID so operators can distinguish similar titles.
- Preserve the EventEditor link with initialEventId. Resolve that event with getAdminEvent, even when it is not on the visible search page. An initial-event failure shows retry and does not silently substitute a different event.
- Selecting a different event or changing initialEventId clears old boundary verification/evidence/confirmation and invalidates pending verification responses. Existing selection stays while paging/searching or when list loading fails. Search responses must not overwrite a newer query/account's state.
- Keep official-area selection, manual boundary evidence and confirmation. Verification requires a valid selected event and active target area. Disconnect requires only a valid selected event, independent of active areas. Disable mapping mutations during event hydration or another mutation. Existing admin authentication remains unchanged.
- Provide initial loading, empty result, request error/retry and selected states. No fake production events or inferred automatic area matching.

## Acceptance criteria

1. Operators find/select an event without knowing or typing an ID, including every publication state.
2. Pagination/search changes retain the selection; changing selection invalidates previous verification. A late result never selects or verifies the wrong event.
3. Direct entry from EventEditor displays the selected title/venue; missing/deleted events show a useful error and cannot be accidentally mutated.
4. Keyboard users can submit search, navigate/select results and identify selection. Labels, state text and visible focus communicate meaning without relying on color alone.
5. Inspect rendered preview at desktop and narrow width: balanced spacing, readable address/title wrapping, no clipped controls, scrolling limited to results. Compare selected/unselected/loading/error states in the existing admin styling.
6. Current mapping/unmapping workflow and confirmation remain intact; server/mobile scope is unchanged.

## Steps and verification

1. Add an event-picker component using the existing API/types. Keep search state separate from selected event and boundary form state.
2. Integrate into CrowdingPage, preserving initial-event routing and request invalidation; add scoped CSS using current tokens.
3. Typecheck admin. Check search/all-state query, empty/error/retry, pagination, direct entry, rapid selection/query changes, keyboard operation and mapping/unmapping request IDs. Use focused behavior checks where practical; do not add a new test framework for this small admin change.
4. Inspect actual rendered UI when available. Live browser startup is currently blocked; comparison images are faithful source-based reconstruction/proposed mockup, not running-app screenshots. Keep final visual verification pending if the runtime remains inaccessible.

## Review artifacts

- [Side-by-side SVG comparison](previews/admin-crowding-event-picker-comparison.svg): same-size boundary-check section, same selected-event context before verification. Current side is a source-based reconstruction; proposed side uses illustrative list entries, not production API data. Browser, native image conversion and Quick Look rendering were unavailable in this environment, so this is an unrendered vector preview; final visual inspection/approval remains pending. No PNG screenshot was produced.

Approval is required by [AGENTS.md](../../AGENTS.md), Development workflow §2: “Wait for explicit approval before implementation.” UI comparison is required by its Design quality and visual review section. At initial review, the user's all-states answer resolved requirements; subsequent explicit approval of this concrete UI plan is recorded below.

## Implementation results

- Subsequent user approval: “ㅇㅇ 바꾸고 커밋해.” The implementation uses the existing Korean StatusBadge wording (draft displays 검토중), explicit search submission and ten-row pagination. Query failures preserve the selected event; a direct-entry lookup failure cannot enable mutation until a real event is selected/resolved.
- Admin TypeScript passes. Five Node/React behavior tests pass: all-state search/page selection retention, stale search-response rejection, direct-entry failure/retry outside the results, search error/retry retention, and verification invalidation/disconnect using the new selected ID even with no active areas.
- Run `cd admin` then `npm run test:crowding-picker`. Tests reuse the existing sibling `server` TypeScript and `app` React/test-renderer dependencies; install those workspaces' dependencies before running. No new test framework/dependency added. The test renderer emits its existing deprecation notice.
- Vite bundle build remains blocked before application compilation by the bundled Node process rejecting Rolldown's native signing identity, with no WASI fallback installed. Dependencies and lockfiles were not changed to bypass this environment restriction.
- Source/layout review checked narrow-width wrapping, result scroll bounds, radio labels/selection/focus styling and existing surrounding tokens. Browser runtime startup remains blocked by OpenSSL configuration permissions, so actual rendered visual/keyboard inspection remains pending; no screenshot is claimed. Existing comparison SVG remains a source-based preview.
