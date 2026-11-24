# Explore outage recovery

## Scope

- Keep Explore filters and navigation usable during an event-list outage. Display a persistent message inside the result area, using `행사 목록을 불러오지 못했어요`, `잠시 후 다시 시도해 주세요.`, and `다시 시도`.
- Keep the latest successful event list in memory for its matching request. Reapply current client-side filters. If visible cards remain during a refresh failure, show `이전에 불러온 행사예요` with `다시 시도`. Details opened from those cards explain that current reservation information may have changed and retain the source link.
- If query A succeeds, query B fails, and the user returns to A, a failed refresh can reuse A. A successful B replaces the retained response.
- Treat a successful request with no visible items as an empty result. A failed request still shows recovery guidance when a saved list is empty or the local filters hide all its cards.
- Use fixed Korean copy for loading errors. Retry the current request and retain applied filters. Disable the retry control during submission and ignore superseded completions. Use the existing request timeout.
- Scope screen-reader announcements to visible, uncovered Explore. Announce a failure that arrived while Explore was covered once on return. The comparison reconstructs the dismissed alert state and the proposed inline state at the same phone width. [Before-and-after comparison](previews/app-explore-outage-comparison.svg)

## Implementation

1. Model loading, loaded, and failed states around the normalized event-list request. Track the latest successful response together with its request parameters and keep separate ownership for Explore display data. Continue updating shared app data on success only.
2. Render an inline error panel for a failed request without visible prior results. Place a compact stale-data notice above any retained cards and keep retry feedback visible. Pass freshness context when opening a retained card.
3. Reuse existing controls and layout styles. Keep the retry target at least 44 points tall and announce failure and recovery once while the Explore pane is active.
4. Record app tests for cold-start failure, successful empty state, same-query retry and recovery, refresh failure with matching cards, filter changes across requests, and superseded or duplicate retries. Check stale detail copy and Android and iOS screen-reader behavior. Run available type, lint and test checks.

## Readiness

- Independent discovery reviewers recommended this Explore-first scope. They verified the cold-start catalog is empty, the current shared array has no request provenance, and client-side filters can change visible results even when server query parameters match.
- The Product Design audit skill read was denied under the workspace profile, including the escalated attempt. The user approved the static comparison as the plan review fallback and authorized implementation and commit. The browser runtime also failed to bootstrap under the profile. Native visual approval remains pending.

## Model usage

| Stage | Agent | Plugin or skill | Model | Reasoning | Evidence |
| --- | --- | --- | --- | --- | --- |
| Plan | Main agent | grill-with-docs | Unknown | Unknown | Used the accepted Explore behavior and checked the current request, result and filter rules. |
| Review the plan | outage_ux | None | Unknown | Unknown | Independently reviewed screen-local copy, navigation, and accessibility from source. |
| Review the plan | outage_data | None | Unknown | Unknown | Independently reviewed request identity, stale results, and cold-start behavior from source. |
| Review the plan | outage_implementation | None | Unknown | Unknown | Independently reviewed state boundaries and regression cases from source. |
| Review the plan | Main agent | None | Unknown | Unknown | Product Design audit skill read blocked. Prepared a matching-width comparison. |
| Review the plan | outage_implementation | None | Unknown | Unknown | Reviewed the formal plan and clarified success replacement, hidden announcements, and comparison evidence. |
| Implement | Main agent | None | Unknown | Unknown | Added query-scoped state, retry, stale detail guidance, and integration tests in the linked worktree. |
| Verify | Main agent | None | Unknown | Unknown | Passed six Explore tests, TypeScript, and lint on changed app files. Full Jest results reported below. |
| Verify | outage_implementation | None | Unknown | Unknown | Independently passed four Explore and eleven EventDetail tests. Added coverage was advised for hidden announcements and locally filtered stale data. Native accessibility remains unverified. |

## Verification results

- Passed six Explore integration tests, including the five outage regressions, plus the existing child-selection retry regression checked during full-suite comparison.
- The full app suite reported 167 passing tests and the same 10 failures as the unchanged baseline, which reported 162 passing tests. The focused runs reused the existing local dependencies with a worktree-scoped Jest cache.
- React Native tests covered announcement gating, duplicate retries, same-query saved results, and stale event detail text. Runtime screen inspection, VoiceOver, and TalkBack remain unverified.
