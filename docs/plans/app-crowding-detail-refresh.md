# Refresh crowding availability when entering detail

Status: Implemented and locally verified bug fix within the existing approved current-crowding scope. User reported a missing card after mapping an event and supplied the live detail response containing POI008 support. The requirements and existing domain were already established using the local grill-with-docs skill. No UI redesign or new feature scope. User subsequently confirmed a development app and supplied screenshots showing the card/Explore teaser, with no observation available; collection setup remains a separate investigation.

## Model usage

| Workflow stage | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- |
| Plan | Unknown | Unknown | Runtime settings unavailable. Existing scope requires current reads on entering/reopening detail. |
| Review the plan | Unknown | Unknown | Inspected Explore list loading, openDetail, EventDetail, metadata API and server support verification. User-supplied live response confirms valid mapping. |
| Implement | Unknown | Unknown | Added identity-scoped latest crowding-support lookup on detail entry; existing layout/content retained. Runtime settings unavailable. |
| Verify | Unknown | Unknown | Regression failed before fix. All 19 EventDetail/CurrentCrowdingCard tests, mobile TypeScript and changed-file ESLint now pass. Runtime settings unavailable. |

## Diagnosis and approved behavior

- Reported event: nfm-kids-1ba6be3101a8, [2026년 하반기] 유아교육(단체) 새. User-provided public detail response contains crowdingArea.id=POI008, name=경복궁 and a mapping revision.
- Explore fetches when mounted/filters change; openDetail only copies that existing event into state. EventDetail gates the card on that old object's crowdingArea. Reopening detail therefore cannot discover a newly added mapping without reloading Explore.
- Reproduced with a focused EventDetail regression: cached event lacks metadata, fresh API response has it; existing implementation makes zero detail requests and never displays the card.
- Direct live HTTP/database verification is blocked by this environment's DNS/network access. User confirmed Metro/local development app. Subsequent screenshots show the POI008 card/teaser; its unavailable value is not proof of a mapping failure or of a successful collection.

## Implementation and acceptance

1. Reuse the existing public event-detail API when mounting/reopening detail or changing event/mapping identity. Refresh only crowding availability; do not replace unrelated event content or block the existing screen.
2. Show the existing card when fresh support is present, remove it when the fresh event no longer has support. Current observations remain authenticated through the existing card.
3. Scope state/late responses to the current event and mapping identity. Ignore completions after unmount/event change; reject a mismatched response ID. On network error, retain the incoming availability. On 404, remove stale support.
4. No server/database, payment, history UI or layout changes. Preserve login gating, condition timestamp and mapping verification.

## Verification

- Focused EventDetail and CurrentCrowdingCard tests: newly mapped stale-list input, removed mapping, failure fallback, 404, out-of-order venue responses and re-entry.
- Mobile TypeScript/lint; review against existing detail content/safe-area requirements. No visual design change; previous rendered-device verification gap remains.
- Report the installation/build uncertainty separately from the reproduced stale-list defect; do not claim a specific device was fixed without testing it.

## Results

- Reproduced a stale Explore event preventing metadata refresh (zero detail API calls); fixed by useFreshCrowdingArea without replacing other event fields.
- Nineteen focused tests pass, covering fresh availability after mapping, re-entry, removed mapping, offline fallback, 404 suppression, late venue responses and existing card behavior. Mobile TypeScript and changed-file ESLint pass; whitespace checks pass.
- User screenshots provide a rendered current screen with the card and teaser visible. We have not run the modified app on that device. No design change or new screenshot is claimed for this behavior fix.
- Collection status requested from the user: new areas default to disabled; enabled areas can fetch on authenticated detail/retry without waiting for an external scheduler. Missing source credentials, upstream failures, cooldown/backoff and collection enablement must be distinguished using admin health/actual authenticated DTO. No production configuration or data was changed.
